import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/settings/ProfileForm";
import PasswordForm from "@/components/settings/PasswordForm";
import DangerZone from "@/components/settings/DangerZone";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("Settings");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, image: true,
      plan: true, reportsUsed: true, reportsLimit: true,
      password: true,
    },
  });

  if (!user) redirect("/login");

  const hasPassword = !!user.password;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t("profileTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("profileDesc")}</p>
        </div>
        <Separator />
        <ProfileForm name={user.name ?? ""} email={user.email} image={user.image} />
      </section>

      {hasPassword && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">{t("passwordTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("passwordDesc")}</p>
          </div>
          <Separator />
          <PasswordForm />
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t("planTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("planDesc")}</p>
        </div>
        <Separator />
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("planTitle")}</span>
            <span className="font-semibold capitalize">{user.plan.toLowerCase()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("planDesc")}</span>
            <span className="font-medium">
              {user.reportsUsed} / {user.reportsLimit === -1 ? "∞" : user.reportsLimit}
            </span>
          </div>
          {user.reportsLimit > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min((user.reportsUsed / user.reportsLimit) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
