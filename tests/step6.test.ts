import { describe, expect, it } from "vitest";
import { annualTableToCsv } from "@/lib/csv";
import { compareSimulations, type CompareItem } from "@/lib/compare";
import { runSimulation } from "@/lib/engine";
import { planToInput } from "@/lib/plan";
import { trackAgainstPlan, type SnapshotInput } from "@/lib/tracking";
import { defaultDemo } from "./plan-fixture";

const plan = defaultDemo(); // início 10/2026
const input = planToInput(plan, 65);
const probe = trackAgainstPlan(input, []);
const projected = (key: string) => probe.projectedSeries.find((p) => p.key === key)!.projected;
const snap = (year: number, month: number, total: number, contribution = 4000): SnapshotInput => ({
  year, month, balances: { a: total * 0.6, b: total * 0.4 }, contribution, note: null,
});

describe("acompanhamento: realizado vs projetado", () => {
  it("projeção em nominal usa a inflação da simulação", () => {
    const real = runSimulation(input, { solve: false }).serieMensal[0]!;
    expect(projected("2026-10")).toBeCloseTo(real.closing * Math.pow(1 + input.inflation, 1 / 12), 6);
  });
  it("realizado igual ao plano → desvio 0 e sem alerta", () => {
    const r = trackAgainstPlan(input, [snap(2027, 3, projected("2027-03"))]);
    expect(r.rows[0]!.deviation).toBeCloseTo(0, 6);
    expect(r.alert).toBe(false);
  });
  it("mais de 10% abaixo do plano dispara alerta; 9% não", () => {
    const at = projected("2027-06");
    expect(trackAgainstPlan(input, [snap(2027, 6, at * 0.89)]).alert).toBe(true);
    const ok = trackAgainstPlan(input, [snap(2027, 6, at * 0.91)]);
    expect(ok.alert).toBe(false);
    expect(ok.rows[0]!.deviationPct).toBeCloseTo(-0.09, 6);
  });
  it("o alerta olha o último lançamento (recuperou → sem alerta)", () => {
    const r = trackAgainstPlan(input, [snap(2027, 1, projected("2027-01") * 0.8), snap(2027, 2, projected("2027-02") * 1.0)]);
    expect(r.rows[0]!.below).toBe(true);
    expect(r.alert).toBe(false);
  });
  it("ignora lançamentos fora da janela e contas excluídas do plano", () => {
    const r = trackAgainstPlan(input, [snap(2020, 1, 1), snap(2027, 1, projected("2027-01"))], { includedAccountIds: new Set(["a", "b"]) });
    expect(r.rows).toHaveLength(1);
    const only = trackAgainstPlan(input, [snap(2027, 1, 1000)], { includedAccountIds: new Set(["a"]) });
    expect(only.rows[0]!.realized).toBeCloseTo(600, 8);
  });
  it("aportes acumulados: realizado vs planejado desde o 1º lançamento", () => {
    const r = trackAgainstPlan(input, [snap(2027, 1, 1e6, 4000), snap(2027, 2, 1e6, 1000), snap(2027, 3, 1e6, 0)]);
    expect(r.rows.map((x) => x.contributionRealizedCum)).toEqual([4000, 5000, 5000]);
    // plano: 4.000/mês reais corrigidos pela inflação → ligeiramente acima de 4.000 por mês
    expect(r.rows[2]!.contributionProjectedCum).toBeGreaterThan(12_000);
    expect(r.rows[2]!.contributionProjectedCum).toBeLessThan(12_500);
  });
});

describe("tabela anual → CSV", () => {
  const res = runSimulation(input, { solve: false });
  it("cabeçalho, uma linha por idade, formato pt-BR e BOM", () => {
    const csv = annualTableToCsv(res.tabelaAnual, "real");
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Idade;Saldo inicial;Aportes;Rendimentos;Saques (bruto);IR;Rendas externas;Saldo final");
    expect(lines).toHaveLength(res.tabelaAnual.length + 1);
    expect(lines[1]!.split(";")).toHaveLength(8);
    expect(lines[1]).toMatch(/^51;\d+,\d{2};/);
  });
  it("modo nominal difere do real", () => {
    expect(annualTableToCsv(res.tabelaAnual, "nominal")).not.toBe(annualTableToCsv(res.tabelaAnual, "real"));
  });
});

describe("comparar simulações", () => {
  const mk = (id: string, age: number, monthly: number): CompareItem => {
    const inp = planToInput({ ...plan, contribution: { monthly, realGrowth: 0 } }, age);
    const r = runSimulation(inp, { solve: false });
    return {
      id, nome: id, input: inp,
      resumo: { retirementAge: age, patrimonioProjetado: r.patrimonioProjetado, patrimonioNecessario: r.patrimonioNecessario, gap: r.gap, aporteMensalNecessario: null, rendaSustentavel: null, idadeEsgotamento: r.idadeEsgotamento, ponteShare: r.ponte?.shareOfPortfolio ?? null },
    };
  };
  const out = compareSimulations([mk("A", 60, 4000), mk("B", 65, 4000), mk("C", 65, 6000)]);
  it("marca apenas as premissas que diferem", () => {
    const d = Object.fromEntries(out.premissas.map((r) => [r.key, r.differs]));
    expect(d.retirementAge).toBe(true);
    expect(d.monthly).toBe(true);
    expect(d.inflation).toBe(false);
    expect(d.expenses).toBe(false);
  });
  it("resultados vêm um por simulação, na ordem", () => {
    const proj = out.resultados.find((r) => r.key === "proj")!;
    expect(proj.values).toHaveLength(3);
    expect(proj.differs).toBe(true);
    expect(out.resultados.find((r) => r.key === "ponte")!.values[1]).toBe("sem ponte");
  });
});
