"use client";

import { useState } from "react";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
}

interface Props {
  onTransacaoCriada?: (transacao: Transacao) => void;
}

export default function TransacaoInput({ onTransacaoCriada }: Props) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Transacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;

    setLoading(true);
    setConfirmacao(null);
    setErro(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transacao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Erro ${res.status}`);
      }

      const transacao: Transacao = await res.json();
      setConfirmacao(transacao);
      setTexto("");
      onTransacaoCriada?.(transacao);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex: gasto coca 3 reais, recebi salário 5000…"
          disabled={loading}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm
                     text-white placeholder-white/30 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:border-transparent disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !texto.trim()}
          className="rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600 px-6 py-3
                     text-sm font-semibold text-white transition-colors shadow-lg shadow-blue-500/20
                     disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full
                               border-2 border-white border-t-transparent" />
              Processando…
            </>
          ) : (
            "Adicionar"
          )}
        </button>
      </form>

      {confirmacao && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-500/20
                        bg-emerald-500/10 px-4 py-3 text-sm">
          <span className="text-emerald-400 text-base leading-none mt-0.5">✓</span>
          <div>
            <p className="font-medium text-emerald-300">{confirmacao.descricao}</p>
            <p className="text-emerald-400/80 mt-0.5">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold mr-2
                  ${confirmacao.tipo === "entrada"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"}`}
              >
                {confirmacao.tipo === "entrada" ? "Entrada" : "Saída"}
              </span>
              <span className="font-semibold text-white">
                R$ {confirmacao.valor.toFixed(2).replace(".", ",")}
              </span>
              <span className="mx-1 text-white/20">·</span>
              <span className="text-white/50">{confirmacao.categoria}</span>
            </p>
          </div>
        </div>
      )}

      {erro && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-500/20
                        bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="text-red-400 text-base leading-none mt-0.5">✕</span>
          <p>{erro}</p>
        </div>
      )}
    </div>
  );
}
