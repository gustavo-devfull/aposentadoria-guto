import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aposentadoria — simulador",
    short_name: "Aposentadoria",
    description: "Quanto você terá de renda aos 60 ou 65 anos",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6e9",
    theme_color: "#fa6900",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Simulador", short_name: "Simulador", url: "/simulador", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Mês a mês", short_name: "Mês a mês", url: "/mes-a-mes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
