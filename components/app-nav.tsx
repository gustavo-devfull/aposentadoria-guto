"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Meu plano", demo: "" },
  { href: "/simulador", label: "Simulador", demo: "simulador" },
  { href: "/mes-a-mes", label: "Mês a mês", demo: "mes" },
  { href: "/comparar", label: "Comparar", demo: "comparar" },
];

/** Menu com a página atual destacada. Em /demo, navega entre as visões fictícias. */
export function AppNav() {
  const path = usePathname();
  const view = useSearchParams().get("view") ?? "";
  const demo = path === "/demo";
  if (path === "/") return null;
  return (
    <nav aria-label="Principal" className="flex gap-1 overflow-x-auto rounded-xl bg-subtle p-1 text-sm">
      {LINKS.map((l) => {
        const active = demo ? view === l.demo : path.startsWith(l.href);
        const href = demo ? (l.demo ? `/demo?view=${l.demo}` : "/demo") : l.href;
        return (
          <Link key={l.href} href={href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition ${active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
