import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Дашборд</h1>
      <p className="text-muted-foreground">Привет, {session.user.name ?? session.user.email}!</p>
    </main>
  );
}
