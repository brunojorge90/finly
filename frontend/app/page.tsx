"use client";

import { useState } from "react";
import Chat from "./components/Chat";
import Extrato from "./components/Extrato";
import Resumo from "./components/Resumo";
import TransacaoInput from "./components/TransacaoInput";

type Aba = "dashboard" | "extrato" | "chat";

const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "extrato",   label: "Extrato",   icon: "📋" },
  { id: "chat",      label: "Chat IA",   icon: "🤖" },
];

export default function Page() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-[#060d1f] text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-black/30 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-base shadow-lg shadow-blue-500/25">
              💰
            </div>
            <span className="font-semibold text-white tracking-tight">Finly</span>
          </div>

          {/* Nav pills */}
          <nav className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${aba === a.id
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "text-white/50 hover:text-white/80"
                  }`}
              >
                <span className="text-base leading-none">{a.icon}</span>
                <span className="hidden sm:inline">{a.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Dashboard */}
        {aba === "dashboard" && (
          <>
            {/* Input card */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-4">
                Registrar transação
              </p>
              <TransacaoInput onTransacaoCriada={() => setRefreshKey((k) => k + 1)} />
            </div>

            {/* Resumo full width */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-5">
                Resumo financeiro
              </p>
              <Resumo refreshKey={refreshKey} />
            </div>
          </>
        )}

        {/* Extrato */}
        {aba === "extrato" && (
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-5">
              Extrato de transações
            </p>
            <Extrato refreshKey={refreshKey} />
          </div>
        )}

        {/* Chat */}
        {aba === "chat" && (
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-5">
              Chat com IA
            </p>
            <Chat />
          </div>
        )}
      </main>
    </div>
  );
}
