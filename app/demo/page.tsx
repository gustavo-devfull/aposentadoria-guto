import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { defaultPlanForm, withPlanDefaults } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** Dashboard com dados fictícios, sem login nem banco. Desligado em produção. */
export default function DemoPage() {
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
  );
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Dados fictícios de demonstração.</p>
      <Dashboard plan={plan} />
    </div>
  );
}
