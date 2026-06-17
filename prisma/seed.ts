/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// COMBINED catalog: POCER + POCER. Idempotent (upsert/find-or-create) — running
// this never deletes existing rows, only adds what's missing. Prices in integer rupiah.
// `active` mirrors is_active (inactive packages exist but aren't sold on the storefront).
const SERVERS = [
  // POCER
  { code: 'KORLEKO', name: 'KORLEKO', sortOrder: 1 },
  { code: 'TIRTANADI', name: 'TIRTANADI', sortOrder: 2 },
  { code: 'TEMANJOR', name: 'TEMANJOR', sortOrder: 3 },
  // POCER
  { code: 'GUNUNGSARI', name: 'Gunungsari', sortOrder: 4 },
  { code: 'LABUAPI', name: 'Labuapi', sortOrder: 5 },
  { code: 'SELAPARANG', name: 'Selaparang', sortOrder: 6 }, // no packages yet
];

type Pkg = { server: string; name: string; price: number; duration: string; profile: string; active: boolean };
const PACKAGES: Pkg[] = [
  // ── POCER ──
  { server: 'KORLEKO', name: 'PAKET 50000', price: 50000, duration: '30d', profile: '50000-ONLINE', active: true },
  { server: 'KORLEKO', name: 'PAKET 15000', price: 15000, duration: '7d', profile: '15000-ONLINE', active: true },
  { server: 'KORLEKO', name: 'PAKET 5000', price: 5000, duration: '2d', profile: '5000-ONLINE', active: true },
  { server: 'KORLEKO', name: 'PAKET 30000', price: 30000, duration: '30d', profile: '30000-ONLINE', active: true },
  { server: 'KORLEKO', name: '1jam', price: 1000, duration: '1h', profile: '1jam', active: true },
  { server: 'KORLEKO', name: '2jam', price: 2000, duration: '2h', profile: '2jam', active: true },
  { server: 'TIRTANADI', name: 'PAKET 55.000', price: 55000, duration: '30d', profile: 'paket-50', active: true },
  { server: 'TIRTANADI', name: 'PAKET 30.000', price: 30000, duration: '30d', profile: 'paket-25', active: true },
  { server: 'TIRTANADI', name: 'PAKET 5.000', price: 5000, duration: '2d', profile: '24jam', active: true },
  { server: 'TIRTANADI', name: '2jam', price: 2000, duration: '2h', profile: '2jam', active: true },
  { server: 'TEMANJOR', name: '1jam', price: 1000, duration: '1h', profile: '1jam', active: true },
  { server: 'TEMANJOR', name: '24jam', price: 5000, duration: '24h', profile: '24jam', active: true },
  { server: 'TEMANJOR', name: '2jam', price: 2000, duration: '2h', profile: '2jam', active: true },
  { server: 'TEMANJOR', name: 'MINGGUAN', price: 15000, duration: '7d', profile: 'SEMINGGU-15.000', active: true },
  { server: 'TEMANJOR', name: 'paket-50-sebulan', price: 50000, duration: '30d', profile: 'paket-50-sebulan', active: true },
  // ── POCER (Gunungsari) ──
  { server: 'GUNUNGSARI', name: 'DEVTES', price: 50, duration: '1m', profile: 'TRIAL', active: false },
  { server: 'GUNUNGSARI', name: 'SONIC', price: 1000, duration: '3h', profile: 'VOUCHER-SONIC/REG-1K', active: false },
  { server: 'GUNUNGSARI', name: 'NEMBAK', price: 1000, duration: '2h', profile: 'VOUCHER-NEMBAK/REG-1K', active: true },
  { server: 'GUNUNGSARI', name: 'FLEX', price: 2000, duration: '12h', profile: 'VOUCHER-FLEX/REG-2K', active: false },
  { server: 'GUNUNGSARI', name: 'SANTAI', price: 2000, duration: '10h', profile: 'VOUCHER-SANTAI/REG-2K', active: true },
  { server: 'GUNUNGSARI', name: 'LITE', price: 3000, duration: '24h', profile: 'VOUCHER-LITE/REG-3K', active: true },
  { server: 'GUNUNGSARI', name: 'MAX', price: 5000, duration: '1d', profile: 'VOUCHER-MAX/PRM-5K', active: false },
  { server: 'GUNUNGSARI', name: 'BEBAS', price: 5000, duration: '2d', profile: 'VOUCHER-BEBAS/PRM-5K', active: true },
  { server: 'GUNUNGSARI', name: 'MINGGUAN', price: 7000, duration: '7d', profile: 'VOUCHER-MINGGUAN/PRM-7K', active: false },
  { server: 'GUNUNGSARI', name: 'Hemat 10rb (3 Voucher)', price: 10000, duration: '3 voucher', profile: 'BUNDLE', active: false },
  { server: 'GUNUNGSARI', name: 'JUMBO', price: 10000, duration: '10d', profile: 'VOUCHER-JUMBO/PRM-10K', active: false },
  { server: 'GUNUNGSARI', name: 'BULANAN-50K', price: 50000, duration: '30d', profile: 'VOUCHER-BULANAN-50K/30D', active: true },
  // ── POCER (Labuapi) ──
  { server: 'LABUAPI', name: 'TRIAL', price: 1000, duration: '1m', profile: 'TRIAL', active: false },
  { server: 'LABUAPI', name: '5K-SEHARI', price: 5000, duration: '1d', profile: '5K-SEHARI', active: true },
  { server: 'LABUAPI', name: '15K-1MINGGU', price: 15000, duration: '7d', profile: '15K-1MINGGU', active: true },
  { server: 'LABUAPI', name: '50K-1BULAN', price: 50000, duration: '30d', profile: '50K-1BULAN', active: true },
  // SELAPARANG — no packages yet
];

async function main() {
  const byCode = new Map<string, number>();
  for (const s of SERVERS) {
    const row = await prisma.server.upsert({
      where: { code: s.code },
      update: { name: s.name, sortOrder: s.sortOrder, isActive: true },
      create: { code: s.code, name: s.name, sortOrder: s.sortOrder, mikrotikPort: 8728 },
    });
    byCode.set(s.code, row.id);
  }
  console.log(`seeded/updated ${byCode.size} servers`);

  let created = 0;
  for (const p of PACKAGES) {
    const serverId = byCode.get(p.server)!;
    const existing = await prisma.package.findFirst({
      where: { serverId, name: p.name, mikrotikProfile: p.profile },
    });
    if (existing) continue;
    await prisma.package.create({
      data: { serverId, name: p.name, price: p.price, duration: p.duration, mikrotikProfile: p.profile, isActive: p.active },
    });
    created++;
  }
  console.log(`added ${created} new packages (${PACKAGES.length} in combined catalog)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
