"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, TicketIcon, ReceiptIcon, UserIcon } from "./icons";

const items = [
  { href: "/beranda", label: "Beranda", Icon: HomeIcon },
  { href: "/voucher", label: "Voucher", Icon: TicketIcon },
  { href: "/riwayat", label: "Riwayat", Icon: ReceiptIcon },
  { href: "/akun", label: "Akun", Icon: UserIcon },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-line">
      <div className="grid grid-cols-4 px-2 py-2">
        {items.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-1 transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 2}
                className={active ? "text-azure" : "text-dim"}
              />
              <span
                className={`text-[11px] tracking-tight ${
                  active ? "font-bold text-azure" : "font-medium text-dim"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
