import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "POCER Agen",
  description: "POCER Agen — jual voucher, isi saldo, dan pantau penjualan.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" style={{ background: "#0A0A0F" }}>
      <head>
        {/* Inline dark bg on html prevents white flash between navigations */}
        <style>{`html,body{background:#0A0A0F;color-scheme:dark}`}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          {/* On real phones: full-bleed, no stage bg. On desktop: centred phone column. */}
          <div className="min-h-screen bg-[#0A0A0F] sm:bg-stage sm:flex sm:justify-center">
            <div className="w-full sm:max-w-[440px] min-h-screen bg-[#0A0A0F] sm:shadow-phone">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
