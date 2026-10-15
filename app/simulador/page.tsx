import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadPlan } from "@/db/queries/plan";
import { listSimulations } from "@/db/queries/simulations";
import { Simulator } from "@/components/simulator";

export const dynamic = "force-dynamic";

export default async function SimuladorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const plan = await loadPlan(session.user.id);
  if (!plan) redirect("/onboarding");
  const saved = (await listSimulations(session.user.id)).map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
  return <Simulator plan={plan} saved={saved} />;
}
