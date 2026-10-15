import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scenarios } from "@/db/schema";
import { planInputSchema, type PlanInput } from "@/lib/plan";

export interface Scenario { id: string; nome: string; createdAt: string; input: PlanInput }

/** Revalida o input no servidor (nunca confia no cliente). */
export async function saveScenario(userId: string, nome: string, raw: unknown) {
  const input = planInputSchema.parse(raw);
  const [row] = await getDb()
    .insert(scenarios)
    .values({ userId, nome: nome.trim().slice(0, 120) || "Cenário", input })
    .returning({ id: scenarios.id });
  return row!.id;
}

export async function listScenarios(userId: string): Promise<Scenario[]> {
  const rows = await getDb().select().from(scenarios).where(eq(scenarios.userId, userId)).orderBy(desc(scenarios.createdAt));
  return rows.flatMap((r) => {
    const input = planInputSchema.safeParse(r.input);
    return input.success ? [{ id: r.id, nome: r.nome, createdAt: r.createdAt.toISOString(), input: input.data }] : [];
  });
}

export async function deleteScenario(userId: string, id: string) {
  await getDb().delete(scenarios).where(and(eq(scenarios.id, id), eq(scenarios.userId, userId)));
}
