// Controllerens side af netværket. Input går over datakanalen 'in', når den er åben, og ellers med det samme via
// serveren (reserve). Er der ingen direkte forbindelse, beder den konsollen om et nyt tilbud hvert 10. sekund.
import { SignalClient } from './signal-client.js';

export class PadNet {
  constructor({ url, code, name, pid, noRtc = false, onState, onCtl }) {
    Object.assign(this, { noRtc, onState, onCtl });
    this.joinMsg = { t: 'join', code, name, pid };
    this.pc = null; this.inCh = null; this.ctlCh = null; this.pending = [];
    this.joined = false; this.hostHere = false;
    this.sig = new SignalClient(url, {
      open: () => this.sig.send(this.joinMsg),
      message: (m) => this.onMessage(m),
      close: () => { this.joined = false; this.dropRtc(); onState('connecting'); },
    });
    onState('connecting');
    this.retry = setInterval(() => {
      if (this.joined && this.hostHere && !this.noRtc && !this.direct) this.sig.send({ t: 'relay', data: { k: 'reoffer' } });
    }, 10_000);
  }

  get direct() { return this.inCh?.readyState === 'open'; }

  // Efter en genstart af signalserveren kan controlleren komme før konsollen, der genopretter sin kode. For en
  // controller, der var med, er no-room derfor forbigående i 30 s: den prøver igen hvert 2. sekund.
  rejoinSoon() {
    this.retryUntil ??= Date.now() + 30_000;
    if (Date.now() > this.retryUntil) return false;
    this.onState('waiting-host');
    setTimeout(() => this.sig.send(this.joinMsg), 2000);
    return true;
  }

  report() { this.onState(this.direct ? 'direct' : this.hostHere ? 'relay' : 'waiting-host'); }

  onMessage(m) {
    if (m.t === 'joined') { this.joined = this.wasJoined = true; this.retryUntil = null; this.hostHere = m.host; this.report(); }
    else if (m.t === 'error' && m.error === 'no-room' && this.wasJoined && this.rejoinSoon()) { /* forbigående */ }
    else if (m.t === 'error') {
      if (m.error === 'replaced') this.stop();   // en anden fane på denne telefon har pladsen nu
      this.onState({ error: m.error });
    }
    else if (m.t === 'host-gone') { this.hostHere = false; this.dropRtc(); this.report(); }
    else if (m.t === 'host-back') { this.hostHere = true; this.report(); }
    else if (m.t === 'signal') this.onSignal(m.data);
    else if (m.t === 'relay' && m.data?.k === 'ctl') this.onCtl(m.data.m);
  }

  async onSignal(d) {
    if (this.noRtc || !d || typeof RTCPeerConnection === 'undefined') return;
    try {
      if (d.sdp?.type === 'offer') {
        this.dropRtc();
        const pc = this.pc = new RTCPeerConnection({ iceServers: [] });
        pc.onicecandidate = (e) => { if (e.candidate) this.sig.send({ t: 'signal', data: { cand: e.candidate.toJSON() } }); };
        pc.ondatachannel = (e) => this.channel(e.channel);
        pc.onconnectionstatechange = () => {
          if (this.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) { this.dropRtc(); this.report(); }
        };
        await pc.setRemoteDescription(d.sdp);
        for (const c of this.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        await pc.setLocalDescription(await pc.createAnswer());
        this.sig.send({ t: 'signal', data: { sdp: pc.localDescription.toJSON() } });
      } else if (d.cand) {
        if (this.pc?.remoteDescription) await this.pc.addIceCandidate(d.cand).catch(() => {});
        else this.pending.push(d.cand);
      }
    } catch (e) { console.warn('webrtc', e); }
  }

  channel(ch) {
    if (ch.label === 'in') this.inCh = ch;
    else if (ch.label === 'ctl') {
      this.ctlCh = ch;
      ch.onmessage = (e) => { try { this.onCtl(JSON.parse(e.data)); } catch { /* affald */ } };
    }
    ch.onopen = () => this.report();
    ch.onclose = () => this.report();
  }

  dropRtc() {
    this.pc?.close();
    this.pc = this.inCh = this.ctlCh = null;
    this.pending = [];
  }

  sendInput(m) {
    if (this.direct) this.inCh.send(JSON.stringify(m));
    else if (this.joined && this.hostHere) this.sig.send({ t: 'relay', data: { k: 'in', m } });
  }

  // Svar, tegnestrøg og pong: pålideligt over ctl-kanalen, ellers via serveren.
  sendCtl(m) {
    if (this.ctlCh?.readyState === 'open') this.ctlCh.send(JSON.stringify(m));
    else if (this.joined && this.hostHere) this.sig.send({ t: 'relay', data: { k: 'ctl', m } });
  }

  stop() { clearInterval(this.retry); this.dropRtc(); this.sig.stop(); }
}
