import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { Simulator } from "@/components/simulator";
import { CompareView } from "@/components/compare-view";
import { MonthlyView } from "@/components/monthly-view";
import { defaultPlan, type PlanInput } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** Telas com dados fictícios, sem login nem banco. Desligado em produção. */
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO !== "1") notFound();
  const plan: PlanInput = { ...defaultPlan(), birthDate: "1975-10-15", invested: 800_000, monthly: 4_000 };
  const scenarios = [
    { id: "a", nome: "Poupança", createdAt: "2026-10-05T12:00:00Z", input: { ...plan, annualRate: 0.0617 } },
    { id: "b", nome: "CDB 12%", createdAt: "2026-10-05T12:00:00Z", input: plan },
    { id: "c", nome: "CDB 12% + R$ 6 mil/mês", createdAt: "2026-10-05T12:00:00Z", input: { ...plan, monthly: 6_000 } },
  ];
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn-fg">Dados fictícios de demonstração.</p>
      {view === "simulador" ? <Simulator initial={plan} hasPlan canSave={false} />
        : view === "mes" ? <MonthlyView plan={plan} simHref="/demo?view=simulador" />
        : view === "comparar" ? <CompareView scenarios={scenarios} canDelete={false} />
        : <Dashboard plan={plan} editHref="/demo?view=simulador" monthlyHref="/demo?view=mes" />}
    </div>
  );
}
