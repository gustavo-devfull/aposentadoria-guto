import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { simulations } from "@/db/schema";
import { runSimulation, simulationInputSchema, type SimulationResult } from "@/lib/engine";

export interface SimulationSummary {
  retirementAge: number;
  patrimonioProjetado: number;
  patrimonioNecessario: number;
  gap: number;
  aporteMensalNecessario: number | null;
  rendaSustentavel: number | null;
  idadeEsgotamento: number | null;
  ponteShare: number | null;
}

export function summarize(res: SimulationResult): SimulationSummary {
  return {
    retirementAge: res.retirementAge,
    patrimonioProjetado: res.patrimonioProjetado,
    patrimonioNecessario: res.patrimonioNecessario,
    gap: res.gap,
    aporteMensalNecessario: res.aporteMensalNecessario,
    rendaSustentavel: res.rendaSustentavel,
    idadeEsgotamento: res.idadeEsgotamento,
    ponteShare: res.ponte?.shareOfPortfolio ?? null,
  };
}

/** Revalida o input no servidor e recalcula o resumo (nunca confia no resultado enviado pelo cliente). */
export async function saveSimulation(userId: string, nome: string, rawInput: unknown) {
  const input = simulationInputSchema.parse(rawInput);
  const resumo = summarize(runSimulation(input));
  const [row] = await getDb()
    .insert(simulations)
    .values({ userId, nome: nome.trim().slice(0, 120) || "Simulação", input, resultadoResumido: resumo })
    .returning({ id: simulations.id });
  return row!.id;
}

export async function listSimulations(userId: string) {
  const rows = await getDb()
    .select({ id: simulations.id, nome: simulations.nome, createdAt: simulations.createdAt, resumo: simulations.resultadoResumido })
    .from(simulations)
    .where(eq(simulations.userId, userId))
    .orderBy(desc(simulations.createdAt));
  return rows.map((r) => ({ ...r, resumo: r.resumo as SimulationSummary }));
}

export async function deleteSimulation(userId: string, id: string) {
  await getDb().delete(simulations).where(and(eq(simulations.id, id), eq(simulations.userId, userId)));
}
