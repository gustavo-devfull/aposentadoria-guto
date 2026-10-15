"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { savePlanForm } from "@/db/queries/plan";
import { planFormSchema, type PlanForm } from "@/lib/plan";

export async function saveOnboarding(values: PlanForm) {
  const userId = await requireUserId();
  const parsed = planFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos — revise os campos." };
  await savePlanForm(userId, parsed.data);
  redirect("/dashboard");
}
