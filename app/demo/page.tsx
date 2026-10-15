import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { Simulator } from "@/components/simulator";
import { PortfolioView } from "@/components/portfolio-view";
import { IncomeExpenseView } from "@/components/income-expense-view";
import { AssumptionsView } from "@/components/assumptions-view";
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
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Dados fictícios de demonstração.</p>
      {view === "simulador" ? <Simulator plan={plan} saved={[]} canSave={false} />
        : view === "carteira" ? <PortfolioView plan={plan} />
        : view === "renda" ? <IncomeExpenseView plan={plan} />
        : view === "premissas" ? <AssumptionsView versions={[v2, v1]} />
        : <Dashboard plan={plan} />}
    </div>
  );
}
