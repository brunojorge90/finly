"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi, NetworkError } from "../lib/auth";

interface ItemResumo {
  categoria: string;
  tipo: "entrada" | "saida";
  total: number;
}

interface Saldo {
  saldo: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  Alimentacao:   "🍽️",
  Transporte:    "🚗",
  Moradia:       "🏠",
  Saude:         "💊",
  Lazer:         "🎮",
  Educacao:      "📚",
  Salario:       "💼",
  Freelance:     "💻",
  Investimentos: "📈",
  Outros:        "📦",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  refreshKey?: number;
}

export default function Resumo({ refreshKey = 0 }: Props) {
  const [itens, setItens] = useState<ItemResumo[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [resumoRes, saldoRes] = await Promise.all([
        fetchApi("/resumo"),
        fetchApi("/saldo"),
      ]);
      if (!resumoRes.ok || !saldoRes.ok) throw new Error("Erro ao buscar dados");
      const [resumoData, saldoData]: [ItemResumo[], Saldo] = await Promise.all([
        resumoRes.json(),
        saldoRes.json(),
      ]);
      setItens(resumoData);
      setSaldo(saldoData.saldo);
    } catch (err) {
      setErro(
        err instanceof NetworkError
          ? err.message
          : err instanceof Error ? err.message : "Erro inesperado"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados, refreshKey]);

  const porCategoria = itens.reduce<Record<string, { entrada: number; saida: number }>>(
    (acc, item) => {
      if (!acc[item.categoria]) acc[item.categoria] = { entrada: 0, saida: 0 };
      acc[item.categoria][item.tipo] += item.total;
      return acc;
    },
    {}
  );

  const totalEntradas = itens.filter((i) => i.tipo === "entrada").reduce((s, i) => s + i.total, 0);
  const totalSaidas   = itens.filter((i) => i.tipo === "saida").reduce((s, i) => s + i.total, 0);
  const maxSaida = Math.max(
    ...Object.values(porCategoria).map((v) => v.saida),
    1
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {/* skeleton cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-5 h-[88px] animate-pulse"
                 style={{ background: "var(--s2)", border: "1px solid var(--border)" }} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl p-4 h-20 animate-pulse"
                 style={{ background: "var(--s2)", border: "1px solid var(--border)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div role="alert" className="animate-slide-in rounded-xl px-4 py-3 text-sm"
           style={{ border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.08)", color: "var(--negative)" }}>
        <p>{erro}</p>
        <button onClick={fetchDados} className="mt-2 underline hover:no-underline font-medium">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Saldo + totais ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Saldo */}
        <div className="rounded-2xl p-5 text-center"
             style={saldo !== null && saldo >= 0
               ? { background: "var(--accent-dim)", border: "1px solid var(--border-accent)" }
               : { background: "var(--negative-dim)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
            Saldo atual
          </p>
          <p className="text-2xl font-bold mono"
             style={{ color: saldo !== null && saldo >= 0 ? "var(--accent)" : "var(--negative)" }}>
            {saldo !== null ? formatBRL(saldo) : "—"}
          </p>
        </div>

        {/* Entradas */}
        <div className="rounded-2xl p-5 text-center"
             style={{ background: "var(--positive-dim)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
            Total entradas
          </p>
          <p className="text-2xl font-bold mono" style={{ color: "var(--positive)" }}>
            {formatBRL(totalEntradas)}
          </p>
        </div>

        {/* Saídas */}
        <div className="rounded-2xl p-5 text-center"
             style={{ background: "var(--negative-dim)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
            Total saídas
          </p>
          <p className="text-2xl font-bold mono" style={{ color: "var(--negative)" }}>
            {formatBRL(totalSaidas)}
          </p>
        </div>
      </div>

      {/* ── Cards por categoria ── */}
      {Object.keys(porCategoria).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">💸</p>
          <p className="text-white/40 text-sm">Nenhuma transação registrada ainda.</p>
          <p className="text-white/25 text-xs mt-1">
            Use o campo acima para registrar sua primeira transação.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(porCategoria)
            .sort((a, b) => (b[1].saida + b[1].entrada) - (a[1].saida + a[1].entrada))
            .map(([categoria, valores], idx) => {
              const icon = CATEGORY_ICONS[categoria] ?? "💰";
              const temEntrada = valores.entrada > 0;
              const temSaida = valores.saida > 0;
              const spendPct = maxSaida > 0 ? (valores.saida / maxSaida) * 100 : 0;

              return (
                <div
                  key={categoria}
                  className="card-obsidian rounded-xl p-4 animate-stagger-in"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{icon}</span>
                    <span className="font-semibold text-white/80 text-sm flex-1">{categoria}</span>
                  </div>

                  <div className="space-y-1.5">
                    {temEntrada && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium flex items-center gap-1.5"
                              style={{ color: "var(--positive)" }}>
                          <span className="inline-block w-1.5 h-1.5 rounded-full"
                                style={{ background: "var(--positive)" }} />
                          Entrada
                        </span>
                        <span className="text-sm font-semibold mono" style={{ color: "var(--positive)" }}>
                          {formatBRL(valores.entrada)}
                        </span>
                      </div>
                    )}
                    {temSaida && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium flex items-center gap-1.5"
                              style={{ color: "var(--negative)" }}>
                          <span className="inline-block w-1.5 h-1.5 rounded-full"
                                style={{ background: "var(--negative)" }} />
                          Saída
                        </span>
                        <span className="text-sm font-semibold mono" style={{ color: "var(--negative)" }}>
                          {formatBRL(valores.saida)}
                        </span>
                      </div>
                    )}
                    {temEntrada && temSaida && (
                      <div className="pt-1.5 mt-1.5 flex items-center justify-between"
                           style={{ borderTop: "1px solid var(--border)" }}>
                        <span className="text-xs text-white/40 font-medium">Líquido</span>
                        <span className="text-sm font-bold mono"
                              style={{ color: valores.entrada - valores.saida >= 0 ? "var(--positive)" : "var(--negative)" }}>
                          {formatBRL(valores.entrada - valores.saida)}
                        </span>
                      </div>
                    )}
                    {/* Barra de intensidade de gasto */}
                    {temSaida && (
                      <div className="mt-2 h-1 rounded-full overflow-hidden"
                           style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${spendPct}%`,
                            background: spendPct > 70
                              ? "var(--negative)"
                              : spendPct > 40
                                ? "#f59e0b"
                                : "var(--accent)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
