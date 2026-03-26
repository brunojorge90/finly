"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
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

function formatData(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

interface Props {
  refreshKey?: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getMesesDisponiveis(transacoes: Transacao[]): string[] {
  const set = new Set(transacoes.map((t) => t.data.slice(0, 7)));
  return Array.from(set).sort().reverse();
}

function labelMes(ym: string) {
  const [year, month] = ym.split("-");
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

function downloadExcel(transacoes: Transacao[], mesLabel: string) {
  const rows = transacoes.map((t) => ({
    Data: formatData(t.data),
    Descrição: t.descricao,
    Categoria: t.categoria,
    Tipo: t.tipo === "entrada" ? "Entrada" : "Saída",
    Valor: t.tipo === "entrada" ? t.valor : -t.valor,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extrato");
  XLSX.writeFile(wb, `extrato-${mesLabel}.xlsx`);
}

export default function Extrato({ refreshKey = 0 }: Props) {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>("todos");

  const fetchTransacoes = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transacoes`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setTransacoes(await res.json());
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40 text-sm gap-2">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        Carregando extrato…
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {erro}
        <button
          onClick={fetchTransacoes}
          className="ml-3 underline hover:no-underline font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (transacoes.length === 0) {
    return (
      <p className="text-center text-sm text-white/30 py-8">
        Nenhuma transação registrada ainda.
      </p>
    );
  }

  const mesesDisponiveis = getMesesDisponiveis(transacoes);

  const transacoesFiltradas =
    mesSelecionado === "todos"
      ? transacoes
      : transacoes.filter((t) => t.data.startsWith(mesSelecionado));

  const mesLabel =
    mesSelecionado === "todos" ? "todos" : labelMes(mesSelecionado).replace(" ", "-").toLowerCase();

  return (
    <div className="space-y-4">
      {/* Header: filtro de mês + download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pills de mês */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMesSelecionado("todos")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${mesSelecionado === "todos"
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "border border-white/10 text-white/50 hover:text-white/80"}`}
          >
            Todos
          </button>
          {mesesDisponiveis.map((ym) => (
            <button
              key={ym}
              onClick={() => setMesSelecionado(ym)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
                ${mesSelecionado === ym
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "border border-white/10 text-white/50 hover:text-white/80"}`}
            >
              {labelMes(ym)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs text-white/30">
            {transacoesFiltradas.length} transaç{transacoesFiltradas.length === 1 ? "ão" : "ões"}
          </p>
          <button
            onClick={() => downloadExcel(transacoesFiltradas, mesLabel)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5
                       hover:bg-white/10 px-4 py-2 text-xs font-medium text-white/70
                       hover:text-white transition-colors"
          >
            <span>⬇</span>
            Baixar Excel
          </button>
        </div>
      </div>

      {transacoesFiltradas.length === 0 && (
        <p className="text-center text-sm text-white/30 py-8">
          Nenhuma transação em {mesSelecionado === "todos" ? "nenhum período" : labelMes(mesSelecionado)}.
        </p>
      )}

      {/* Table + Cards — visíveis quando há resultados */}
      {transacoesFiltradas.length > 0 && (
      <>
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/3 text-left">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Data</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Descrição</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Categoria</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Tipo</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {transacoesFiltradas.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-white/3 transition-colors"
              >
                <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs">
                  {formatData(t.data)}
                </td>
                <td className="px-4 py-3 text-white/80 font-medium max-w-[220px] truncate">
                  {t.descricao}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8
                                   bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/60">
                    {CATEGORY_ICONS[t.categoria] ?? "💰"}
                    {t.categoria}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                      text-xs font-semibold
                      ${t.tipo === "entrada"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"}`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full
                        ${t.tipo === "entrada" ? "bg-emerald-500" : "bg-red-400"}`}
                    />
                    {t.tipo === "entrada" ? "Entrada" : "Saída"}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold whitespace-nowrap
                    ${t.tipo === "entrada" ? "text-emerald-400" : "text-red-400"}`}
                >
                  {t.tipo === "entrada" ? "+" : "−"} {formatBRL(t.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <ul className="sm:hidden divide-y divide-white/5 rounded-xl border border-white/8 overflow-hidden">
        {transacoesFiltradas.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3 gap-3 hover:bg-white/3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">{t.descricao}</p>
              <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5">
                <span>{formatData(t.data)}</span>
                <span>·</span>
                <span>{CATEGORY_ICONS[t.categoria] ?? "💰"} {t.categoria}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-sm font-bold ${
                  t.tipo === "entrada" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {t.tipo === "entrada" ? "+" : "−"} {formatBRL(t.valor)}
              </p>
              <span
                className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold
                  ${t.tipo === "entrada"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"}`}
              >
                {t.tipo === "entrada" ? "Entrada" : "Saída"}
              </span>
            </div>
          </li>
        ))}
      </ul>
      </>
      )}
    </div>
  );
}
