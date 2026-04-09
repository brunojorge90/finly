"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchApi, NetworkError } from "../lib/auth";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
  parcela_grupo?: string | null;
  parcela_num?: number | null;
  parcela_total?: number | null;
}

interface Props {
  onTransacaoCriada?: (transacao: Transacao) => void;
}

const OPCOES_PAGAMENTO = [
  { value: "VR",     label: "VR",     sub: "Vale-Refeição" },
  { value: "VA",     label: "VA",     sub: "Vale-Alimentação" },
  { value: "Cartao", label: "Cartão", sub: "Crédito / Débito" },
];

const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nomeMesCurto(dataStr: string): string {
  const [ano, mes] = dataStr.split("-");
  return `${MESES_PT[parseInt(mes) - 1]} ${ano}`;
}

export default function TransacaoInput({ onTransacaoCriada }: Props) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Transacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // modal de pagamento
  const [modalTransacao, setModalTransacao] = useState<Transacao | null>(null);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);
  const [confirmacaoParcelada, setConfirmacaoParcelada] = useState<Transacao[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;

    setLoading(true);
    setConfirmacao(null);
    setConfirmacaoParcelada(null);
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

      const data = await res.json();
      setTexto("");

      // Compra parcelada — resposta é uma lista
      if (Array.isArray(data)) {
        const parcelas: Transacao[] = data;
        setConfirmacaoParcelada(parcelas);
        setConfirmacao(null);
        onTransacaoCriada?.(parcelas[0]);
        return;
      }

      // Transação normal
      const transacao: Transacao = data;
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
    } catch (err) {
      // A transação já foi salva — mostra aviso discreto se não conseguiu registrar o pagamento
      if (err instanceof NetworkError) {
        setErro("Transação salva, mas não foi possível registrar a forma de pagamento (servidor offline).");
      }
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
          className="input-obsidian flex-1 rounded-xl px-4 py-3 text-sm
                     text-white placeholder-white/30 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
          style={{
            background: "var(--s2)",
            border: "1px solid var(--border)",
          }}
        />
        <button
          type="submit"
          disabled={loading || !texto.trim()}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0
                     w-28 sm:w-auto hover:brightness-110 active:scale-[0.97]"
          style={{
            background: "var(--accent)",
            boxShadow: "0 4px 14px var(--accent-glow)",
          }}
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
        <div className="animate-slide-in mt-3 flex items-start gap-3 rounded-xl border border-emerald-500/20
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

      {confirmacaoParcelada && (
        <div className="animate-slide-in mt-3 flex items-start gap-3 rounded-xl border border-blue-500/20
                        bg-blue-500/10 px-4 py-3 text-sm">
          <span className="text-blue-400 text-base leading-none mt-0.5">✓</span>
          <div>
            <p className="font-medium text-blue-300">
              Compra parcelada criada: {confirmacaoParcelada.length}x{" "}
              {formatBRL(confirmacaoParcelada[0].valor)}/parcela
            </p>
            <p className="text-blue-400/80 mt-0.5 text-xs">
              Lançada de {nomeMesCurto(confirmacaoParcelada[0].data)} até{" "}
              {nomeMesCurto(confirmacaoParcelada[confirmacaoParcelada.length - 1].data)}
              <span className="mx-1 text-white/20">·</span>
              <span className="text-white/50">{confirmacaoParcelada[0].categoria}</span>
            </p>
          </div>
        </div>
      )}

      {erro && (
        <div className="animate-slide-in mt-3 flex items-start gap-3 rounded-xl border border-red-500/20
                        bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="text-red-400 text-base leading-none mt-0.5">✕</span>
          <p>{erro}</p>
        </div>
      )}

      {/* Modal de forma de pagamento — renderizado no body para escapar de stacking contexts */}
      {modalTransacao && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={fecharModal}
          />

          <div className="relative w-full max-w-xs rounded-2xl p-6"
               style={{ background: "var(--s3)", border: "1px solid var(--border-accent)", boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px var(--accent-dim)" }}>
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
                             active:scale-[0.98] active:bg-white/10
                             focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none
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
        </div>,
        document.body
      )}
    </div>
  );
}
