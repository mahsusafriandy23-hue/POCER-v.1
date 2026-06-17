// Live probe of the GoID OTP-request endpoint. Sends a REAL OTP to the given phone.
// Usage: node scripts/gobiz-otp-probe.js <phone>   e.g. 081933000001
// Prints raw status + body so we can confirm the real request/response shape.
const { randomUUID } = require('crypto');

function splitPhone(raw) {
  let p = (raw || '').replace(/[^\d]/g, '');
  if (p.startsWith('62')) p = p.slice(2);
  else if (p.startsWith('0')) p = p.slice(1);
  return { countryCode: '+62', phone: p };
}
function headers() {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'id',
    'authentication-type': 'go-id',
    authorization: 'Bearer',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'gojek-country-code': 'ID',
    'gojek-timezone': 'Asia/Bangkok',
    origin: 'https://app.gobiz.com',
    referer: 'https://app.gobiz.com/',
    'user-agent':
      'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
    'x-appid': 'go-biz-web-dashboard',
    'x-appversion': 'platform-v3.80.0-be301d52',
    'x-deviceos': 'Web',
    'x-platform': 'Web',
    'x-uniqueid': randomUUID(),
    'x-user-locale': 'id-ID',
    'x-user-type': 'merchant',
  };
}

const { countryCode, phone } = splitPhone(process.argv[2] || '');
if (!phone) {
  console.error('Usage: node scripts/gobiz-otp-probe.js <phone>');
  process.exit(1);
}

// Candidate endpoints/bodies to discover the real GoID login shape.
const candidates = [
  { url: 'https://api.gobiz.co.id/goid/login', body: { client_id: 'go-biz-web-dashboard', country_code: countryCode, phone_number: phone, data: { country_code: countryCode, phone_number: phone } } },
  { url: 'https://api.gobiz.co.id/goid/otp', body: { client_id: 'go-biz-web-dashboard', data: { country_code: countryCode, phone_number: phone } } },
  { url: 'https://goid.gojek.com/goid/login', body: { client_id: 'go-biz-web-dashboard', country_code: countryCode, phone_number: phone } },
];

(async () => {
  for (const c of candidates) {
    try {
      const res = await fetch(c.url, { method: 'POST', headers: headers(), body: JSON.stringify(c.body) });
      const text = await res.text();
      console.log(`\n=== ${c.url} → HTTP ${res.status} ===`);
      console.log(text.slice(0, 800));
      if (res.ok) { console.log('>>> THIS ONE LOOKS OK — note the otp_token field above.'); break; }
    } catch (e) {
      console.log(`\n=== ${c.url} → ERROR ${e.message} ===`);
    }
  }
})();
