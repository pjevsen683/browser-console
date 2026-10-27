// Konsollens side af netværket: én RTCPeerConnection pr. controller (konsollen tilbyder), kanalerne 'in' (uordnet,
// ingen gentagelser: kun det nyeste input tæller) og 'ctl' (pålidelig). Input tages imod fra både datakanal og
// server-reserve; løbenummeret i spillerlisten fjerner dubletter. Ingen STUN/TURN: alle er på samme wifi.
import { SignalClient } from './signal-client.js';

export class HostNet {
  constructor({ url, code = null, token = null, onRoom, onStatus, onJoin, onLeave, onInput, onLink, onCtl = () => {} }) {
    this.cb = { onRoom, onStatus, onJoin, onLeave, onInput, onLink, onCtl };
    this.code = code;
    this.token = token;
    this.links = new Map();
    this.sig = new SignalClient(url, {
      open: () => {
        const m = { t: 'host' };
        if (this.code) m.code = this.code;
        if (this.token) m.token = this.token;
        this.sig.send(m);
        onStatus('online');
      },
      close: () => onStatus('offline'),
      message: (m) => this.onMessage(m),
    });
  }

  onMessage(m) {
    if (m.t === 'room') { this.code = m.code; this.cb.onRoom(m.code); }
    else if (m.t === 'peer-join') { this.cb.onJoin(m.peer, { pid: m.pid, name: m.name }); this.offer(m.peer); }
    else if (m.t === 'peer-leave') { this.drop(m.peer); this.cb.onLeave(m.peer); }
    else if (m.t === 'signal') this.onSignal(m.from, m.data);
    else if (m.t === 'relay') {
      const d = m.data;
      if (d?.k === 'in') this.cb.onInput(m.from, d.m);
      else if (d?.k === 'ctl') this.cb.onCtl(m.from, d.m);
      // Controlleren beder kun om et nyt tilbud, når den selv ingen åben kanal har -- så er vores død, også selv om
      // den stadig ser 'open' ud (det kan den i op til 30 s).
      else if (d?.k === 'reoffer') this.offer(m.from);
    } else if (m.t === 'error' && m.error === 'replaced') {
      this.sig.stop();                           // en nyere fane på samme telefon har rummet nu
      this.cb.onStatus('replaced');
    } else if (m.t === 'error') this.cb.onStatus(`error:${m.error}`);
  }

  // Samme slags grænser som serverens for relay (4 KB, et antal pr. sekund), nu for de direkte kanaler: en telefon
  // med devtools må ikke kunne få fjernsynet til at hakke. Input kommer 30 gange i sekundet + knapskift; ctl er svar,
  // tegnestrøg (20/s) og pong.
  allow(e, peer, kind) {
    if (typeof e.data !== 'string' || e.data.length > 4096) return false;
    const now = Date.now(), b = (this.buckets ??= new Map()).get(`${peer}:${kind}`) ?? { n: 0, t: now };
    if (now - b.t >= 1000) { b.n = 0; b.t = now; }
    this.buckets.set(`${peer}:${kind}`, b);
    return ++b.n <= (kind === 'in' ? 90 : 40);
  }

  direct(peer) { return this.links.get(peer)?.inCh.readyState === 'open'; }

  async offer(peer) {
    this.drop(peer);
    if (typeof RTCPeerConnection === 'undefined') return;
    const pc = new RTCPeerConnection({ iceServers: [] });
    const link = {
      pc,
      inCh: pc.createDataChannel('in', { ordered: false, maxRetransmits: 0 }),
      ctlCh: pc.createDataChannel('ctl'),
      pending: [],
    };
    this.links.set(peer, link);
    link.inCh.onmessage = (e) => { if (this.allow(e, peer, 'in')) try { this.cb.onInput(peer, JSON.parse(e.data)); } catch { /* affald */ } };
    link.ctlCh.onmessage = (e) => { if (this.allow(e, peer, 'ctl')) try { this.cb.onCtl(peer, JSON.parse(e.data)); } catch { /* affald */ } };
    const changed = () => { if (this.links.get(peer) === link) this.cb.onLink(peer, this.direct(peer) ? 'direct' : 'relay'); };
    link.inCh.onopen = changed;
    link.inCh.onclose = changed;
    pc.onconnectionstatechange = () => {
      if (this.links.get(peer) !== link || !['failed', 'disconnected', 'closed'].includes(pc.connectionState)) return;
      this.drop(peer);                           // send() går nu via serveren, og controlleren beder om et nyt tilbud
      this.cb.onLink(peer, 'relay');
    };
    pc.onicecandidate = (e) => { if (e.candidate) this.sig.send({ t: 'signal', to: peer, data: { cand: e.candidate.toJSON() } }); };
    try {
      await pc.setLocalDescription(await pc.createOffer());
      this.sig.send({ t: 'signal', to: peer, data: { sdp: pc.localDescription.toJSON() } });
    } catch (e) { console.warn('webrtc offer', e); }
    changed();
  }

  async onSignal(peer, d) {
    const link = this.links.get(peer);
    if (!link || !d) return;
    try {
      if (d.sdp?.type === 'answer') {
        await link.pc.setRemoteDescription(d.sdp);
        for (const c of link.pending.splice(0)) await link.pc.addIceCandidate(c).catch(() => {});
      } else if (d.cand) {
        if (link.pc.remoteDescription) await link.pc.addIceCandidate(d.cand).catch(() => {});
        else link.pending.push(d.cand);
      }
    } catch (e) { console.warn('webrtc signal', e); }
  }

  drop(peer) {
    const l = this.links.get(peer);
    if (!l) return;
    this.links.delete(peer);
    l.pc.close();
  }

  send(peer, msg) {
    const l = this.links.get(peer);
    if (l?.ctlCh.readyState === 'open') l.ctlCh.send(JSON.stringify(msg));
    else this.sig.send({ t: 'relay', to: peer, data: { k: 'ctl', m: msg } });
  }
}
