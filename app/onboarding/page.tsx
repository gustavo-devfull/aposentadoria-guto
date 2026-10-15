import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureAssetClasses, loadPlan } from "@/db/queries/plan";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { defaultPlanForm } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const [classes, existing] = await Promise.all([ensureAssetClasses(userId), loadPlan(userId)]);
  const defaults = existing ?? defaultPlanForm();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Vamos montar seu plano</h1>
      <OnboardingWizard defaultValues={defaults} classes={classes.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
