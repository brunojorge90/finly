"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuth } from "../lib/auth";

type Aba = "login" | "registro";

export default function LoginPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("login");
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
    <div className="min-h-screen bg-[#060d1f] flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600
                          flex items-center justify-center text-xl shadow-lg shadow-blue-500/25">
            💰
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Finly</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-8">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8 mb-6">
            {(["login", "registro"] as Aba[]).map((a) => (
              <button
                key={a}
                onClick={() => { setAba(a); setErro(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${aba === a
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "text-white/50 hover:text-white/80"}`}
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
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm
                             text-white placeholder-white/20 focus:outline-none focus:ring-2
                             focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm
                           text-white placeholder-white/20 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm
                           text-white placeholder-white/20 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
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
              className="w-full rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600
                         py-3 text-sm font-semibold text-white transition-colors
                         shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2"
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
