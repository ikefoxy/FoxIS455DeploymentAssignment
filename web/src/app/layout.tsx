import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IS455 Shop",
  description: "Order operations and fraud verification (IS 455 deployment lab)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
      >
        <header className="border-b border-zinc-800 bg-zinc-900 text-white shadow-sm">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/customers" className="leading-tight">
              <span className="block text-lg font-semibold tracking-tight">IS455 Shop</span>
              <span className="block text-xs font-medium text-zinc-400">
                Order operations &amp; fraud review
              </span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm font-medium">
              <Link className="text-zinc-200 hover:text-white" href="/customers">
                Customers
              </Link>
              <Link className="text-zinc-200 hover:text-white" href="/admin/orders">
                Order history
              </Link>
              <Link className="text-zinc-200 hover:text-white" href="/admin/priority">
                Verification queue
              </Link>
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</div>

        <footer className="mt-auto border-t border-zinc-200 bg-white py-4 text-sm text-zinc-500">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
            <span>IS 455 · Machine learning deployment lab</span>
            <Link className="text-zinc-500 hover:text-zinc-800" href="/privacy">
              Privacy
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
