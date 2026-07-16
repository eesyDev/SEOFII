import { auth } from "@/lib/auth";
import AppSidebar from "@/components/dashboard/AppSidebar";
import Header from "@/components/dashboard/Header";

// НЕ редиректим здесь: layout не видит ?share=, а публичный отчёт по share-токену
// должен открываться без логина. Гостю рендерим детей без хрома (чистый отчёт),
// а сами страницы (список, новый отчёт) enforce-ят авторизацию у себя.
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return <main className="min-h-screen">{children}</main>;
  }

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
