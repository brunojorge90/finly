"use client";

import { useState } from "react";
import { fetchApi } from "../lib/auth";

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

const OPCOES_PAGAMENTO = [
  { value: "VR",     label: "VR",     sub: "Vale-Refeição" },
  { value: "VA",     label: "VA",     sub: "Vale-Alimentação" },
  { value: "Cartao", label: "Cartão", sub: "Crédito / Débito" },
];

export default function TransacaoInput({ onTransacaoCriada }: Props) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Transacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // modal de pagamento
  const [modalTransacao, setModalTransacao] = useState<Transacao | null>(null);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;

    setLoading(true);
    setConfirmacao(null);
    setErro(null);

    try {
      const res = await fetchApi("/transacao", {
        method: "POST",
        body: JSON.stringify({ texto }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Erro ${res.status}`);
      }

      const transacao: Transacao = await res.json();
      setTexto("");
      onTransacaoCriada?.(transacao);

      if (transacao.categoria === "Alimentacao") {
        setModalTransacao(transacao);
      } else {
        setConfirmacao(transacao);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handlePagamento(pagamento: string) {
    if (!modalTransacao) return;
    setSalvandoPagamento(true);
    try {
      await fetchApi(`/transacao/${modalTransacao.id}/pagamento`, {
        method: "PATCH",
        body: JSON.stringify({ pagamento }),
      });
    } catch {
      // falha silenciosa — a transação já foi salva, só o pagamento não ficou registrado
    } finally {
      setConfirmacao(modalTransacao);
      setModalTransacao(null);
      setSalvandoPagamento(false);
    }
  }

  function fecharModal() {
    setConfirmacao(modalTransacao);
    setModalTransacao(null);
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

      {/* Modal de forma de pagamento */}
      {modalTransacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={fecharModal}
          />

          <div className="relative w-full max-w-xs rounded-2xl border border-white/10
                          bg-[#0d1629] shadow-2xl p-6">
            {/* cabeçalho */}
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xl">🍽️</span>
              <h3 className="text-sm font-semibold text-white">Como foi o pagamento?</h3>
            </div>
            <p className="mb-5 text-xs text-white/40 truncate">
              {modalTransacao.descricao} ·{" "}
              <span className="text-white/60 font-medium">
                R$ {modalTransacao.valor.toFixed(2).replace(".", ",")}
              </span>
            </p>

            <div className="flex flex-col gap-2">
              {OPCOES_PAGAMENTO.map((op) => (
                <button
                  key={op.value}
                  disabled={salvandoPagamento}
                  onClick={() => handlePagamento(op.value)}
                  className="flex items-center gap-3 rounded-xl border border-white/8
                             bg-white/4 hover:bg-white/8 hover:border-blue-500/40
                             px-4 py-3 text-left transition-colors disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{op.label}</p>
                    <p className="text-xs text-white/40">{op.sub}</p>
                  </div>
                  {salvandoPagamento && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full
                                     border-2 border-white/20 border-t-white/60" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={fecharModal}
              className="mt-4 w-full rounded-xl border border-white/8 py-2.5 text-xs
                         font-medium text-white/40 hover:text-white/70 transition-colors"
            >
              Pular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
