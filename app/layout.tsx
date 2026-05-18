import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import StoreProvider from "@/components/providers/StoreProvider";
import SessionProvider from "@/components/providers/SessionProvider";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SEO Brief Generator",
  description: "Введи URL страницы — получи готовое ТЗ для копирайтера за минуту.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={cn(geistSans.variable, geistMono.variable)}>
      <body className="font-sans antialiased">
          <SessionProvider>
            <StoreProvider>{children}</StoreProvider>
          </SessionProvider>
        </body>
    </html>
  );
}
