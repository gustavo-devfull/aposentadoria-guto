"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { deleteSimulation, saveSimulation } from "@/db/queries/simulations";
import { simulationInputSchema } from "@/lib/engine";

export async function saveSimulationAction(nome: string, input: unknown) {
  const userId = await requireUserId();
  if (!simulationInputSchema.safeParse(input).success) return { ok: false as const, error: "Parâmetros inválidos." };
  await saveSimulation(userId, nome, input);
  revalidatePath("/simulador");
  return { ok: true as const };
}

export async function deleteSimulationAction(id: string) {
  const userId = await requireUserId();
  await deleteSimulation(userId, id);
  revalidatePath("/simulador");
}
