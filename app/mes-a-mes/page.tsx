import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadPlan } from "@/db/queries/plan";
import { MonthlyView } from "@/components/monthly-view";

export const dynamic = "force-dynamic";

export default async function MesAMesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <MonthlyView plan={await loadPlan(session.user.id)} />;
}
