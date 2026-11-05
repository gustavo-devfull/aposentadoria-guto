import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/case/index.html", "utf8");

describe("página de case (public/case/index.html)", () => {
  it("todo arquivo local referenciado existe", () => {
    const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g), ...html.matchAll(/url\("(\/[^"]+)"\)/g)].map((m) => m[1]!);
    const routes = new Set(["/", "/icon.svg"]); // rotas do app (não são arquivos de public/)
    expect(refs.length).toBeGreaterThan(8);
    for (const ref of refs) if (!routes.has(ref)) expect(existsSync(`public${ref}`), ref).toBe(true);
    expect(existsSync("app/icon.svg")).toBe(true);
  });
  it("não pede nada a servidores externos (fontes e imagens são locais)", () => {
    const external = [...html.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => m[0]).filter((u) => !u.startsWith("http://www.w3.org/"));
    expect(external).toEqual([]);
  });
  it("estrutura acessível: um h1, idioma, alt em toda imagem e seções nomeadas", () => {
    expect(html).toContain('<html lang="pt-BR">');
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBe(5);
    for (const img of imgs) expect(img, img).toMatch(/alt="[^"]{20,}"/);
    for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(html).toContain(`id="${m[1]}"`);
  });
  it("respeita movimento reduzido e tema escuro", () => {
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("prefers-color-scheme: dark");
  });
  it("não expõe dados pessoais (idade real, datas de nascimento do usuário)", () => {
    expect(html).not.toMatch(/1975|\b51 anos\b/);
  });
  it("traz o aviso de que não é recomendação de investimento", () => {
    expect(html).toContain("Não constitui recomendação de investimento");
  });
});
