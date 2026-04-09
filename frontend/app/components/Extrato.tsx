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

function formatData(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
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

// ── Saúde financeira ─────────────────────────────────────────────
function HealthBar({ entradas, saidas }: { entradas: number; saidas: number }) {
  const pct = entradas > 0 ? Math.min((saidas / entradas) * 100, 100) : 0;
  const color = pct < 60 ? "var(--positive)" : pct < 85 ? "#f59e0b" : "var(--negative)";
  const label = pct < 60 ? "Ótimo" : pct < 85 ? "Atenção" : "Crítico";
  const labelColor = pct < 60 ? "var(--positive)" : pct < 85 ? "#f59e0b" : "var(--negative)";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{pct.toFixed(0)}% dos ganhos gastos</span>
        <span className="font-semibold" style={{ color: labelColor }}>{label}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Ranking de gastos ─────────────────────────────────────────────
function RankingGastos({ transacoes }: { transacoes: Transacao[] }) {
  const porCat = transacoes
    .filter((t) => t.tipo === "saida")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] ?? 0) + t.valor;
      return acc;
    }, {});

  const total = Object.values(porCat).reduce((s, v) => s + v, 0);
  const ranking = Object.entries(porCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  if (ranking.length === 0) {
    return <p className="text-xs text-white/30 py-4 text-center">Nenhum gasto no período.</p>;
  }

  return (
    <div className="space-y-2.5">
      {ranking.map(([cat, valor], i) => {
        const pct = total > 0 ? (valor / total) * 100 : 0;
        // Intensidade: 1º lugar mais vermelho, demais mais suaves
        const intensity = i === 0 ? 1 : i === 1 ? 0.75 : 0.55;
        const barColor = `rgba(248,113,113,${intensity})`;

        return (
          <div key={cat} className="group">
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-sm">{CATEGORY_ICONS[cat] ?? "💰"}</span>
                <span className="text-xs text-white/70 truncate">{cat}</span>
                {i === 0 && (
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(248,113,113,0.15)", color: "var(--negative)" }}>
                    maior
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold mono text-white/80">{formatBRL(valor)}</span>
                <span className="text-[10px] text-white/30 ml-1.5">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Entradas do período ───────────────────────────────────────────
function PainelEntradas({ transacoes }: { transacoes: Transacao[] }) {
  const porCat = transacoes
    .filter((t) => t.tipo === "entrada")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] ?? 0) + t.valor;
      return acc;
    }, {});

  const total = Object.values(porCat).reduce((s, v) => s + v, 0);
  const itens = Object.entries(porCat).sort(([, a], [, b]) => b - a);

  if (itens.length === 0) {
    return <p className="text-xs text-white/30 py-4 text-center">Nenhuma entrada no período.</p>;
  }

  return (
    <div className="space-y-2.5">
      {itens.map(([cat, valor]) => {
        const pct = total > 0 ? (valor / total) * 100 : 0;
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-sm">{CATEGORY_ICONS[cat] ?? "💰"}</span>
                <span className="text-xs text-white/70 truncate">{cat}</span>
              </div>
              <span className="text-xs font-semibold mono shrink-0" style={{ color: "var(--positive)" }}>
                {formatBRL(valor)}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: "var(--positive)" }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-2 mt-1 flex items-center justify-between"
           style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs text-white/40 font-medium">Total entradas</span>
        <span className="text-sm font-bold mono" style={{ color: "var(--positive)" }}>
          {formatBRL(total)}
        </span>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────
interface Props {
  refreshKey?: number;
}

export default function Extrato({ refreshKey = 0 }: Props) {
  const mesAtual = new Date().toISOString().slice(0, 7);

  const [transacoes, setTransacoes]       = useState<Transacao[]>([]);
  const [loading, setLoading]             = useState(true);
  const [erro, setErro]                   = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtual);
  const [abaAtiva, setAbaAtiva]           = useState<"analise" | "lista">("analise");
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [deletandoId, setDeletandoId]     = useState<number | null>(null);
  const [erroDelete, setErroDelete]       = useState<string | null>(null);
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
      const data: Transacao[] = await res.json();
      setTransacoes(data);
      // Se o mês atual não tem dados, usa o mais recente disponível
      const meses = Array.from(new Set(data.map((t) => t.data.slice(0, 7)))).sort().reverse();
      if (meses.length > 0 && !meses.includes(mesAtual)) {
        setMesSelecionado(meses[0]);
      }
    } catch (err) {
      setErro(
        err instanceof NetworkError
          ? err.message
          : err instanceof Error ? err.message : "Erro inesperado"
      );
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTransacoes(); }, [fetchTransacoes, refreshKey]);

  async function handleDelete(id: number) {
    if (confirmandoId !== id) { pedirConfirmacao(id); return; }
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

  // ── Loading / erro / vazio ────────────────────────────────────
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
      <div role="alert" className="animate-slide-in rounded-xl px-4 py-3 text-sm"
           style={{ border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.08)", color: "var(--negative)" }}>
        <p>{erro}</p>
        <button onClick={fetchTransacoes} className="mt-2 underline hover:no-underline font-medium">
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

  // ── Dados derivados ───────────────────────────────────────────
  const mesesDisponiveis = getMesesDisponiveis(transacoes);

  const transacoesFiltradas = mesSelecionado === "todos"
    ? transacoes
    : transacoes.filter((t) => t.data.startsWith(mesSelecionado));

  const totalEntradas = transacoesFiltradas.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const totalSaidas   = transacoesFiltradas.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
  const saldo         = totalEntradas - totalSaidas;

  const totalVR = transacoesFiltradas.filter((t) => t.pagamento === "VR").reduce((acc, t) => acc + t.valor, 0);
  const totalVA = transacoesFiltradas.filter((t) => t.pagamento === "VA").reduce((acc, t) => acc + t.valor, 0);

  const parcelasNoMes = transacoesFiltradas.filter((t) => t.parcela_grupo);
  const gruposMap = new Map<string, Transacao[]>();
  for (const t of parcelasNoMes) {
    const key = t.parcela_grupo!;
    if (!gruposMap.has(key)) gruposMap.set(key, []);
    gruposMap.get(key)!.push(t);
  }
  const gruposCredito = Array.from(gruposMap.values());
  const totalCredito  = parcelasNoMes.reduce((acc, t) => acc + t.valor, 0);
  const mesLabel = mesSelecionado === "todos"
    ? "todos"
    : labelMes(mesSelecionado).replace(" ", "-").toLowerCase();

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {erroDelete && (
        <div role="alert" className="animate-slide-in flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
             style={{ border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.08)", color: "var(--negative)" }}>
          <span aria-hidden="true">!</span>
          <p className="flex-1">{erroDelete}</p>
          <button onClick={() => setErroDelete(null)} className="text-xs opacity-60 hover:opacity-100 transition-opacity">
            Fechar
          </button>
        </div>
      )}

      {/* ── Seletor de mês + abas ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

        {/* Abas Análise / Lista */}
        <div className="flex gap-1 p-1 rounded-xl self-start"
             style={{ background: "var(--s2)", border: "1px solid var(--border)" }}>
          {(["analise", "lista"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAbaAtiva(a)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={abaAtiva === a
                ? { background: "var(--accent)", color: "white", boxShadow: "0 2px 10px var(--accent-glow)" }
                : { color: "rgba(255,255,255,0.4)" }}
            >
              {a === "analise" ? "Análise" : "Lista"}
            </button>
          ))}
        </div>

        {/* Pills de mês */}
        <div className="flex flex-wrap items-center gap-1.5">
          {mesesDisponiveis.map((ym) => (
            <button
              key={ym}
              onClick={() => setMesSelecionado(ym)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={mesSelecionado === ym
                ? { background: "var(--accent)", color: "white", boxShadow: "0 2px 10px var(--accent-glow)" }
                : { border: "1px solid var(--border)", color: "rgba(255,255,255,0.4)" }}
            >
              {labelMes(ym)}
            </button>
          ))}
          <button
            onClick={() => setMesSelecionado("todos")}
            className="rounded-full px-3 py-1 text-xs font-medium transition-all"
            style={mesSelecionado === "todos"
              ? { background: "var(--accent)", color: "white", boxShadow: "0 2px 10px var(--accent-glow)" }
              : { border: "1px solid var(--border)", color: "rgba(255,255,255,0.4)" }}
          >
            Todos
          </button>
        </div>
      </div>

      {transacoesFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-white/40 text-sm">
            Nenhuma transação em {mesSelecionado === "todos" ? "nenhum período" : labelMes(mesSelecionado)}.
          </p>
        </div>
      ) : (
        <>
          {/* ══════════════ ABA ANÁLISE ══════════════ */}
          {abaAtiva === "analise" && (
            <div className="space-y-4 animate-fade-in">

              {/* Saúde financeira */}
              <div className="rounded-2xl p-5 sm:p-6"
                   style={{ background: "var(--s2)", border: "1px solid var(--border)" }}>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                      Saldo — {mesSelecionado === "todos" ? "Todos os períodos" : labelMes(mesSelecionado)}
                    </p>
                    <p className="text-4xl font-bold mono"
                       style={{ color: saldo >= 0 ? "var(--positive)" : "var(--negative)" }}>
                      {formatBRL(saldo)}
                    </p>
                  </div>
                  <div className="flex gap-4 sm:gap-6 text-right">
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Entradas</p>
                      <p className="text-base font-semibold mono" style={{ color: "var(--positive)" }}>
                        ↑ {formatBRL(totalEntradas)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40 mb-0.5">Saídas</p>
                      <p className="text-base font-semibold mono" style={{ color: "var(--negative)" }}>
                        ↓ {formatBRL(totalSaidas)}
                      </p>
                    </div>
                  </div>
                </div>
                <HealthBar entradas={totalEntradas} saidas={totalSaidas} />
              </div>

              {/* Gastos vs Entradas — split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ranking de gastos */}
                <div className="rounded-2xl p-5"
                     style={{ background: "var(--s2)", border: "1px solid rgba(248,113,113,0.12)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-base">🔴</span>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                      Maiores gastos
                    </p>
                  </div>
                  <RankingGastos transacoes={transacoesFiltradas} />
                </div>

                {/* Entradas */}
                <div className="rounded-2xl p-5"
                     style={{ background: "var(--s2)", border: "1px solid rgba(52,211,153,0.12)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-base">🟢</span>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                      Entradas do período
                    </p>
                  </div>
                  <PainelEntradas transacoes={transacoesFiltradas} />
                </div>
              </div>

              {/* Donut de categorias */}
              <ExtratoCharts transacoes={transacoesFiltradas} mesSelecionado={mesSelecionado} somentePie />

              {/* Vouchers */}
              {(totalVR > 0 || totalVA > 0) && (
                <div className="rounded-xl p-4"
                     style={{ background: "var(--s2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🎟️</span>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                      Gasto Vouchers
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {totalVR > 0 && (
                      <div className="flex-1 min-w-[140px] rounded-xl px-4 py-3"
                           style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)" }}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/60 mb-1">VR</p>
                        <p className="text-lg font-bold mono text-amber-300">{formatBRL(totalVR)}</p>
                      </div>
                    )}
                    {totalVA > 0 && (
                      <div className="flex-1 min-w-[140px] rounded-xl px-4 py-3"
                           style={{ border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.06)" }}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/60 mb-1">VA</p>
                        <p className="text-lg font-bold mono" style={{ color: "var(--positive)" }}>{formatBRL(totalVA)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Compras no Crédito */}
              {gruposCredito.length > 0 && (
                <div className="rounded-xl p-4"
                     style={{ background: "var(--s2)", border: "1px solid var(--border-accent)" }}>
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
                        <div key={primeira.parcela_grupo}
                             className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white/70 truncate">
                            {descricaoBase(primeira.descricao)}
                          </span>
                          <span className="text-xs text-white/40 shrink-0 mono">
                            {primeira.parcela_total}x {formatBRL(primeira.valor)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-3 flex justify-between items-center"
                       style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
                      Total no mês
                    </span>
                    <span className="text-base font-bold mono" style={{ color: "var(--accent)" }}>
                      {formatBRL(totalCredito)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ ABA LISTA ══════════════ */}
          {abaAtiva === "lista" && (
            <div className="space-y-4 animate-fade-in">

              {/* Controles */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-white/30">
                  {transacoesFiltradas.length} transaç{transacoesFiltradas.length === 1 ? "ão" : "ões"}
                </p>
                <button
                  onClick={() => downloadExcel(transacoesFiltradas, mesLabel)}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white/60 hover:text-white transition-colors"
                  style={{ border: "1px solid var(--border)", background: "var(--s2)" }}
                >
                  <span>⬇</span> Baixar Excel
                </button>
              </div>

              {/* Tabela — desktop */}
              <div className="hidden sm:block overflow-x-auto rounded-xl"
                   style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left"
                        style={{ borderBottom: "1px solid var(--border)", background: "var(--s2)" }}>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Data</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Descrição</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Categoria</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30">Tipo</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/30 text-right">Valor</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {transacoesFiltradas.map((t) => {
                      // Intensidade visual pela proporção do valor sobre o total de saídas
                      const isHighSpend = t.tipo === "saida" && totalSaidas > 0 && (t.valor / totalSaidas) > 0.2;
                      return (
                        <tr
                          key={t.id}
                          className="transition-colors"
                          style={{
                            background: isHighSpend ? "rgba(248,113,113,0.04)" : undefined,
                            borderLeft: isHighSpend ? "2px solid rgba(248,113,113,0.3)" : "2px solid transparent",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isHighSpend ? "rgba(248,113,113,0.04)" : "")}
                        >
                          <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs">
                            {formatData(t.data)}
                          </td>
                          <td className="px-4 py-3 text-white/80 font-medium max-w-[220px] truncate">
                            {t.descricao}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white/60"
                                  style={{ border: "1px solid var(--border)", background: "var(--s2)" }}>
                              {CATEGORY_ICONS[t.categoria] ?? "💰"} {t.categoria}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                                  style={t.tipo === "entrada"
                                    ? { background: "rgba(52,211,153,0.12)", color: "var(--positive)" }
                                    : { background: "rgba(248,113,113,0.12)", color: "var(--negative)" }}>
                              <span className="inline-block w-1.5 h-1.5 rounded-full"
                                    style={{ background: t.tipo === "entrada" ? "var(--positive)" : "var(--negative)" }} />
                              {t.tipo === "entrada" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap mono"
                              style={{ color: t.tipo === "entrada" ? "var(--positive)" : "var(--negative)" }}>
                            {t.tipo === "entrada" ? "+" : "−"} {formatBRL(t.valor)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => handleDelete(t.id)}
                              disabled={deletandoId === t.id}
                              className="rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40"
                              style={confirmandoId === t.id
                                ? { background: "rgba(248,113,113,0.2)", color: "var(--negative)", border: "1px solid rgba(248,113,113,0.3)" }
                                : { color: "rgba(255,255,255,0.2)" }}
                              onMouseEnter={(e) => { if (confirmandoId !== t.id) e.currentTarget.style.color = "var(--negative)"; }}
                              onMouseLeave={(e) => { if (confirmandoId !== t.id) e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}
                            >
                              {deletandoId === t.id ? "…" : confirmandoId === t.id ? "Confirmar" : "✕"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile */}
              <ul className="sm:hidden divide-y rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)", borderColor: "var(--border)" }}>
                {transacoesFiltradas.map((t) => (
                  <li key={t.id}
                      className="flex items-center justify-between px-4 py-3.5 gap-3 min-h-[52px]"
                      style={{ borderColor: "var(--border)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white/80 truncate">{t.descricao}</p>
                      <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5">
                        <span>{formatData(t.data)}</span>
                        <span>·</span>
                        <span>{CATEGORY_ICONS[t.categoria] ?? "💰"} {t.categoria}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <p className="text-sm font-bold mono"
                         style={{ color: t.tipo === "entrada" ? "var(--positive)" : "var(--negative)" }}>
                        {t.tipo === "entrada" ? "+" : "−"} {formatBRL(t.valor)}
                      </p>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletandoId === t.id}
                        className="rounded-lg p-2.5 -m-1 text-xs font-medium transition-colors disabled:opacity-40"
                        style={confirmandoId === t.id
                          ? { background: "rgba(248,113,113,0.2)", color: "var(--negative)", border: "1px solid rgba(248,113,113,0.3)" }
                          : { color: "rgba(255,255,255,0.2)" }}
                      >
                        {deletandoId === t.id ? "…" : confirmandoId === t.id ? "✓?" : "✕"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
