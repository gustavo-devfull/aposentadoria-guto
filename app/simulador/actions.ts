"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { savePlan } from "@/db/queries/plan";
import { deleteScenario, saveScenario } from "@/db/queries/scenarios";
import { guarded } from "@/lib/action-result";

export async function savePlanAction(input: unknown) {
  const userId = await requireUserId();
  return guarded(async () => {
    await savePlan(userId, input);
    revalidatePath("/dashboard");
  });
}

export async function saveScenarioAction(nome: string, input: unknown) {
  const userId = await requireUserId();
  return guarded(async () => {
    await saveScenario(userId, nome, input);
    revalidatePath("/comparar");
  });
}

export async function deleteScenarioAction(id: string) {
  const userId = await requireUserId();
  await deleteScenario(userId, id);
  revalidatePath("/comparar");
}
