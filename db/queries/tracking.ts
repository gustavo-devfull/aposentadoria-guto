import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { accounts, monthlySnapshots, profiles, simulations } from "@/db/schema";
import { parseSavedInput } from "@/lib/compare";
import { fromDbMoney, toDbMoney } from "@/lib/money";
import type { SnapshotInput } from "@/lib/tracking";

export const snapshotSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  balances: z.record(z.string().min(1), z.number().min(0)),
  contribution: z.number().min(0),
  note: z.string().max(500).nullable(),
});

export async function listSnapshots(userId: string): Promise<SnapshotInput[]> {
  const rows = await getDb().select().from(monthlySnapshots).where(eq(monthlySnapshots.userId, userId))
    .orderBy(asc(monthlySnapshots.ano), asc(monthlySnapshots.mes));
  return rows.map((r) => ({
    year: r.ano, month: r.mes, contribution: fromDbMoney(r.aporteRealizado), note: r.nota,
    balances: Object.fromEntries(Object.entries(r.saldosPorConta).map(([id, v]) => [id, fromDbMoney(v)])),
  }));
}

/** Cria ou atualiza o lançamento do mês (um por mês). Só aceita contas do próprio usuário. */
export async function upsertSnapshot(userId: string, raw: unknown) {
  const v = snapshotSchema.parse(raw);
  const db = getDb();
  const owned = new Set((await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId))).map((a) => a.id));
  for (const id of Object.keys(v.balances)) if (!owned.has(id)) throw new Error("Conta inválida");
  const values = {
    saldosPorConta: Object.fromEntries(Object.entries(v.balances).map(([id, n]) => [id, toDbMoney(n)])),
    aporteRealizado: toDbMoney(v.contribution),
    nota: v.note,
  };
  await db.insert(monthlySnapshots).values({ userId, ano: v.year, mes: v.month, ...values })
    .onConflictDoUpdate({ target: [monthlySnapshots.userId, monthlySnapshots.ano, monthlySnapshots.mes], set: values });
}

export async function deleteSnapshot(userId: string, year: number, month: number) {
  await getDb().delete(monthlySnapshots)
    .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.ano, year), eq(monthlySnapshots.mes, month)));
}

/** Simulação de referência (o "plano" do acompanhamento), ou null. */
export async function getReference(userId: string) {
  const db = getDb();
  const [p] = await db.select({ id: profiles.simulacaoReferenciaId }).from(profiles).where(eq(profiles.userId, userId));
  if (!p?.id) return null;
  const [sim] = await db.select().from(simulations).where(and(eq(simulations.id, p.id), eq(simulations.userId, userId)));
  const input = sim ? parseSavedInput(sim.input) : null;
  return sim && input ? { id: sim.id, nome: sim.nome, createdAt: sim.createdAt.toISOString(), input } : null;
}

export async function setReference(userId: string, simulationId: string | null) {
  const db = getDb();
  if (simulationId) {
    const [sim] = await db.select({ id: simulations.id }).from(simulations)
      .where(and(eq(simulations.id, simulationId), eq(simulations.userId, userId)));
    if (!sim) throw new Error("Simulação não encontrada");
  }
  const updated = await db.update(profiles).set({ simulacaoReferenciaId: simulationId }).where(eq(profiles.userId, userId)).returning({ id: profiles.userId });
  if (updated.length === 0) throw new Error("Conclua o onboarding primeiro");
}

/** Simulações com o snapshot completo (para comparar). */
export async function listSimulationsWithInput(userId: string) {
  const rows = await getDb().select().from(simulations).where(eq(simulations.userId, userId));
  return rows.flatMap((r) => {
    const input = parseSavedInput(r.input);
    return input ? [{ id: r.id, nome: r.nome, createdAt: r.createdAt.toISOString(), input, resumo: r.resultadoResumido as import("@/db/queries/simulations").SimulationSummary }] : [];
  });
}
