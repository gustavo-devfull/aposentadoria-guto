import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof makeDb> | undefined;

function makeDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada (veja .env.example)");
  return drizzle(neon(url), { schema });
}

/** Cliente lazy: o build não exige banco. */
export function getDb() {
  return (_db ??= makeDb());
}
