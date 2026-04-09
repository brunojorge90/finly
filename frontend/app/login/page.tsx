"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AmbientGlow from "../components/AmbientGlow";
import { setAuth } from "../lib/auth";

type Aba = "login" | "registro";

export default function LoginPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("login");

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setAuth("dev-token", { nome: "Dev User", email: "dev@finly.local" });
      router.replace("/");
    }
  }, [router]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    const endpoint = aba === "login" ? "/login" : "/register";
    const body = aba === "login"
      ? { email, senha }
      : { nome, email, senha };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail ?? "Erro ao autenticar");
      }

      setAuth(data.token, { nome: data.nome, email: data.email });
      router.push("/");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--s0)" }}>
      <AmbientGlow />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#login-logo-grad)" />
            <path d="M8 20V8h8M8 14h6" stroke="white" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="login-logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-2xl font-bold text-white tracking-tight">Finly</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
             style={{ background: "var(--s1)", border: "1px solid var(--border)" }}>
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
               style={{ background: "var(--s2)", border: "1px solid var(--border)" }}>
            {(["login", "registro"] as Aba[]).map((a) => (
              <button
                key={a}
                onClick={() => { setAba(a); setErro(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${aba === a ? "text-white" : "text-white/40 hover:text-white/70"}`}
                style={aba === a ? {
                  background: "var(--accent)",
                  boxShadow: "0 4px 14px var(--accent-glow)",
                } : {}}
              >
                {a === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {aba === "registro" && (
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  required
                  disabled={loading}
                  className={`w-full rounded-xl border px-4 py-3 text-sm
                             text-white placeholder-white/30 focus:outline-none focus:ring-2
                             focus:ring-blue-500 focus:border-transparent disabled:opacity-50
                             transition-colors
                             ${erro ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/5"}`}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
                className={`w-full rounded-xl border px-4 py-3 text-sm
                           text-white placeholder-white/30 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent disabled:opacity-50
                           transition-colors
                           ${erro ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/5"}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={loading}
                className={`w-full rounded-xl border px-4 py-3 text-sm
                           text-white placeholder-white/30 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent disabled:opacity-50
                           transition-colors
                           ${erro ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/5"}`}
              />
            </div>

            {erro && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3
                            text-xs text-red-300">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all
                         hover:brightness-110 active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2"
              style={{ background: "var(--accent)", boxShadow: "0 4px 14px var(--accent-glow)" }}
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full
                                   border-2 border-white border-t-transparent" />
                  {aba === "login" ? "Entrando…" : "Criando conta…"}
                </>
              ) : (
                aba === "login" ? "Entrar" : "Criar conta"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
