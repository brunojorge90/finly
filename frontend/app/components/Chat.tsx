"use client";

import { useEffect, useRef, useState } from "react";
import { fetchApi } from "../lib/auth";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

interface Contexto {
  saldo: { saldo: number };
  resumo: Record<string, number>;
  transacoes: { tipo: string; valor: number; descricao: string; categoria: string; data: string }[];
  investimentos: { tipo: string; valor: number; descricao: string; data: string }[];
  mensal: { mes: string; entradas: number; saidas: number }[];
}

const SUGESTOES = [
  "Qual meu saldo atual?",
  "Quanto meu investimento pode render ao mês?",
  "Quanto gastei em Alimentação este mês?",
  "Quais foram minhas últimas transações?",
  "Em qual categoria gasto mais?",
  "Faça uma análise dos meus gastos",
];

// Renderiza markdown simples sem dependência externa
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Heading ## ou ###
        if (/^###\s/.test(line))
          return <p key={i} className="font-bold text-white mt-2">{renderInline(line.replace(/^###\s/, ""))}</p>;
        if (/^##\s/.test(line))
          return <p key={i} className="font-bold text-blue-200 text-base mt-2">{renderInline(line.replace(/^##\s/, ""))}</p>;
        if (/^#\s/.test(line))
          return <p key={i} className="font-bold text-blue-100 text-lg mt-2">{renderInline(line.replace(/^#\s/, ""))}</p>;
        // Lista com - ou *
        if (/^[-*]\s/.test(line))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-400 shrink-0 mt-0.5">•</span>
              <span>{renderInline(line.replace(/^[-*]\s/, ""))}</span>
            </div>
          );
        // Lista numerada
        if (/^\d+\.\s/.test(line))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-400 shrink-0">{line.match(/^\d+/)?.[0]}.</span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        // Linha em branco
        if (line.trim() === "") return <div key={i} className="h-1" />;
        // Parágrafo normal
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Processa **bold**, *italic* e `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part))
      return <em key={i} className="italic text-blue-200">{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part))
      return <code key={i} className="bg-blue-950 rounded px-1 text-xs font-mono text-emerald-300">{part.slice(1, -1)}</code>;
    return part;
  });
}

export default function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "assistant",
      content:
        "Olá! 👋 Sou o Finly, seu assistente financeiro. Posso analisar seus gastos, investimentos, saldo e dar insights financeiros personalizados. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Carrega o contexto uma única vez ao montar
  useEffect(() => {
    async function carregarContexto() {
      try {
        const [saldoRes, resumoRes, transacoesRes, investimentosRes, mensalRes] =
          await Promise.all([
            fetchApi("/saldo"),
            fetchApi("/resumo"),
            fetchApi("/transacoes"),
            fetchApi("/investimentos"),
            fetchApi("/mensal"),
          ]);
        const [saldo, resumoData, transacoes, investimentos, mensal] = await Promise.all([
          saldoRes.json(),
          resumoRes.json(),
          transacoesRes.json(),
          investimentosRes.ok ? investimentosRes.json() : [],
          mensalRes.ok ? mensalRes.json() : [],
        ]);

        // Transforma a lista de resumo do backend em um Record<string, number> (apenas saídas)
        const resumo: Record<string, number> = {};
        resumoData.forEach((item: any) => {
          if (item.tipo === "saida") {
            resumo[item.categoria] = (resumo[item.categoria] || 0) + item.total;
          }
        });

        setContexto({ saldo, resumo, transacoes, investimentos, mensal });
      } catch {
        // contexto fica null, chat ainda funciona sem dados
      }
    }
    carregarContexto();
  }, []);

  function buildSystemPrompt(ctx: Contexto): string {
    const totalInvestido = ctx.investimentos
      .filter((t) => t.tipo === "entrada")
      .reduce((s, t) => s + t.valor, 0);
    const totalResgatado = ctx.investimentos
      .filter((t) => t.tipo === "saida")
      .reduce((s, t) => s + t.valor, 0);
    const patrimonioLiquido = totalInvestido - totalResgatado;

    const gastoTotal = Object.values(ctx.resumo).reduce((s, v) => s + v, 0);
    const categoriaTop = Object.entries(ctx.resumo).sort((a, b) => b[1] - a[1])[0];

    return `Você é o Finly, um assistente financeiro pessoal inteligente e proativo. Responda sempre em português brasileiro, de forma clara, objetiva e com formatação markdown quando útil (use **negrito**, listas, etc.).

## Perfil financeiro do usuário (data de hoje: ${new Date().toLocaleDateString("pt-BR")})

**Saldo em conta:** R$ ${ctx.saldo.saldo.toFixed(2)}
**Patrimônio investido líquido:** R$ ${patrimonioLiquido.toFixed(2)} (aportado: R$ ${totalInvestido.toFixed(2)}, resgatado: R$ ${totalResgatado.toFixed(2)})
**Total de gastos registrados:** R$ ${gastoTotal.toFixed(2)}
${categoriaTop ? `**Maior categoria de gasto:** ${categoriaTop[0]} (R$ ${Number(categoriaTop[1]).toFixed(2)})` : ""}

**Gastos por categoria:**
${Object.entries(ctx.resumo).map(([cat, val]) => `- ${cat}: R$ ${Number(val).toFixed(2)}`).join("\n")}

**Histórico mensal:**
${ctx.mensal.map((m) => `- ${m.mes}: entradas R$ ${m.entradas?.toFixed(2) ?? "0,00"} | saídas R$ ${m.saidas?.toFixed(2) ?? "0,00"}`).join("\n")}

**Últimas transações (${ctx.transacoes.length} no total):**
${ctx.transacoes.slice(0, 20).map((t) => `- [${t.data}] ${t.tipo === "entrada" ? "+" : "-"} R$ ${t.valor.toFixed(2)} | ${t.descricao} (${t.categoria})`).join("\n")}

**Histórico de investimentos:**
${ctx.investimentos.map((t) => `- [${t.data}] ${t.tipo === "entrada" ? "Aporte" : "Resgate"} R$ ${t.valor.toFixed(2)} | ${t.descricao}`).join("\n") || "Nenhum investimento registrado."}

## Instruções
- Responda com base nos dados acima quando disponíveis.
- Para cálculos de rendimento, use taxas reais do mercado brasileiro: CDI ~10,65% a.a., Tesouro Selic ~10,65% a.a., CDB 100% CDI ~10,65% a.a., poupança ~6,17% a.a. Mostre o cálculo mensal: taxa_mensal = (1 + taxa_anual)^(1/12) - 1.
- Para análises, seja proativo: aponte padrões, alertas de gastos, oportunidades de economia.
- Se o usuário pedir uma análise geral, estruture com: resumo do saldo, maiores gastos, evolução mensal, e sugestões de melhoria.
- Use formatação markdown para tornar respostas longas mais legíveis.`;
  }

  async function enviar(texto?: string) {
    const pergunta = texto ?? input.trim();
    if (!pergunta) return;

    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { role: "user", content: pergunta },
    ];
    setMensagens(novasMensagens);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = contexto
        ? buildSystemPrompt(contexto)
        : "Você é o Finly, um assistente financeiro pessoal. Responda em português. Os dados financeiros do usuário ainda estão carregando.";

      const res = await fetchApi("/chat", {
        method: "POST",
        body: JSON.stringify({
          mensagens: novasMensagens,
          systemPrompt,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.detail || `Erro do servidor: ${res.status}`);
      }

      const resposta = data?.resposta ?? "Não consegui gerar uma resposta. Tente novamente.";

      setMensagens((prev) => [
        ...prev,
        { role: "assistant", content: resposta },
      ]);
    } catch (err: any) {
      setMensagens((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Ocorreu um erro: ${err.message || "Erro ao consultar o assistente."} Verifique sua conexão e tente novamente.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] sm:h-[calc(100vh-160px)] min-h-[400px]">
      {/* Indicador de contexto carregado */}
      {!contexto && (
        <div className="text-xs text-blue-400/60 text-center mb-2 flex items-center justify-center gap-1">
          <span className="inline-block h-2 w-2 animate-spin rounded-full border border-blue-400/40 border-t-blue-400" />
          Carregando seus dados financeiros…
        </div>
      )}

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl bg-blue-950/40 border border-blue-800/40 mb-4">
        {mensagens.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm mr-2 shrink-0 mt-1">
                💰
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${m.role === "user"
                  ? "bg-blue-500 text-white rounded-br-sm whitespace-pre-wrap"
                  : "bg-blue-900/60 text-blue-100 border border-blue-700/40 rounded-bl-sm"
                }`}
            >
              {m.role === "assistant"
                ? <MarkdownText text={m.content} />
                : m.content
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm mr-2 shrink-0">
              💰
            </div>
            <div className="bg-blue-900/60 border border-blue-700/40 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugestões */}
      {mensagens.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              onClick={() => enviar(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-blue-500/50 text-blue-300
                         hover:bg-blue-500/20 hover:text-white transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); enviar(); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre gastos, investimentos, saldo…"
          disabled={loading}
          className="flex-1 rounded-xl border border-blue-700/50 bg-blue-950/50 px-4 py-3 text-sm
                     text-white placeholder-blue-400 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600 px-5 py-3
                     text-sm font-semibold text-white transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
