"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Extrato from "./components/Extrato";
import Investimentos from "./components/Investimentos";
import Mensal from "./components/Mensal";
import Resumo from "./components/Resumo";
import TransacaoInput from "./components/TransacaoInput";
import { clearAuth, getUser, isLoggedIn } from "./lib/auth";

type Aba = "dashboard" | "mensal" | "extrato" | "investimentos";

const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: "dashboard",     label: "Dashboard",    icon: "📊" },
  { id: "mensal",        label: "Mensal",        icon: "📅" },
  { id: "extrato",       label: "Extrato",       icon: "📋" },
  { id: "investimentos", label: "Investimentos", icon: "📈" },
];

const TITULOS: Record<Aba, string> = {
  dashboard:     "Dashboard",
  mensal:        "Visão mensal",
  extrato:       "Extrato de transações",
  investimentos: "Investimentos",
};

export default function Page() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    } else {
      setAuthed(true);
      const user = getUser();
      if (user) setNomeUsuario(user.nome);
    }
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.replace("/login");
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-[#060d1f] text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* ── HEADER ── */}
      <header className="relative border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600
                            flex items-center justify-center text-sm shadow-lg shadow-blue-500/25">
              💰
            </div>
            <span className="font-semibold text-white tracking-tight text-sm sm:text-base">Finly</span>
          </div>

          {/* Nav pills — desktop only */}
          <nav className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${aba === a.id
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "text-white/50 hover:text-white/80"}`}
              >
                <span className="text-sm leading-none">{a.icon}</span>
                <span className="hidden lg:inline">{a.label}</span>
              </button>
            ))}
          </nav>

          {/* Mobile: título da aba atual */}
          <span className="sm:hidden text-sm font-medium text-white/70 truncate">
            {TITULOS[aba]}
          </span>

          {/* User + logout */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:block text-xs text-white/40 max-w-[100px] truncate">
              {nomeUsuario}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10
                         px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      {/* pb-24 no mobile para não ficar atrás da bottom nav */}
      <main className="relative mx-auto max-w-6xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8 space-y-4 sm:space-y-6">

        {/* Dashboard */}
        {aba === "dashboard" && (
          <>
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-3 sm:mb-4">
                Registrar transação
              </p>
              <TransacaoInput onTransacaoCriada={() => setRefreshKey((k) => k + 1)} />
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-4 sm:mb-5">
                Resumo financeiro
              </p>
              <Resumo refreshKey={refreshKey} />
            </div>
          </>
        )}

        {/* Mensal */}
        {aba === "mensal" && (
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-4 sm:mb-5">
              Visão mensal
            </p>
            <Mensal refreshKey={refreshKey} />
          </div>
        )}

        {/* Extrato */}
        {aba === "extrato" && (
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-4 sm:mb-5">
              Extrato de transações
            </p>
            <Extrato refreshKey={refreshKey} />
          </div>
        )}

        {/* Investimentos */}
        {aba === "investimentos" && (
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-4 sm:mb-5">
              Investimentos
            </p>
            <Investimentos refreshKey={refreshKey} />
          </div>
        )}


      </main>

      {/* ── BOTTOM NAV — mobile only ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20
                      border-t border-white/8 bg-[#060d1f]/95 backdrop-blur-xl">
        <div className="flex items-stretch justify-around px-1 pb-safe">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 px-1
                          text-[10px] font-medium transition-colors
                ${aba === a.id ? "text-blue-400" : "text-white/35"}`}
            >
              <span className={`text-xl transition-transform duration-200 ${aba === a.id ? "scale-110" : ""}`}>
                {a.icon}
              </span>
              <span className="leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
