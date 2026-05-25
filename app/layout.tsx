import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import StoreProvider from "@/components/providers/StoreProvider";
import SessionProvider from "@/components/providers/SessionProvider";
import ThemeProvider from "@/components/providers/ThemeProvider";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "SEOBrief", template: "%s — SEOBrief" },
  description:
    "SEO-анализ конкурентов, gap-ключи и готовый контент для сайта за минуту. Powered by Claude AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={cn(geistSans.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <SessionProvider>
            <StoreProvider>{children}</StoreProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
