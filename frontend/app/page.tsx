"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AmbientGlow from "./components/AmbientGlow";
import Extrato from "./components/Extrato";
import Investimentos from "./components/Investimentos";
import Mensal from "./components/Mensal";
import Resumo from "./components/Resumo";
import TransacaoInput from "./components/TransacaoInput";
import { clearAuth, getUser, isLoggedIn } from "./lib/auth";
import ErroRede from "./components/ErroRede";

type Aba = "dashboard" | "mensal" | "extrato" | "investimentos";

const ABAS: { id: Aba; label: string; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <rect x="1" y="1" width="6" height="6" rx="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" opacity=".4" />
      </svg>
    ),
  },
  {
    id: "mensal",
    label: "Mensal",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <rect x="1" y="4" width="14" height="11" rx="2" opacity=".3" />
        <rect x="1" y="6" width="14" height="9" rx="1.5" />
        <rect x="4" y="1" width="2" height="4" rx="1" />
        <rect x="10" y="1" width="2" height="4" rx="1" />
      </svg>
    ),
  },
  {
    id: "extrato",
    label: "Extrato",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <rect x="2" y="1" width="12" height="14" rx="2" opacity=".3" />
        <rect x="2" y="1" width="12" height="14" rx="2" opacity=".1" />
        <rect x="4" y="4" width="5" height="1.5" rx=".75" />
        <rect x="4" y="7" width="8" height="1.5" rx=".75" />
        <rect x="4" y="10" width="6" height="1.5" rx=".75" />
        <path d="M2 1h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fillRule="evenodd" clipRule="evenodd" opacity="0" />
      </svg>
    ),
  },
  {
    id: "investimentos",
    label: "Investimentos",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M1 12 L4 8 L7 10 L11 4 L15 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="15" cy="6" r="1.5" />
      </svg>
    ),
  },
];

const TITULOS: Record<Aba, string> = {
  dashboard:     "Dashboard",
  mensal:        "Visão mensal",
  extrato:       "Extrato de transações",
  investimentos: "Investimentos",
};

const TITULOS_MOBILE: Record<Aba, string> = {
  dashboard:     "Dashboard",
  mensal:        "Mensal",
  extrato:       "Extrato",
  investimentos: "Investimentos",
};

function FinlyLogo() {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {/* mark */}
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="shrink-0">
        <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
        <path
          d="M8 20V8h8M8 14h6"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7c3aed" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
        Finly
      </span>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [erroRede, setErroRede] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    } else {
      setAuthed(true);
      const user = getUser();
      if (user) setNomeUsuario(user.nome);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`).catch(() => {
        setErroRede("Servidor indisponível no momento. Algumas funcionalidades podem não funcionar.");
      });
    }
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.replace("/login");
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen text-white" style={{ background: "var(--s0)" }}>
      <AmbientGlow />

      {/* ── HEADER ── */}
      <header
        className="relative border-b sticky top-0 z-20 backdrop-blur-xl"
        style={{ borderColor: "var(--border)", background: "rgba(8,11,20,0.85)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">

          <FinlyLogo />

          {/* Nav pills — desktop */}
          <nav
            className="hidden sm:flex items-center gap-1 p-1 rounded-xl"
            style={{ background: "var(--s2)", border: "1px solid var(--border)" }}
          >
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${aba === a.id
                    ? "text-white shadow-lg"
                    : "text-white/40 hover:text-white/70"}`}
                style={aba === a.id ? {
                  background: "var(--accent)",
                  boxShadow: "0 4px 14px var(--accent-glow)",
                } : {}}
              >
                {a.icon}
                <span className="hidden lg:inline">{a.label}</span>
              </button>
            ))}
          </nav>

          {/* Mobile: título */}
          <span className="sm:hidden text-sm font-medium text-white/60 truncate">
            {TITULOS_MOBILE[aba]}
          </span>

          {/* User + logout */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:block text-xs text-white/30 max-w-[100px] truncate">
              {nomeUsuario}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
              style={{ border: "1px solid var(--border)", background: "var(--s2)" }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative mx-auto max-w-6xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8 space-y-4 sm:space-y-6">

        {erroRede && (
          <ErroRede mensagem={erroRede} onFechar={() => setErroRede(null)} duracao={8000} />
        )}

        {/* Dashboard */}
        {aba === "dashboard" && (
          <>
            <div
              className="rounded-2xl p-4 sm:p-6 animate-stagger-in"
              style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3 sm:mb-4"
                 style={{ color: "var(--accent)" }}>
                Registrar transação
              </p>
              <TransacaoInput onTransacaoCriada={() => setRefreshKey((k) => k + 1)} />
            </div>

            <div
              className="rounded-2xl p-4 sm:p-6 animate-stagger-in"
              style={{ background: "var(--s1)", border: "1px solid var(--border)", animationDelay: "60ms" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-5"
                 style={{ color: "var(--accent)" }}>
                Resumo financeiro
              </p>
              <Resumo refreshKey={refreshKey} />
            </div>
          </>
        )}

        {/* Mensal */}
        {aba === "mensal" && (
          <div
            className="rounded-2xl p-4 sm:p-6 animate-stagger-in"
            style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-5"
               style={{ color: "var(--accent)" }}>
              Visão mensal
            </p>
            <Mensal refreshKey={refreshKey} />
          </div>
        )}

        {/* Extrato */}
        {aba === "extrato" && (
          <div
            className="rounded-2xl p-4 sm:p-6 animate-stagger-in"
            style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-5"
               style={{ color: "var(--accent)" }}>
              Extrato de transações
            </p>
            <Extrato refreshKey={refreshKey} />
          </div>
        )}

        {/* Investimentos */}
        {aba === "investimentos" && (
          <div
            className="rounded-2xl p-4 sm:p-6 animate-stagger-in"
            style={{ background: "var(--s1)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-4 sm:mb-5"
               style={{ color: "var(--accent)" }}>
              Investimentos
            </p>
            <Investimentos refreshKey={refreshKey} />
          </div>
        )}

      </main>

      {/* ── BOTTOM NAV — mobile only ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl"
        style={{ borderTop: "1px solid var(--border)", background: "rgba(8,11,20,0.96)" }}
      >
        <div className="flex items-stretch justify-around px-1 pb-safe">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 px-1 transition-colors relative"
            >
              {/* active pill */}
              {aba === a.id && (
                <span
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
                />
              )}
              <span
                className={`transition-all duration-200 ${aba === a.id ? "scale-110" : "scale-100 opacity-40"}`}
                style={aba === a.id ? { color: "var(--accent)" } : {}}
              >
                {a.icon}
              </span>
              <span
                className="text-[10px] font-medium leading-tight transition-colors"
                style={aba === a.id ? { color: "var(--accent)" } : { color: "rgba(255,255,255,0.35)" }}
              >
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
