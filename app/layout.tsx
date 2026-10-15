import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aposentadoria",
  description: "Simulador e gestor de aposentadoria",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-zinc-900">
        <nav className="mx-auto flex max-w-5xl gap-4 p-6 pb-0 text-sm">
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/simulador" className="hover:underline">Simulador</Link>
          <Link href="/carteira" className="hover:underline">Carteira</Link>
          <Link href="/renda-gastos" className="hover:underline">Renda e gastos</Link>
          <Link href="/premissas" className="hover:underline">Premissas</Link>
          <Link href="/onboarding" className="hover:underline">Plano</Link>
        </nav>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
        <footer className="mx-auto max-w-5xl border-t p-6 text-xs text-zinc-500">
          Simulação educativa baseada em premissas. Não constitui recomendação de investimento.
          Confira o benefício oficial no Meu INSS.
        </footer>
      </body>
    </html>
  );
}
