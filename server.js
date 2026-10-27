// Lokal dev-server: public/ uden cache og signalserveren på /ws i samme proces. Almindelig HTTP er nok på localhost
// (en sikker kontekst). Skriver sin pid i server.pid -- luk den med `kill $(cat server.pid)`, aldrig med pkill -f.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSignal } from './server/signal.mjs';

const PORT = Number(process.env.PORT) || 8091;
const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json',
};

const signal = createSignal();
const server = createServer((req, res) => {
  let p = normalize(decodeURIComponent((req.url || '/').split('?')[0]));
  if (p.includes('..')) { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = join(ROOT, p);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end('Findes ikke'); }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});
server.on('upgrade', (req, socket, head) => signal.handleUpgrade(req, socket, head));
server.listen(PORT, () => console.log(`Konsol: http://localhost:${PORT}/  (controller: /c.html)`));

if (!process.env.NOPID) {
  const pidFile = join(HERE, 'server.pid');
  writeFileSync(pidFile, String(process.pid));
  const bye = () => { try { unlinkSync(pidFile); } catch { /* væk */ } process.exit(0); };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}
