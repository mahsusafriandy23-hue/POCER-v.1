/**
 * End-to-end smoke test against a running backend in SIM mode.
 * Exercises the full money + provisioning happy paths plus idempotency and
 * tier-scoping, asserting results. Read-only against config; creates throwaway
 * test entities. Run: node scripts/e2e-sim.mjs  (backend must be on :8080)
 *
 * Exits non-zero if any assertion fails.
 */
const BASE = process.env.E2E_BASE || 'http://localhost:8080/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'dev-platform-key-123';

let pass = 0,
  fail = 0;
const log = (...a) => console.log(...a);
function ok(cond, label) {
  if (cond) {
    pass++;
    log(`  ✓ ${label}`);
  } else {
    fail++;
    log(`  ✗ ${label}`);
  }
}

async function call(path, { method = 'GET', body, token, key } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (key) headers['X-Admin-Key'] = key;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

const rnd = Math.floor(Math.random() * 9_000_000) + 1_000_000;

async function main() {
  log('\n=== POCER v1 E2E (sim) ===');

  // 1) Catalog
  let r = await call('/catalog/servers', {});
  ok(r.status === 200 && Array.isArray(r.data) && r.data.length > 0, 'catalog servers list');
  const korleko = r.data.find((s) => s.code === 'KORLEKO');
  ok(!!korleko, 'KORLEKO outlet present');

  r = await call(`/catalog/packages?server=${korleko.id}`, {});
  ok(r.status === 200 && r.data.length > 0, 'KORLEKO packages list');
  const pkg = r.data.find((p) => p.isActive) || r.data[0];
  const pkg2 = r.data.find((p) => p.id !== pkg.id) || pkg;
  log(`    using pkg "${pkg.name}" (Rp${pkg.price})`);

  // 2) Customer register + login
  const cred = { name: 'E2E Cust', username: `e2e${rnd}`, phone: `08990${rnd}`, password: 'rahasia123' };
  r = await call('/customer/auth/register', { method: 'POST', body: cred });
  ok(r.status < 300 && r.data?.accessToken, 'customer register');
  let cust = r.data;
  r = await call('/customer/auth/login', { method: 'POST', body: { login: cred.username, password: cred.password } });
  ok(r.status < 300 && r.data?.accessToken, 'customer login');
  const cToken = r.data.accessToken;
  const customerId = r.data.customer.id;

  // 3) Wallet starts at 0
  r = await call('/customer/wallet', { token: cToken });
  ok(r.status === 200 && r.data.balance === 0, 'customer wallet starts at 0');

  // 4) Top-up via QRIS → sim pay → credited
  const topupAmt = 100000;
  r = await call('/customer/topup', { method: 'POST', token: cToken, body: { amount: topupAmt } });
  ok(r.status < 300 && r.data?.reference && r.data?.payment?.qrUrl, 'topup creates QRIS');
  const topupRef = r.data.reference;
  r = await call(`/payments/sim/pay/${topupRef}`, { method: 'POST' });
  ok(r.status < 300, 'sim-pay topup');
  // poll wallet
  let bal = 0;
  for (let i = 0; i < 10; i++) {
    r = await call('/customer/wallet', { token: cToken });
    bal = r.data.balance;
    if (bal >= topupAmt) break;
    await new Promise((res) => setTimeout(res, 300));
  }
  ok(bal === topupAmt, `wallet credited to ${topupAmt} (got ${bal})`);

  // 5) Idempotency: sim-pay the SAME ref again must NOT double-credit
  await call(`/payments/sim/pay/${topupRef}`, { method: 'POST' });
  await new Promise((res) => setTimeout(res, 500));
  r = await call('/customer/wallet', { token: cToken });
  ok(r.data.balance === topupAmt, `idempotent: balance still ${topupAmt} after duplicate pay (got ${r.data.balance})`);

  // 6) Purchase from balance → instant voucher, wallet reduced
  r = await call('/customer/purchase', { method: 'POST', token: cToken, body: { packageId: pkg.id, payWith: 'balance' } });
  ok(r.status < 300 && r.data?.status === 'COMPLETED' && r.data?.voucher?.username, 'balance purchase → voucher');
  const expectAfter = topupAmt - pkg.price;
  ok(r.data?.balance?.balance === expectAfter, `wallet reduced to ${expectAfter} (got ${r.data?.balance?.balance})`);

  // 7) Purchase via QRIS → UNPAID → sim pay → PAID + voucher in inbox
  r = await call('/customer/purchase', { method: 'POST', token: cToken, body: { packageId: pkg2.id, payWith: 'qris' } });
  ok(r.status < 300 && r.data?.reference && r.data?.status === 'UNPAID', 'qris purchase → UNPAID + QR');
  const buyRef = r.data.reference;
  await call(`/payments/sim/pay/${buyRef}`, { method: 'POST' });
  let paid = false;
  for (let i = 0; i < 10; i++) {
    r = await call(`/orders/${buyRef}/status`, {});
    if (r.data?.status === 'PAID' || r.data?.status === 'COMPLETED') {
      paid = true;
      break;
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  ok(paid, 'qris order becomes PAID after sim-pay');

  // 8) Customer inbox has vouchers
  r = await call('/customer/vouchers', { token: cToken });
  ok(r.status === 200 && r.data.length >= 1, `customer inbox has vouchers (${r.data.length})`);

  // 9) Agent + admin (owner) login
  r = await call('/auth/login', { method: 'POST', body: { login: 'sari', password: 'agen123' } });
  ok(r.status < 300 && r.data?.accessToken, 'agent (sari) login');
  const aToken = r.data?.accessToken;
  const agentId = r.data?.agent?.id;
  r = await call('/admin/auth/login', { method: 'POST', body: { login: 'budi', password: 'rahasia123' } });
  ok(r.status < 300 && r.data?.accessToken, 'owner (budi) login');
  const oToken = r.data?.accessToken;

  // 10) Admin tops up agent wallet → balance up
  r = await call('/wallet', { token: aToken });
  const agentBalBefore = r.data?.balance ?? 0;
  r = await call(`/admin/agents/${agentId}/topup`, { method: 'POST', token: oToken, body: { amount: 50000, note: 'e2e' } });
  ok(r.status < 300 && r.data?.balance === agentBalBefore + 50000, `admin topup agent (+50000 → ${r.data?.balance})`);

  // 11) Agent sells a KORLEKO voucher INTO the customer's account
  r = await call('/agent/sell-to-customer', {
    method: 'POST',
    token: aToken,
    body: { customerId, packageId: pkg.id, pin: '4321' },
  });
  ok(r.status < 300 && r.data?.status === 'COMPLETED' && r.data?.voucher?.username, 'agent sell-to-customer → voucher');
  ok(r.data?.deliveredTo === customerId, 'voucher delivered to the customer account');

  // 12) Scoping: agent may NOT sell a non-assigned outlet (TIRTANADI)
  const tir = (await call('/catalog/servers', {})).data.find((s) => s.code === 'TIRTANADI');
  const tirPkgs = (await call(`/catalog/packages?server=${tir.id}`, {})).data;
  if (tirPkgs.length) {
    r = await call('/agent/sell-to-customer', {
      method: 'POST',
      token: aToken,
      body: { customerId, packageId: tirPkgs[0].id, pin: '4321' },
    });
    ok(r.status === 403, `agent blocked from non-assigned outlet (got ${r.status})`);
  } else {
    log('  ~ skip scoping (no TIRTANADI packages)');
  }

  // 13) Owner reports return totals + byDay
  r = await call('/admin/reports', { token: oToken });
  ok(r.status === 200 && typeof r.data?.totals?.revenue === 'number' && Array.isArray(r.data?.byDay), 'owner reports shape');

  log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(2);
});
