import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "./Sidebar";

export default async function AppSidebar() {
  const session = await auth();

  let reportsUsed = 0;
  let reportsLimit = 3;
  let plan = "FREE";

  const userId = session?.user?.id;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reportsUsed: true, reportsLimit: true, plan: true },
    });
    if (user) {
      reportsUsed = user.reportsUsed;
      reportsLimit = user.reportsLimit;
      plan = user.plan;
    }
  }

  return <Sidebar reportsUsed={reportsUsed} reportsLimit={reportsLimit} plan={plan} />;
}
