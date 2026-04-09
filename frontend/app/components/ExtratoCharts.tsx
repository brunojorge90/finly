"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Transacao {
  id: number;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
  pagamento?: string | null;
}

interface Props {
  transacoes: Transacao[];
  mesSelecionado: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Alimentacao:  "#f59e0b",
  Transporte:   "#3b82f6",
  Moradia:      "#8b5cf6",
  Saude:        "#10b981",
  Lazer:        "#ec4899",
  Educacao:     "#6366f1",
  Salario:      "#22d3ee",
  Freelance:    "#a3e635",
  Investimentos:"#34d399",
  Outros:       "#94a3b8",
};

const MESES_CURTOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatAxisBRL(value: number) {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return value.toFixed(0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-2xl" style={{ background: "var(--s3)", border: "1px solid var(--border-accent)" }}>
      <p className="text-white/40 mb-1.5">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1629] px-3 py-2 text-xs shadow-2xl">
      <p className="font-semibold text-white">{item.name}</p>
      <p style={{ color: item.payload.fill }}>{formatBRL(item.value)}</p>
    </div>
  );
}

export default function ExtratoCharts({ transacoes, mesSelecionado }: Props) {
  if (transacoes.length === 0) return null;

  // ── KPI ──────────────────────────────────────────────────────
  const totalEntradas = transacoes
    .filter((t) => t.tipo === "entrada")
    .reduce((s, t) => s + t.valor, 0);

  const totalSaidas = transacoes
    .filter((t) => t.tipo === "saida")
    .reduce((s, t) => s + t.valor, 0);

  const saldo = totalEntradas - totalSaidas;

  // ── Donut — gastos por categoria ─────────────────────────────
  const saidasPorCat = Object.entries(
    transacoes
      .filter((t) => t.tipo === "saida")
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.categoria] = (acc[t.categoria] ?? 0) + t.valor;
        return acc;
      }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Bar — evolução temporal ───────────────────────────────────
  const evolMap: Record<string, { entradas: number; saidas: number }> = {};

  for (const t of transacoes) {
    const key =
      mesSelecionado === "todos"
        ? t.data.slice(0, 7)       // "YYYY-MM"
        : t.data.slice(8, 10);     // "DD"

    evolMap[key] ??= { entradas: 0, saidas: 0 };
    if (t.tipo === "entrada") evolMap[key].entradas += t.valor;
    else                       evolMap[key].saidas  += t.valor;
  }

  const evolData = Object.entries(evolMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      let label: string;
      if (mesSelecionado === "todos") {
        const [, mm] = key.split("-");
        label = MESES_CURTOS[parseInt(mm) - 1] ?? mm;
      } else {
        label = key; // "DD"
      }
      return { label, entradas: v.entradas, saidas: v.saidas };
    });

  const showBar = evolData.length > 1;

  return (
    <div className="space-y-4">
      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70 mb-1">
            Entradas
          </p>
          <p className="text-base font-bold text-emerald-300 truncate">
            {formatBRL(totalEntradas)}
          </p>
        </div>

        <div className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400/70 mb-1">
            Saídas
          </p>
          <p className="text-base font-bold text-red-300 truncate">
            {formatBRL(totalSaidas)}
          </p>
        </div>

        <div className="rounded-xl px-4 py-3"
             style={saldo >= 0
               ? { border: "1px solid var(--border-accent)", background: "var(--accent-dim)" }
               : { border: "1px solid rgba(251,146,60,0.2)", background: "rgba(251,146,60,0.08)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
             style={{ color: saldo >= 0 ? "var(--accent)" : "#fb923c", opacity: 0.8 }}>
            Saldo
          </p>
          <p className="text-base font-bold mono truncate"
             style={{ color: saldo >= 0 ? "var(--accent)" : "#fb923c" }}>
            {formatBRL(saldo)}
          </p>
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Donut — categorias */}
        {saidasPorCat.length > 0 && (
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
              Gastos por categoria
            </p>
            <div className="flex items-center gap-5">
              <PieChart width={148} height={148}>
                <Pie
                  data={saidasPorCat}
                  cx={70}
                  cy={70}
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {saidasPorCat.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CATEGORY_COLORS[entry.name] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>

              <ul className="flex-1 space-y-2 min-w-0">
                {saidasPorCat.map((item) => {
                  const pct = totalSaidas > 0
                    ? Math.round((item.value / totalSaidas) * 100)
                    : 0;
                  return (
                    <li key={item.name} className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ background: CATEGORY_COLORS[item.name] ?? "#64748b" }}
                        />
                        <span className="text-[11px] text-white/50 truncate flex-1">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-semibold text-white/70 shrink-0">
                          {pct}%
                        </span>
                      </div>
                      {/* progress bar */}
                      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: CATEGORY_COLORS[item.name] ?? "#64748b",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Bar — evolução temporal */}
        {showBar && (
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
              {mesSelecionado === "todos" ? "Evolução mensal" : "Evolução diária"}
            </p>

            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={evolData} barSize={7} barCategoryGap="30%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisBRL}
                  width={38}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas"   name="Saídas"   fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-center gap-5 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="inline-block w-2.5 h-2 rounded-sm bg-emerald-500" />
                Entradas
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="inline-block w-2.5 h-2 rounded-sm bg-red-500" />
                Saídas
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
