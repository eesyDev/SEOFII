import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getLocale } from "next-intl/server";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "SEOBrief", template: "%s — SEOBrief" },
  description: "SEO competitor analysis, keyword gap and ready content in minutes. Powered by Claude AI.",
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={cn(geistSans.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
