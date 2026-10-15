/// <reference lib="webworker" />
import { runMonteCarlo, simulationInputSchema, type MonteCarloConfig, type MonteCarloResult } from "@/lib/engine";

export type McRequest = { input: unknown; config: MonteCarloConfig };
export type McResponse =
  | { type: "progress"; done: number; total: number }
  | { type: "result"; result: MonteCarloResult }
  | { type: "error"; message: string };

const post = (m: McResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<McRequest>) => {
  try {
    const input = simulationInputSchema.parse(e.data.input);
    const result = runMonteCarlo(input, e.data.config, (done, total) => post({ type: "progress", done, total }));
    post({ type: "result", result });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Falha na simulação" });
  }
};
