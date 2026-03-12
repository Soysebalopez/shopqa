import type { Metadata } from "next";
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
  title: "ShopQA — Automated QA for Shopify",
  description:
    "Automated quality assurance for Shopify stores. Compare Figma designs with web implementation and get comprehensive QA reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background min-h-screen`}
      >
        <header className="border-b">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-bold text-xl tracking-tight">
              Shop<span className="text-primary">QA</span>
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:text-primary transition-colors">
                Dashboard
              </a>
              <a href="/new" className="hover:text-primary transition-colors">
                New Report
              </a>
              <a
                href="/history"
                className="hover:text-primary transition-colors"
              >
                History
              </a>
            </nav>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
