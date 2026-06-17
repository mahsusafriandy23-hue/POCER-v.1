// READ-ONLY verification that the payment QR builder routes per-outlet QRIS.
// Calls the REAL compiled GobizPaymentProvider with the qrisText resolved from each
// outlet's assigned QRIS account, then inspects the built payload (NMID + amount).
// No money moves and no scannable QR is shown — it only prints payload facts.
const { PrismaClient } = require('@prisma/client');
const { GobizPaymentProvider } = require('../dist/modules/payments/providers/gobiz-payment.provider');

function parseTlv(s) {
  const m = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const t = s.substr(i, 2);
    const l = parseInt(s.substr(i + 2, 2), 10);
    if (Number.isNaN(l) || i + 4 + l > s.length) break;
    m[t] = s.substr(i + 4, l);
    i += 4 + l;
  }
  return m;
}
function nmidOf(payload) {
  const top = parseTlv(payload);
  for (let t = 26; t <= 51; t++) {
    const tag = String(t).padStart(2, '0');
    if (!top[tag]) continue;
    const sub = parseTlv(top[tag]);
    if (sub['02']) return sub['02'];
  }
  return null;
}
function merchantOf(payload) {
  return parseTlv(payload)['59'] || null;
}

(async () => {
  const prisma = new PrismaClient();
  const prov = new GobizPaymentProvider({ get: () => undefined });
  const amount = 10123;
  for (const code of process.argv.slice(2)) {
    const srv = await prisma.server.findUnique({
      where: { code },
      select: { qrisAccount: { select: { label: true, qrisText: true, isActive: true } } },
    });
    const acc = srv && srv.qrisAccount;
    const qrisText = acc && acc.isActive ? acc.qrisText : undefined;
    const label = (acc ? acc.label : '(no QRIS, fallback global)').padEnd(8);
    try {
      const built = await prov.buildQr({ reference: 'CHECK', originalAmount: 10000, totalAmount: amount, ttlMs: 600000, qrisText });
      const p = built.payload || '';
      console.log(
        `${code.padEnd(11)} → ${label}` +
          ` | merchant=${merchantOf(p)} | NMID=${nmidOf(p)}` +
          ` | amount(5405${amount})=${p.includes('5405' + amount)} | dynamic=${p.includes('010212')}`,
      );
    } catch (e) {
      console.log(`${code.padEnd(11)} → ${label} | ⚠️  ${e.message} (payload QRIS tak valid)`);
    }
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
