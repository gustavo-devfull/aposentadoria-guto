import { z } from "zod";

export const inssIncreaseScenarioSchema = z.object({
  /** Novo salário de contribuição mensal (R$ de hoje). */
  newContributionSalary: z.number().min(0),
  /** "AAAA-MM" a partir do qual o novo salário passa a valer. */
  from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
export type InssIncreaseScenario = z.infer<typeof inssIncreaseScenarioSchema>;

export interface InssEstimateInput {
  /** Anos de contribuição já cumpridos na `startDate`. */
  contributionYearsSoFar: number;
  /** Média (R$ de hoje) dos salários de contribuição desde 07/1994 até `startDate`. */
  historicalAverageSalary: number;
  /** Salário de contribuição atual (mantido até `increase.from`, se houver). */
  currentContributionSalary: number;
  startDate: string; // AAAA-MM
  /** Idade (anos) em que a pessoa deixa de contribuir (padrão: idade de aposentadoria). */
  stopContributingAge: number;
  ageAtStartYears: number;
  minimumWage: number;
  ceiling: number;
  /** Anos de contribuição a partir dos quais valem os +2% (20 homens, 15 mulheres). */
  baseYears?: number;
  increase?: InssIncreaseScenario | null;
}

export interface InssEstimate {
  benefit: number;
  averageSalary: number;
  totalContributionYears: number;
  coefficient: number;
  clampedBy: "minimo" | "teto" | null;
  warning: string;
}

export const INSS_WARNING =
  "Valor aproximado. A regra oficial considera o CNIS e descarte de contribuições; confira o valor no Meu INSS.";

const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return by * 12 + bm - (ay * 12 + am);
};

/**
 * Aproximação do benefício (aposentadoria por idade, pós-Reforma):
 * média de TODOS os salários de contribuição desde 07/1994 × (60% + 2% por ano acima de `baseYears`),
 * limitado entre o salário mínimo e o teto.
 */
export function estimateInssBenefit(i: InssEstimateInput): InssEstimate {
  const baseYears = i.baseYears ?? 20;
  const futureMonths = Math.max(0, Math.round((i.stopContributingAge - i.ageAtStartYears) * 12));
  const pastMonths = Math.round(i.contributionYearsSoFar * 12);

  let monthsAtCurrent = futureMonths;
  let monthsAtNew = 0;
  if (i.increase) {
    const shift = Math.min(futureMonths, Math.max(0, monthsBetween(i.startDate, i.increase.from)));
    monthsAtCurrent = shift;
    monthsAtNew = futureMonths - shift;
  }

  const totalMonths = pastMonths + futureMonths;
  const sum =
    pastMonths * i.historicalAverageSalary +
    monthsAtCurrent * i.currentContributionSalary +
    monthsAtNew * (i.increase?.newContributionSalary ?? 0);
  const averageSalary = totalMonths > 0 ? sum / totalMonths : 0;

  const years = totalMonths / 12;
  const coefficient = 0.6 + 0.02 * Math.max(0, Math.floor(years) - baseYears);
  const raw = averageSalary * coefficient;
  let benefit = raw;
  let clampedBy: InssEstimate["clampedBy"] = null;
  if (raw < i.minimumWage) {
    benefit = i.minimumWage;
    clampedBy = "minimo";
  } else if (raw > i.ceiling) {
    benefit = i.ceiling;
    clampedBy = "teto";
  }
  return { benefit, averageSalary, totalContributionYears: years, coefficient, clampedBy, warning: INSS_WARNING };
}
