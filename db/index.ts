import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Db };

function makeDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada (veja .env.example)");
  // Supabase: use a string do "Transaction pooler" (porta 6543). Nesse modo não há prepared statements.
  const client = postgres(url, { prepare: false, max: process.env.NODE_ENV === "production" ? 1 : 5 });
  return drizzle(client, { schema });
}

/** Cliente lazy (o build não exige banco) e reaproveitado entre hot reloads. */
export function getDb(): Db {
  return (globalForDb.__db ??= makeDb());
}
