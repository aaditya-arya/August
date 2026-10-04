import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const viewport: Viewport = {
  themeColor: "#ec4899",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "August — Your Intimate Life Ledger",
  description: "An intimate, reflective personal life ledger and knowledge mirror.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "August",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body className={`${inter.className} bg-[#0b0c10] text-zinc-100 min-h-screen flex selection:bg-rose-500/30 selection:text-rose-200 antialiased`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative min-h-screen bg-[#faf8f9]">
          {children}
        </main>
      </body>
    </html>
  );
}

