import type { AssetClassInput, Scenario, TaxRegime } from "./schema";

/** Definição de classe com retornos por cenário (retorno real líquido de custos). */
export interface AssetClassTemplate {
  id: string;
  name: string;
  returns: Record<Scenario, number>;
  /** IPCA+/RendA+ já comprados: vale nos três cenários. */
  contractedRealRate?: number;
  annualCost: number;
  taxRegime: TaxRegime;
  taxRateOverride?: number;
  /** Volatilidade real anual (Monte Carlo, Fase 2). */
  volatility: number;
}

export const DEFAULT_INFLATION = 0.035; // Boletim Focus (BCB) — atualizar periodicamente

export const DEFAULT_ASSET_CLASSES: AssetClassTemplate[] = [
  { id: "pos-fixado", name: "Pós-fixado / CDI", returns: { pessimista: 0.03, base: 0.04, otimista: 0.05 }, annualCost: 0, taxRegime: "renda_fixa_regressivo", volatility: 0.01 },
  { id: "ipca-mais", name: "IPCA+ / RendA+", returns: { pessimista: 0.05, base: 0.05, otimista: 0.05 }, contractedRealRate: 0.05, annualCost: 0, taxRegime: "renda_fixa_regressivo", volatility: 0.04 },
  { id: "acoes-br", name: "Ações Brasil", returns: { pessimista: 0.03, base: 0.055, otimista: 0.07 }, annualCost: 0, taxRegime: "acoes_15", volatility: 0.22 },
  { id: "fiis", name: "FIIs", returns: { pessimista: 0.03, base: 0.045, otimista: 0.06 }, annualCost: 0, taxRegime: "isento", volatility: 0.15 },
  { id: "exterior", name: "Exterior", returns: { pessimista: 0.025, base: 0.045, otimista: 0.06 }, annualCost: 0, taxRegime: "acoes_15", volatility: 0.18 },
  { id: "previdencia", name: "Previdência", returns: { pessimista: 0.025, base: 0.035, otimista: 0.045 }, annualCost: 0, taxRegime: "pgbl_regressivo", volatility: 0.04 },
];

export function resolveClasses(templates: AssetClassTemplate[], scenario: Scenario): AssetClassInput[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    realReturn: t.contractedRealRate ?? t.returns[scenario],
    annualCost: t.annualCost,
    taxRegime: t.taxRegime,
    ...(t.taxRateOverride !== undefined ? { taxRateOverride: t.taxRateOverride } : {}),
  }));
}

/** Premissas do INSS 2026 (editáveis). */
export const DEFAULT_INSS_PARAMS = {
  minimumWage: 1621,
  ceiling: 8475.55,
  ageRule: 65,
  minContributionYears: 15,
};
