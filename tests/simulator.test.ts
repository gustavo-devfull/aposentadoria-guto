import { describe, expect, it } from "vitest";
import { runSimulation } from "@/lib/engine";
import { defaultDemo } from "./plan-fixture";
import { defaultOverrides, overridesToInput, totalDesired } from "@/lib/simulator";

describe("simulador: ajustes sobre o plano", () => {
  const plan = defaultDemo();
  const base = defaultOverrides(plan);

  it("sem ajustes reproduz o plano", () => {
    const a = runSimulation(overridesToInput(plan, base), { solve: false });
    expect(a.retirementAge).toBe(60);
    expect(a.patrimonioProjetado).toBeGreaterThan(0);
  });
  it("mais aporte → mais patrimônio; mais renda desejada → mais necessário", () => {
    const b = runSimulation(overridesToInput(plan, base), { solve: false });
    const more = runSimulation(overridesToInput(plan, { ...base, monthlyContribution: base.monthlyContribution + 1000 }), { solve: false });
    const spend = runSimulation(overridesToInput(plan, { ...base, desiredIncome: totalDesired(plan) * 1.5 }), { solve: false });
    expect(more.patrimonioProjetado).toBeGreaterThan(b.patrimonioProjetado);
    expect(spend.patrimonioNecessario).toBeGreaterThan(b.patrimonioNecessario);
  });
  it("retorno real maior → patrimônio maior; inflação só muda o nominal", () => {
    const b = runSimulation(overridesToInput(plan, base), { solve: false });
    const up = runSimulation(overridesToInput(plan, { ...base, returnShift: 0.01 }), { solve: false });
    const infl = runSimulation(overridesToInput(plan, { ...base, inflation: 0.08 }), { solve: false });
    expect(up.patrimonioProjetado).toBeGreaterThan(b.patrimonioProjetado);
    expect(infl.patrimonioProjetado).toBeCloseTo(b.patrimonioProjetado, 6);
    expect(infl.tabelaAnual[3]!.closing.nominal).toBeGreaterThan(b.tabelaAnual[3]!.closing.nominal);
  });
  it("taxa contratada não sofre o deslocamento de retorno", () => {
    const input = overridesToInput(plan, { ...base, returnShift: 0.02 });
    expect(input.classes.find((c) => c.id === "ipca-mais")!.realReturn).toBeCloseTo(0.05, 10);
    expect(input.classes.find((c) => c.id === "acoes-br")!.realReturn).toBeCloseTo(0.075, 10);
  });
});
