import { defaultPlanForm, withPlanDefaults } from "@/lib/plan";

export function defaultDemo() {
  return withPlanDefaults({
    ...defaultPlanForm(),
    accounts: [
      { name: "Tesouro IPCA+", classId: "ipca-mais", balance: 400_000, costBasis: 250_000, included: true },
      { name: "Ações", classId: "acoes-br", balance: 250_000, costBasis: 180_000, included: true },
    ],
    contribution: { monthly: 4_000, realGrowth: 0 },
  }, { startDate: "2026-10" });
}
