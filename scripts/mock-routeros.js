// Mock RouterOS API server (binary TLV protocol) for ISOLATED testing of the
// routeros provisioning adapter. Responds to /login and /ip/hotspot/user/add.
// Set MOCK_FAIL=1 to make every add return !trap (tests the failure/refund path).
const net = require('net');
const PORT = Number(process.env.MOCK_PORT || 8728);
const FAIL = process.env.MOCK_FAIL === '1';

function encodeLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) { const v = len | 0x8000; return Buffer.from([(v >>> 8) & 0xff, v & 0xff]); }
  if (len < 0x200000) { const v = len | 0xc00000; return Buffer.from([(v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]); }
  if (len < 0x10000000) { const v = (len | 0xe0000000) >>> 0; return Buffer.from([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]); }
  return Buffer.from([0xf0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff]);
}
function decodeLength(buf, off) {
  if (off >= buf.length) return null;
  const b0 = buf[off];
  if ((b0 & 0x80) === 0) return [b0, 1];
  if ((b0 & 0xc0) === 0x80) return off + 1 < buf.length ? [((b0 & 0x3f) << 8) | buf[off + 1], 2] : null;
  if ((b0 & 0xe0) === 0xc0) return off + 2 < buf.length ? [((b0 & 0x1f) << 16) | (buf[off + 1] << 8) | buf[off + 2], 3] : null;
  if ((b0 & 0xf0) === 0xe0) return off + 3 < buf.length ? [((b0 & 0x0f) << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3], 4] : null;
  return off + 4 < buf.length ? [(buf[off + 1] << 24) | (buf[off + 2] << 16) | (buf[off + 3] << 8) | buf[off + 4], 5] : null;
}
function writeSentence(sock, words) {
  const parts = [];
  for (const w of words) { const wb = Buffer.from(w, 'utf8'); parts.push(encodeLength(wb.length), wb); }
  parts.push(Buffer.from([0]));
  sock.write(Buffer.concat(parts));
}

net.createServer((sock) => {
  let buf = Buffer.alloc(0);
  let words = [];
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const hdr = decodeLength(buf, 0);
      if (!hdr) break;
      const [len, hb] = hdr;
      if (buf.length < hb + len) break;
      const word = buf.subarray(hb, hb + len).toString('utf8');
      buf = buf.subarray(hb + len);
      if (len === 0) {
        const cmd = words[0];
        if (cmd === '/login') writeSentence(sock, ['!done']);
        else if (cmd === '/ip/hotspot/user/add') {
          if (FAIL) { writeSentence(sock, ['!trap', '=message=no such profile']); writeSentence(sock, ['!done']); }
          else writeSentence(sock, ['!done', '=ret=*1A']);
        } else writeSentence(sock, ['!done']);
        words = [];
      } else words.push(word);
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`mock RouterOS on :${PORT} (FAIL=${FAIL})`));
