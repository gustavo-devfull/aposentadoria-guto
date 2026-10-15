import { ZodError } from "zod";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Executa a ação convertendo erros de validação em mensagem legível (sem vazar stack). */
export async function guarded(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { ok: false, error: `${first?.path.join(".") ?? ""} ${first?.message ?? "Dados inválidos"}`.trim() };
    }
    if (e instanceof Error && !/DATABASE_URL|connect|ECONN/i.test(e.message)) return { ok: false, error: e.message };
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}
