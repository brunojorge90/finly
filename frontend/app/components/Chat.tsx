"use client";

import { useEffect, useRef, useState } from "react";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES = [
  "Qual meu saldo atual?",
  "Quanto gastei em Alimentação?",
  "Quais foram minhas últimas transações?",
  "Qual categoria teve mais gastos?",
];

export default function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "assistant",
      content:
        "Olá! 👋 Sou o Finly, seu assistente financeiro. Posso responder perguntas sobre seu saldo, gastos por categoria, histórico de transações e muito mais. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function fetchContexto() {
    const [saldoRes, resumoRes, transacoesRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/saldo`),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/resumo`),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/transacoes`),
    ]);
    const saldo = await saldoRes.json();
    const resumo = await resumoRes.json();
    const transacoes = await transacoesRes.json();
    return { saldo, resumo, transacoes };
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
      const ctx = await fetchContexto();

      const systemPrompt = `Você é o Finly, um assistente financeiro pessoal. Responda em português, de forma clara e objetiva.

Dados financeiros atuais do usuário:
- Saldo atual: R$ ${ctx.saldo.saldo.toFixed(2)}
- Resumo por categoria: ${JSON.stringify(ctx.resumo)}
- Últimas transações: ${JSON.stringify(ctx.transacoes.slice(0, 10))}

Responda apenas com base nesses dados. Se não souber, diga que não tem informação suficiente.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: novasMensagens.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
          }),
        }
      );

      const data = await res.json();
      const resposta =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Não consegui gerar uma resposta.";

      setMensagens((prev) => [
        ...prev,
        { role: "assistant", content: resposta },
      ]);
    } catch {
      setMensagens((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Ocorreu um erro ao consultar o assistente. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[500px]">
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
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                ${m.role === "user"
                  ? "bg-blue-500 text-white rounded-br-sm"
                  : "bg-blue-900/60 text-blue-100 border border-blue-700/40 rounded-bl-sm"
                }`}
            >
              {m.content}
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
          placeholder="Pergunte sobre seus gastos, saldo, categorias…"
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
