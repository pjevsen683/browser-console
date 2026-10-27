// QR-koden til controller-adressen, tegnet med den vendorede qrcode-generator (global `qrcode`, vendor/qrcode.js).
export function drawQr(canvas, text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), quiet = 2, size = n + quiet * 2;
  const scale = Math.max(1, Math.floor(canvas.width / size)), off = Math.floor((canvas.width - size * scale) / 2);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) g.fillRect(off + (c + quiet) * scale, off + (r + quiet) * scale, scale, scale);
  }
}
