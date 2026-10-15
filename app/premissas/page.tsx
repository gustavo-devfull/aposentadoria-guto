import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAssumptionVersions } from "@/db/queries/manage";
import { ensureAssetClasses, loadPlan } from "@/db/queries/plan";
import { AssumptionsView } from "@/components/assumptions-view";
import { classSnapshots } from "@/db/queries/plan";

export const dynamic = "force-dynamic";

export default async function PremissasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const plan = await loadPlan(userId);
  if (!plan) redirect("/onboarding");
  const versions = await listAssumptionVersions(userId);
  // Versões antigas (ex.: criadas pelo seed) podem não ter snapshot de classes: usa o estado atual.
  const current = classSnapshots(await ensureAssetClasses(userId));
  const withClasses = versions.map((v) => (v.classes.length ? v : { ...v, classes: current }));
  return <AssumptionsView versions={withClasses} />;
}
