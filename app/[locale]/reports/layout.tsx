import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/dashboard/AppSidebar";
import Header from "@/components/dashboard/Header";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <div className="no-print"><AppSidebar /></div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="no-print"><Header user={session.user} /></div>
        <main className="flex-1 p-6">{children}</main>
        <footer className="no-print border-t px-6 py-3 text-xs text-muted-foreground text-center">
          © 2026 SEOBrief
        </footer>
      </div>
    </div>
  );
}
