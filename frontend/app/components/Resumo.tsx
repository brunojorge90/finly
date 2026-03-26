"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "../lib/auth";

interface ItemResumo {
  categoria: string;
  tipo: "entrada" | "saida";
  total: number;
}

interface Saldo {
  saldo: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  Alimentacao: "🍽️",
  Transporte: "🚗",
  Moradia: "🏠",
  Saude: "💊",
  Lazer: "🎮",
  Educacao: "📚",
  Salario: "💼",
  Freelance: "💻",
  Investimentos: "📈",
  Outros: "📦",
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
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDados();
  }, [fetchDados, refreshKey]);

  const porCategoria = itens.reduce<
    Record<string, { entrada: number; saida: number }>
  >((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = { entrada: 0, saida: 0 };
    acc[item.categoria][item.tipo] += item.total;
    return acc;
  }, {});

  const totalEntradas = itens
    .filter((i) => i.tipo === "entrada")
    .reduce((s, i) => s + i.total, 0);

  const totalSaidas = itens
    .filter((i) => i.tipo === "saida")
    .reduce((s, i) => s + i.total, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40 text-sm gap-2">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        Carregando resumo…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {erro}
        <button
          onClick={fetchDados}
          className="ml-3 underline hover:no-underline font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saldo + totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Saldo */}
        <div className={`rounded-2xl p-5 text-center border
          ${saldo !== null && saldo >= 0
            ? "bg-blue-500/10 border-blue-500/20"
            : "bg-red-500/10 border-red-500/20"}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
            Saldo atual
          </p>
          <p className={`text-2xl font-bold ${
            saldo !== null && saldo >= 0 ? "text-blue-300" : "text-red-300"
          }`}>
            {saldo !== null ? formatBRL(saldo) : "—"}
          </p>
        </div>

        {/* Entradas */}
        <div className="rounded-2xl p-5 text-center border bg-emerald-500/10 border-emerald-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
            Total entradas
          </p>
          <p className="text-2xl font-bold text-emerald-400">
            {formatBRL(totalEntradas)}
          </p>
        </div>

        {/* Saídas */}
        <div className="rounded-2xl p-5 text-center border bg-red-500/10 border-red-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
            Total saídas
          </p>
          <p className="text-2xl font-bold text-red-400">
            {formatBRL(totalSaidas)}
          </p>
        </div>
      </div>

      {/* Cards por categoria */}
      {Object.keys(porCategoria).length === 0 ? (
        <p className="text-center text-sm text-white/30 py-8">
          Nenhuma transação registrada ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(porCategoria)
            .sort((a, b) => (b[1].saida + b[1].entrada) - (a[1].saida + a[1].entrada))
            .map(([categoria, valores]) => {
              const icon = CATEGORY_ICONS[categoria] ?? "💰";
              const temEntrada = valores.entrada > 0;
              const temSaida = valores.saida > 0;

              return (
                <div
                  key={categoria}
                  className="rounded-xl border border-white/8 bg-white/3 p-4
                             hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{icon}</span>
                    <span className="font-semibold text-white/80 text-sm">
                      {categoria}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {temEntrada && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-400/80 font-medium flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Entrada
                        </span>
                        <span className="text-sm font-semibold text-emerald-400">
                          {formatBRL(valores.entrada)}
                        </span>
                      </div>
                    )}
                    {temSaida && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-red-400/80 font-medium flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                          Saída
                        </span>
                        <span className="text-sm font-semibold text-red-400">
                          {formatBRL(valores.saida)}
                        </span>
                      </div>
                    )}
                    {temEntrada && temSaida && (
                      <div className="pt-1.5 mt-1.5 border-t border-white/8 flex items-center justify-between">
                        <span className="text-xs text-white/30 font-medium">Líquido</span>
                        <span
                          className={`text-sm font-bold ${
                            valores.entrada - valores.saida >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatBRL(valores.entrada - valores.saida)}
                        </span>
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
