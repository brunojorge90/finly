"use client";

import { useEffect } from "react";

interface Props {
  mensagem: string;
  onFechar: () => void;
  /** Auto-dismiss em ms (default: 6000). Passe 0 para não fechar automaticamente. */
  duracao?: number;
}

export default function ErroRede({ mensagem, onFechar, duracao = 6000 }: Props) {
  useEffect(() => {
    if (duracao <= 0) return;
    const timer = setTimeout(onFechar, duracao);
    return () => clearTimeout(timer);
  }, [onFechar, duracao]);

  return (
    <div
      role="alert"
      className="animate-slide-in flex items-center gap-3 rounded-xl border border-red-500/20
                 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      <span className="text-red-400 text-base leading-none shrink-0" aria-hidden="true">!</span>
      <p className="flex-1 min-w-0">{mensagem}</p>
      <button
        onClick={onFechar}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400/60
                   hover:text-red-300 hover:bg-red-500/10 transition-colors"
        aria-label="Fechar alerta de erro"
      >
        Fechar
      </button>
    </div>
  );
}
