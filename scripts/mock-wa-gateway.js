// Tiny mock WhatsApp gateway for ISOLATED testing of the whatsapp adapter.
// Logs received messages to /tmp/wa-mock.log and returns {success:true}.
const http = require('http');
const fs = require('fs');
const LOG = '/tmp/wa-mock.log';
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/send-message') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      fs.appendFileSync(LOG, body + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: 'mock-' + Date.now() }));
    });
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});
server.listen(9099, '127.0.0.1', () => console.log('mock WA gateway on :9099'));
