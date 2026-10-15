import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { defaultPlan } from "@/lib/plan";

// Postgres real (WASM) com as migrations do projeto — substitui o cliente do Supabase nos testes.
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("@/db", () => ({ getDb: () => db }));

const plan = await import("@/db/queries/plan");
const scen = await import("@/db/queries/scenarios");

const A = "user-a";
const B = "user-b";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
  await db.insert(schema.users).values([{ id: A, email: "a@x.com" }, { id: B, email: "b@x.com" }]);
});

describe("migrations", () => {
  it("plans e scenarios existem com RLS ativado", async () => {
    const r = await client.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname in ('plans','scenarios')",
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });

  it("0004 converte o plano do modelo antigo", async () => {
    const old = new PGlite();
    const run = async (file: string) => {
      for (const stmt of readFileSync(`db/migrations/${file}.sql`, "utf8").split("--> statement-breakpoint")) {
        if (stmt.trim()) await old.exec(stmt);
      }
    };
    for (const f of ["0000_married_diamondback", "0001_late_scourge", "0002_striped_kabuki", "0003_enable_rls"]) await run(f);
    await old.exec(`
      insert into users (id, email) values ('u', 'u@x.com');
      insert into profiles (user_id, data_nascimento, horizonte_idade) values ('u', '1975-10-15', 95);
      insert into asset_classes (id, user_id, nome, retorno_real_pessimista, retorno_real_base, retorno_real_otimista, regime_ir)
        values ('00000000-0000-0000-0000-000000000001', 'u', 'X', 0, 0, 0, 'isento');
      insert into accounts (user_id, nome, asset_class_id, saldo_atual, custo_base, data_referencia, incluir_na_aposentadoria) values
        ('u', 'A', '00000000-0000-0000-0000-000000000001', 300000.50, 0, '2026-10-01', true),
        ('u', 'B', '00000000-0000-0000-0000-000000000001', 100000, 0, '2026-10-01', true),
        ('u', 'Fora', '00000000-0000-0000-0000-000000000001', 999, 0, '2026-10-01', false);
      insert into contribution_plans (user_id, valor_mensal, data_inicio, alocacao) values ('u', 4000, '2026-10-01', '{}');
      insert into assumption_sets (user_id, nome, versao, inflacao_longo_prazo, salario_minimo) values
        ('u', 'p', 1, 0.035, 1500), ('u', 'p', 2, 0.04, 1621);
    `);
    await run("0004_simple_plans");
    const { rows } = await old.query<Record<string, string | number>>("select * from plans");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "u", investido: "400000.50", aporte_mensal: "4000.00", inflacao: "0.040000",
      inss_beneficio: "1621.00", inss_idade: 65, horizonte_idade: 95, taxa_anual: "0.120000",
    });
  });
});

describe("plano", () => {
  it("usuário sem plano", async () => {
    expect(await plan.loadPlan(A)).toBeNull();
  });
  it("salva, recarrega e atualiza", async () => {
    const p = { ...defaultPlan(), birthDate: "1975-10-15", invested: 800000.55, monthly: 4000, annualRate: 0.13 };
    await plan.savePlan(A, p);
    expect(await plan.loadPlan(A)).toEqual(p);
    await plan.savePlan(A, { ...p, monthly: 5000 });
    expect((await plan.loadPlan(A))!.monthly).toBe(5000);
    expect(await plan.loadPlan(B)).toBeNull();
  });
  it("rejeita plano inválido", async () => {
    await expect(plan.savePlan(A, { ...defaultPlan(), invested: -5 })).rejects.toThrow();
  });
});

describe("cenários", () => {
  it("salva, lista e isola por usuário", async () => {
    const id = await scen.saveScenario(A, "  Poupança  ", { ...defaultPlan(), annualRate: 0.0617 });
    await scen.saveScenario(A, "", defaultPlan());
    const mine = await scen.listScenarios(A);
    expect(mine.map((s) => s.nome).sort()).toEqual(["Cenário", "Poupança"]);
    expect(mine.find((s) => s.id === id)!.input.annualRate).toBe(0.0617);
    expect(await scen.listScenarios(B)).toHaveLength(0);
    await scen.deleteScenario(B, id); // outro usuário não apaga
    expect(await scen.listScenarios(A)).toHaveLength(2);
    await scen.deleteScenario(A, id);
    expect(await scen.listScenarios(A)).toHaveLength(1);
    await expect(scen.saveScenario(A, "ruim", { foo: 1 })).rejects.toThrow();
  });
});
