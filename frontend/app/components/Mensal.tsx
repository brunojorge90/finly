"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "../lib/auth";

interface MesResumo {
  mes: string; // "2026-03"
  entradas: number;
  saidas: number;
}

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function labelMes(ym: string) {
  const [year, month] = ym.split("-");
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  refreshKey?: number;
}

export default function Mensal({ refreshKey = 0 }: Props) {
  const [dados, setDados] = useState<MesResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchApi("/mensal");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setDados(await res.json());
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados, refreshKey]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-white/40 text-sm gap-2">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      Carregando…
    </div>
  );

  if (erro) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {erro}
      <button onClick={fetchDados} className="ml-3 underline font-medium">Tentar novamente</button>
    </div>
  );

  if (dados.length === 0) return (
    <p className="text-center text-sm text-white/30 py-8">Nenhuma transação registrada ainda.</p>
  );

  const maxVal = Math.max(...dados.map((d) => Math.max(d.entradas, d.saidas)), 1);

  // Estatísticas
  const melhorMes = [...dados].sort((a, b) => (b.entradas - b.saidas) - (a.entradas - a.saidas))[0];
  const piorMes   = [...dados].sort((a, b) => (a.entradas - a.saidas) - (b.entradas - b.saidas))[0];
  const mediaEntradas = dados.reduce((s, d) => s + d.entradas, 0) / dados.length;
  const mediaSaidas   = dados.reduce((s, d) => s + d.saidas,   0) / dados.length;

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 sm:p-4">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Meses</p>
          <p className="text-2xl font-bold text-white">{dados.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 sm:p-4">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Média entradas</p>
          <p className="text-base sm:text-xl font-bold text-emerald-400">{formatBRL(mediaEntradas)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 sm:p-4">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Média saídas</p>
          <p className="text-base sm:text-xl font-bold text-red-400">{formatBRL(mediaSaidas)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 sm:p-4">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Melhor mês</p>
          <p className="text-sm font-bold text-blue-300">{labelMes(melhorMes.mes)}</p>
          <p className="text-xs text-emerald-400 mt-0.5">{formatBRL(melhorMes.entradas - melhorMes.saidas)}</p>
        </div>
      </div>

      {/* Lista de meses */}
      <div className="space-y-3">
        {dados.map((d) => {
          const saldo = d.entradas - d.saidas;
          const barEntradas = (d.entradas / maxVal) * 100;
          const barSaidas   = (d.saidas   / maxVal) * 100;

          return (
            <div key={d.mes} className="rounded-xl border border-white/8 bg-white/3 p-5">
              {/* Header do mês */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-white">{labelMes(d.mes)}</span>
                <span className={`text-sm font-bold ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {saldo >= 0 ? "+" : ""}{formatBRL(saldo)}
                </span>
              </div>

              {/* Barras */}
              <div className="space-y-2.5">
                {/* Entradas */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Entradas
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">{formatBRL(d.entradas)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${barEntradas}%` }}
                    />
                  </div>
                </div>

                {/* Saídas */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                      Saídas
                    </span>
                    <span className="text-xs font-semibold text-red-400">{formatBRL(d.saidas)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-red-400 transition-all duration-500"
                      style={{ width: `${barSaidas}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <p className="text-xs text-white/20 text-center">
        As barras são proporcionais ao maior valor entre todos os meses.
        Pior mês: <span className="text-red-400/60">{labelMes(piorMes.mes)}</span>
      </p>
    </div>
  );
}
