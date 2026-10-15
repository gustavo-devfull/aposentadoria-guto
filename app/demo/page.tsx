import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { Simulator } from "@/components/simulator";
import { PortfolioView } from "@/components/portfolio-view";
import { IncomeExpenseView } from "@/components/income-expense-view";
import { AssumptionsView } from "@/components/assumptions-view";
import { AnnualTableView } from "@/components/annual-table-view";
import { CompareView } from "@/components/compare-view";
import { TrackingView } from "@/components/tracking-view";
import { runSimulation } from "@/lib/engine";
import { planToInput } from "@/lib/plan";
import { trackAgainstPlan } from "@/lib/tracking";
import type { AssumptionVersion } from "@/lib/assumptions";
import { defaultPlanForm, withPlanDefaults } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** Dashboard com dados fictícios, sem login nem banco. Desligado em produção. */
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO !== "1") notFound();
  const form = defaultPlanForm();
  const plan = withPlanDefaults(
    {
      ...form,
      accounts: [
        { name: "Tesouro IPCA+", classId: "ipca-mais", balance: 400_000, costBasis: 250_000, included: true },
        { name: "Ações", classId: "acoes-br", balance: 250_000, costBasis: 180_000, included: true },
        { name: "PGBL", classId: "previdencia", balance: 150_000, costBasis: 150_000, included: true },
      ],
      contribution: { monthly: 4_000, realGrowth: 0 },
    },
    {
      extras: [{ description: "13º", amount: 8_000, month: 12, year: null, yearly: true }],
      pauses: [{ from: "2027-03", to: "2027-05", reason: "Projeto parado" }],
      otherIncomes: [{ type: "aluguel", description: "Sala comercial", monthly: 2_000, startAge: 60, endAge: null, realGrowth: 0, taxable: true }],
    },
  );
  const snap = plan.classes.map((c) => ({ id: c.id, name: c.name, pessimista: c.returns.pessimista, base: c.returns.base, otimista: c.returns.otimista, contracted: c.contractedRealRate ?? null, annualCost: c.annualCost }));
  const v1: AssumptionVersion = { versao: 1, createdAt: "2026-03-10T12:00:00Z", nome: "Premissas base", inflation: 0.035, scenario: "base", method: "consumir_ate_horizonte", redemptionOrder: "proporcional", fixedWithdrawalRate: 0.04, minimumWage: 1621, ceiling: 8475.55, notes: null, classes: snap };
  const v2: AssumptionVersion = { ...v1, versao: 2, createdAt: "2026-10-01T12:00:00Z", inflation: 0.04, scenario: "pessimista", classes: snap.map((c) => (c.id === "acoes-br" ? { ...c, base: 0.05 } : c)) };
  const accs = plan.accounts.map((a, i) => ({ ...a, id: `acc-${i}` }));
  const refInput = planToInput(plan, 60);
  const probe = trackAgainstPlan(refInput, []);
  const proj = (k: string) => probe.projectedSeries.find((p) => p.key === k)!.projected;
  const mkSnap = (y: number, m: number, f: number) => {
    const total = proj(`${y}-${String(m).padStart(2, "0")}`) * f;
    return { year: y, month: m, balances: { "acc-0": total * 0.5, "acc-1": total * 0.3125, "acc-2": total * 0.1875 }, contribution: 4000, note: null };
  };
  const snaps = [mkSnap(2027, 1, 1.01), mkSnap(2027, 2, 0.97), mkSnap(2027, 3, 0.93), mkSnap(2027, 4, 0.88)];
  const tracking = trackAgainstPlan(refInput, snaps);
  const mkSim = (id: string, nome: string, age: number, monthly: number) => {
    const inp = planToInput({ ...plan, contribution: { monthly, realGrowth: 0 } }, age);
    const r = runSimulation(inp, { solve: false });
    return { id, nome, createdAt: "2026-10-05T12:00:00Z", input: inp, resumo: { retirementAge: age, patrimonioProjetado: r.patrimonioProjetado, patrimonioNecessario: r.patrimonioNecessario, gap: r.gap, aporteMensalNecessario: null, rendaSustentavel: null, idadeEsgotamento: r.idadeEsgotamento, ponteShare: r.ponte?.shareOfPortfolio ?? null } };
  };
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Dados fictícios de demonstração.</p>
      {view === "simulador" ? <Simulator plan={plan} saved={[]} canSave={false} />
        : view === "carteira" ? <PortfolioView plan={plan} />
        : view === "renda" ? <IncomeExpenseView plan={plan} />
        : view === "acompanhamento" ? <TrackingView accounts={accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance, included: a.included }))} snapshots={snaps} tracking={tracking} simulations={[{ id: "s1", nome: "Plano aos 60", retirementAge: 60 }]} referenceId="s1" referenceName="Plano aos 60" canSave={false} />
        : view === "tabela" ? <AnnualTableView plan={plan} />
        : view === "comparar" ? <CompareView sims={[mkSim("a", "Aos 60", 60, 4000), mkSim("b", "Aos 65", 65, 4000), mkSim("c", "Aos 65 + aporte", 65, 6000)]} />
        : view === "premissas" ? <AssumptionsView versions={[v2, v1]} />
        : <Dashboard plan={plan} />}
    </div>
  );
}
