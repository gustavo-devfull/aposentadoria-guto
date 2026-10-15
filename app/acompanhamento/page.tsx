import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadPlan } from "@/db/queries/plan";
import { listSimulations } from "@/db/queries/simulations";
import { getReference, listSnapshots } from "@/db/queries/tracking";
import { TrackingView } from "@/components/tracking-view";
import { trackAgainstPlan } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export default async function AcompanhamentoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const plan = await loadPlan(userId);
  if (!plan) redirect("/onboarding");
  const [snapshots, reference, sims] = await Promise.all([listSnapshots(userId), getReference(userId), listSimulations(userId)]);
  const accounts = plan.accounts.flatMap((a) => (a.id ? [{ id: a.id, name: a.name, balance: a.balance, included: a.included }] : []));
  const tracking = reference
    ? trackAgainstPlan(reference.input, snapshots, { includedAccountIds: new Set(accounts.filter((a) => a.included).map((a) => a.id)) })
    : null;
  return (
    <TrackingView
      accounts={accounts} snapshots={snapshots} tracking={tracking}
      simulations={sims.map((s) => ({ id: s.id, nome: s.nome, retirementAge: s.resumo.retirementAge }))}
      referenceId={reference?.id ?? null} referenceName={reference?.nome ?? null}
    />
  );
}
