import { IntentionsBar } from "@/components/IntentionsBar";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { themeInitScript } from "@/lib/theme";

const dmSans = localFont({
  src: "./fonts/dm-sans-latin-variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-dm-sans",
});

const lora = localFont({
  src: [
    { path: "./fonts/lora-latin-variable.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/lora-latin-variable-italic.woff2", weight: "400 700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-lora",
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
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${dmSans.variable} ${lora.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground min-h-screen flex flex-col md:flex-row selection:bg-rose-500/30 selection:text-rose-900 dark:selection:text-rose-200 antialiased">
        <Sidebar />
        <main className="flex-1 min-w-0 relative min-h-screen bg-background md:h-dvh md:min-h-0 md:overflow-y-auto">
          <IntentionsBar />
          {children}
        </main>
      </body>
    </html>
  );
}

