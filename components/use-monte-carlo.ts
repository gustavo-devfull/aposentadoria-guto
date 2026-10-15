"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runMonteCarlo, type MonteCarloConfig, type MonteCarloResult, type SimulationInput } from "@/lib/engine";
import type { McResponse } from "@/lib/mc/mc.worker";

/**
 * Executa o Monte Carlo em um Web Worker para não travar a UI.
 * Sem suporte a Worker (ex.: ambientes antigos), cai para a thread principal.
 */
export function useMonteCarlo() {
  const worker = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
  }, []);
  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (input: SimulationInput, config: MonteCarloConfig) => {
      cancel();
      setError(null);
      setProgress(0);
      setRunning(true);

      if (typeof Worker === "undefined") {
        try {
          setResult(runMonteCarlo(input, config));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha na simulação");
        }
        setRunning(false);
        return;
      }
      const w = new Worker(new URL("../lib/mc/mc.worker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      w.onmessage = (e: MessageEvent<McResponse>) => {
        const m = e.data;
        if (m.type === "progress") setProgress(m.done / m.total);
        else if (m.type === "result") {
          setResult(m.result);
          setRunning(false);
          w.terminate();
          worker.current = null;
        } else {
          setError(m.message);
          setRunning(false);
          w.terminate();
          worker.current = null;
        }
      };
      w.onerror = () => {
        setError("Falha ao executar o worker");
        setRunning(false);
      };
      w.postMessage({ input, config });
    },
    [cancel],
  );

  return { run, cancel, running, progress, result, error };
}
