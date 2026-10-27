// En WebSocket til signalserveren, der genåbner sig selv (1 s, 2 s, 4 s, højst 5 s) og taler JSON.
export class SignalClient {
  constructor(url, handlers) {
    this.url = url;
    this.h = handlers;
    this.delay = 1000;
    this.stopped = false;
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    const ws = this.ws = new WebSocket(this.url);
    ws.onopen = () => { this.delay = 1000; this.h.open?.(); };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.h.message?.(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.h.close?.();
      if (this.stopped) return;
      setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(5000, this.delay * 2);
    };
  }

  get open() { return this.ws?.readyState === 1; }

  send(m) { if (this.open) this.ws.send(JSON.stringify(m)); }

  stop() { this.stopped = true; this.ws?.close(); }
}
