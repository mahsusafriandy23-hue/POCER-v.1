import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "POCER",
  description: "Beli voucher WiFi POCER — cepat, mudah, langsung ke akunmu.",
};

export const viewport: Viewport = {
  themeColor: "#1E6BFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/*
          Font loaded by the browser (not downloaded by the dev server at build
          time) so the app still runs cleanly when the machine is offline.
          When online the browser fetches Plus Jakarta Sans; otherwise the
          CSS fallback chain (system-ui) is used automatically.
        */}
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
          <div className="min-h-screen bg-[#F4F8FF] sm:bg-stage sm:flex sm:justify-center">
            <div className="w-full sm:max-w-[440px] min-h-screen bg-[#F4F8FF] sm:shadow-phone">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
