"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { fetchApi, NetworkError } from "../lib/auth";

const ExtratoCharts = dynamic(() => import("./ExtratoCharts"), { ssr: false });

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
  pagamento?: string | null;
  parcela_grupo?: string | null;
  parcela_num?: number | null;
  parcela_total?: number | null;
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

function descricaoBase(descricao: string): string {
  return descricao.replace(/\s+\d+\/\d+$/, "");
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
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [deletandoId, setDeletandoId] = useState<number | null>(null);
  const [erroDelete, setErroDelete] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pedirConfirmacao(id: number) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmandoId(id);
    confirmTimer.current = setTimeout(() => setConfirmandoId(null), 3000);
  }

  const fetchTransacoes = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchApi("/transacoes");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setTransacoes(await res.json());
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

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes, refreshKey]);

  async function handleDelete(id: number) {
    if (confirmandoId !== id) {
      pedirConfirmacao(id);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setDeletandoId(id);
    try {
      const res = await fetchApi(`/transacao/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setTransacoes((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setErroDelete(
        err instanceof NetworkError
          ? "Não foi possível excluir: servidor offline."
          : "Não foi possível excluir a transação."
      );
      setTimeout(() => setErroDelete(null), 5000);
    } finally {
      setDeletandoId(null);
      setConfirmandoId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-xl h-12 animate-pulse"
               style={{ background: "var(--s2)", border: "1px solid var(--border)", animationDelay: `${i*60}ms` }} />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div role="alert" className="animate-slide-in rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <p>{erro}</p>
        <button
          onClick={fetchTransacoes}
          className="mt-2 underline hover:no-underline font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (transacoes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-white/40 text-sm">Nenhuma transação registrada ainda.</p>
      </div>
    );
  }

  const mesesDisponiveis = getMesesDisponiveis(transacoes);

  const transacoesFiltradas =
    mesSelecionado === "todos"
      ? transacoes
      : transacoes.filter((t) => t.data.startsWith(mesSelecionado));

  const totalVR = transacoesFiltradas
    .filter((t) => t.pagamento === "VR")
    .reduce((acc, t) => acc + t.valor, 0);

  const totalVA = transacoesFiltradas
    .filter((t) => t.pagamento === "VA")
    .reduce((acc, t) => acc + t.valor, 0);

  // Agrupa parcelas do período por parcela_grupo
  const parcelasNoMes = transacoesFiltradas.filter((t) => t.parcela_grupo);
  const gruposMap = new Map<string, Transacao[]>();
  for (const t of parcelasNoMes) {
    const key = t.parcela_grupo!;
    if (!gruposMap.has(key)) gruposMap.set(key, []);
    gruposMap.get(key)!.push(t);
  }
  const gruposCredito = Array.from(gruposMap.values());
  const totalCredito = parcelasNoMes.reduce((acc, t) => acc + t.valor, 0);

  const mesLabel =
    mesSelecionado === "todos" ? "todos" : labelMes(mesSelecionado).replace(" ", "-").toLowerCase();

  return (
    <div className="space-y-4">
      {erroDelete && (
        <div role="alert" className="animate-slide-in flex items-center gap-3 rounded-xl border border-red-500/20
                   bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="text-red-400 text-base leading-none shrink-0" aria-hidden="true">!</span>
          <p className="flex-1">{erroDelete}</p>
          <button
            onClick={() => setErroDelete(null)}
            className="shrink-0 text-xs font-medium text-red-400/60 hover:text-red-300 transition-colors"
            aria-label="Fechar alerta"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Dashboards */}
      <ExtratoCharts transacoes={transacoesFiltradas} mesSelecionado={mesSelecionado} />

      {/* Header: filtro de mês + download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pills de mês */}
        <div className="flex flex-wrap items-center gap-2">
          {["todos", ...mesesDisponiveis].map((ym) => (
            <button
              key={ym}
              onClick={() => setMesSelecionado(ym)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={mesSelecionado === ym
                ? { background: "var(--accent)", color: "white", boxShadow: "0 2px 10px var(--accent-glow)" }
                : { border: "1px solid var(--border)", color: "rgba(255,255,255,0.45)" }}
            >
              {ym === "todos" ? "Todos" : labelMes(ym)}
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
      <div className="hidden sm:block overflow-x-auto rounded-xl"
           style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ borderBottom: "1px solid var(--border)", background: "var(--s2)" }}>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Data</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Descrição</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Categoria</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Tipo</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30 text-right">Valor</th>
              <th className="px-4 py-3 w-10" />
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
                  className="px-4 py-3 text-right font-semibold whitespace-nowrap mono"
                  style={{ color: t.tipo === "entrada" ? "var(--positive)" : "var(--negative)" }}
                >
                  {t.tipo === "entrada" ? "+" : "−"} {formatBRL(t.valor)}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletandoId === t.id}
                    title={confirmandoId === t.id ? "Clique para confirmar" : "Excluir"}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40
                      ${confirmandoId === t.id
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "text-white/20 hover:text-red-400 hover:bg-red-500/10"}`}
                  >
                    {deletandoId === t.id ? "…" : confirmandoId === t.id ? "Confirmar" : "✕"}
                  </button>
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
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/80 truncate">{t.descricao}</p>
              <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5">
                <span>{formatData(t.data)}</span>
                <span>·</span>
                <span>{CATEGORY_ICONS[t.categoria] ?? "💰"} {t.categoria}</span>
              </p>
            </div>
            <div className="text-right shrink-0 flex items-center gap-2">
              <div>
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
              <button
                onClick={() => handleDelete(t.id)}
                disabled={deletandoId === t.id}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40
                  ${confirmandoId === t.id
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "text-white/20 hover:text-red-400 hover:bg-red-500/10"}`}
              >
                {deletandoId === t.id ? "…" : confirmandoId === t.id ? "✓?" : "✕"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      </>
      )}

      {/* Gasto Vouchers */}
      {(totalVR > 0 || totalVA > 0) && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🎟️</span>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Gasto Vouchers
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {totalVR > 0 && (
              <div className="flex-1 min-w-[140px] rounded-xl border border-amber-500/15
                              bg-amber-500/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60 mb-1">
                  VR — Vale-Refeição
                </p>
                <p className="text-lg font-bold text-amber-300">
                  {formatBRL(totalVR)}
                </p>
              </div>
            )}
            {totalVA > 0 && (
              <div className="flex-1 min-w-[140px] rounded-xl border border-green-500/15
                              bg-green-500/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-green-400/60 mb-1">
                  VA — Vale-Alimentação
                </p>
                <p className="text-lg font-bold text-green-300">
                  {formatBRL(totalVA)}
                </p>
              </div>
            )}
            {totalVR > 0 && totalVA > 0 && (
              <div className="flex-1 min-w-[140px] rounded-xl border border-white/8
                              bg-white/4 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
                  Total Vouchers
                </p>
                <p className="text-lg font-bold text-white/70">
                  {formatBRL(totalVR + totalVA)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Compras no Crédito */}
      {gruposCredito.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">💳</span>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Compras no Crédito
            </h3>
          </div>
          <div className="space-y-2 mb-3">
            {gruposCredito.map((grupo) => {
              const primeira = grupo[0];
              return (
                <div
                  key={primeira.parcela_grupo}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-white/70 truncate">
                    {descricaoBase(primeira.descricao)}
                  </span>
                  <span className="text-xs text-white/40 shrink-0">
                    {primeira.parcela_total}x {formatBRL(primeira.valor)}/parcela
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-white/8 pt-3 flex justify-between items-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Total no mês
            </span>
            <span className="text-base font-bold text-blue-300">
              {formatBRL(totalCredito)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
