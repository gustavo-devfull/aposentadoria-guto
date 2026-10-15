import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadPlan } from "@/db/queries/plan";
import { AnnualTableView } from "@/components/annual-table-view";

export const dynamic = "force-dynamic";

export default async function TabelaAnualPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const plan = await loadPlan(session.user.id);
  if (!plan) redirect("/onboarding");
  return <AnnualTableView plan={plan} />;
}
