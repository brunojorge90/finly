"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchApi, NetworkError } from "../lib/auth";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const MESES_CURTOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function labelMes(ym: string) {
  const [year, month] = ym.split("-");
  return `${MESES_CURTOS[parseInt(month) - 1]}/${year.slice(2)}`;
}

interface Props {
  refreshKey?: number;
}

export default function Investimentos({ refreshKey = 0 }: Props) {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchApi("/investimentos");
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

  useEffect(() => { fetchDados(); }, [fetchDados, refreshKey]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-white/40 text-sm gap-2">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      Carregando…
    </div>
  );

  if (erro) return (
    <div role="alert" className="animate-slide-in rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <p>{erro}</p>
      <button onClick={fetchDados} className="mt-2 underline hover:no-underline font-medium">Tentar novamente</button>
    </div>
  );

  if (transacoes.length === 0) return (
    <div className="text-center py-12">
      <p className="text-4xl mb-3">📈</p>
      <p className="text-white/50 text-sm">Nenhum investimento registrado ainda.</p>
      <p className="text-white/40 text-xs mt-1">
        Registre uma transação como "investi 500 em tesouro direto" no Dashboard.
      </p>
    </div>
  );

  const totalAportado = transacoes
    .filter((t) => t.tipo === "entrada")
    .reduce((s, t) => s + t.valor, 0);

  const totalResgatado = transacoes
    .filter((t) => t.tipo === "saida")
    .reduce((s, t) => s + t.valor, 0);

  const patrimonioLiquido = totalAportado - totalResgatado;

  // Agrupa por mês para sparkline
  const porMes: Record<string, number> = {};
  transacoes.forEach((t) => {
    const mes = t.data.slice(0, 7);
    const delta = t.tipo === "entrada" ? t.valor : -t.valor;
    porMes[mes] = (porMes[mes] ?? 0) + delta;
  });
  const meses = Object.keys(porMes).sort();
  // Patrimônio acumulado por mês
  const acumulado: number[] = [];
  let acc = 0;
  meses.forEach((m) => { acc += porMes[m]; acumulado.push(acc); });
  const maxAcc = Math.max(...acumulado, 1);

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 text-center"
             style={patrimonioLiquido >= 0
               ? { background: "var(--accent-dim)", border: "1px solid var(--border-accent)" }
               : { background: "var(--negative-dim)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1 sm:mb-2">
            Patrimônio
          </p>
          <p className="text-base sm:text-2xl font-bold mono"
             style={{ color: patrimonioLiquido >= 0 ? "var(--accent)" : "var(--negative)" }}>
            {formatBRL(patrimonioLiquido)}
          </p>
        </div>
        <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 text-center"
             style={{ background: "var(--positive-dim)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1 sm:mb-2">
            Aportado
          </p>
          <p className="text-base sm:text-2xl font-bold mono" style={{ color: "var(--positive)" }}>
            {formatBRL(totalAportado)}
          </p>
        </div>
        <div className="rounded-xl sm:rounded-2xl p-3 sm:p-5 text-center"
             style={{ background: "var(--s2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1 sm:mb-2">
            Resgatado
          </p>
          <p className="text-base sm:text-2xl font-bold mono text-white/60">
            {formatBRL(totalResgatado)}
          </p>
        </div>
      </div>

      {/* Evolução do patrimônio por mês */}
      {meses.length > 1 && (
        <div className="rounded-xl p-5"
             style={{ background: "var(--s2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
            Evolução do patrimônio
          </p>
          <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-end gap-3 h-36" style={{ minWidth: `${meses.length * 52}px` }}>
            {meses.map((m, i) => {
              const height = Math.max((acumulado[i] / maxAcc) * 100, 4);
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-white/40">{formatBRL(acumulado[i]).replace("R$\u00a0", "")}</span>
                  <div
                    className="w-full rounded-t-md transition-colors hover:brightness-125"
                    style={{ height: `${height}%`, background: "var(--accent)", opacity: 0.7 + (height / 300) }}
                    title={`${labelMes(m)}: ${formatBRL(acumulado[i])}`}
                  />
                  <span className="text-[10px] text-white/40">{labelMes(m)}</span>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Lista de transações */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 bg-white/3 border-b border-white/8">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Histórico de aportes e resgates
          </p>
        </div>
        <ul className="divide-y divide-white/5">
          {transacoes.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{t.descricao}</p>
                <p className="text-xs text-white/40 mt-0.5">{formatData(t.data)}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className={`text-sm font-bold ${t.tipo === "entrada" ? "text-emerald-400" : "text-white/50"}`}>
                  {t.tipo === "entrada" ? "+" : "−"} {formatBRL(t.valor)}
                </p>
                <span className={`text-xs ${t.tipo === "entrada" ? "text-emerald-400/60" : "text-white/30"}`}>
                  {t.tipo === "entrada" ? "Aporte" : "Resgate"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-white/40 text-center">
        Registre aportes e resgates via linguagem natural no Dashboard.
        Ex: "investi 1000 em CDB", "resgatei 500 do tesouro".
      </p>
    </div>
  );
}
