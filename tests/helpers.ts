import { parseSimulationInput, type SimulationInputDraft } from "@/lib/engine";

export const CLS_ZERO = { id: "a", name: "Classe A", realReturn: 0, annualCost: 0, taxRegime: "isento" as const };

/** Hoje = 10/2026, nascimento em 10/1975 → 51 anos. */
export function make(over: Partial<SimulationInputDraft> = {}) {
  return parseSimulationInput({
    startDate: "2026-10",
    birthDate: "1975-10-15",
    retirementAge: 61,
    horizonAge: 95,
    classes: [CLS_ZERO],
    ...over,
  });
}

export const plan = (monthly: number, extra: Record<string, unknown> = {}) => ({
  monthly,
  realGrowth: 0,
  start: "2026-10",
  end: null,
  allocation: { a: 1 },
  ...extra,
});
