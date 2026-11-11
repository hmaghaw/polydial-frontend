// Chart building blocks. Categorical slots follow the validated reference palette order
// (slot 1 blue, 2 orange, 3 aqua) — three slots max, which validate all-pairs.
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
export const SENTIMENT = { positive: "#1baf7a", neutral: "#AEB6C4", negative: "#e34948" } as const;
const axis = { stroke: "#7C869C", fontSize: 12, tickLine: false, axisLine: false } as const;

function TipBox({ active, payload, label, fmt }: { active?: boolean; payload?: any[]; label?: string; fmt?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: <span className="font-medium tabular-nums text-ink">{fmt ? fmt(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}
const legend = <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: "#4A5672" }}>{v}</span>} />;

export function VolumeChart({ data }: { data: { day: string; calls: number; ai: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EEF0F4" />
        <XAxis dataKey="day" {...axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip content={<TipBox />} cursor={{ stroke: "#1E2A44", strokeOpacity: 0.2 }} />
        {legend}
        <Area type="monotone" dataKey="calls" name="All calls" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.08} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
        <Area type="monotone" dataKey="ai" name="Resolved by AI" stroke={SERIES[1]} strokeWidth={2} fill="none" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data, x, y, fmt, height }: { data: any[]; x: string; y: string; fmt?: (v: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={y} {...axis} width={110} stroke="#4A5672" />
        <Tooltip content={<TipBox fmt={fmt} />} cursor={{ fill: "#1E2A44", fillOpacity: 0.04 }} />
        <Bar dataKey={x} name={x[0].toUpperCase() + x.slice(1)} fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={18}
          label={{ position: "right", fontSize: 12, fill: "#4A5672", formatter: (v: number) => (fmt ? fmt(v) : v) }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SentimentStack({ data }: { data: { day: string; positive: number; neutral: number; negative: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EEF0F4" />
        <XAxis dataKey="day" {...axis} minTickGap={24} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip content={<TipBox />} cursor={{ fill: "#1E2A44", fillOpacity: 0.04 }} />
        {legend}
        {(["positive", "neutral", "negative"] as const).map((k, i) => (
          <Bar key={k} dataKey={k} name={k[0].toUpperCase() + k.slice(1)} stackId="s" fill={SENTIMENT[k]} stroke="#fff" strokeWidth={2} radius={i === 2 ? [4, 4, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-hue sequential heatmap (light → dark teal) with per-cell hover title. */
export function Heatmap({ rows, rowLabels, colLabels, unit }: { rows: number[][]; rowLabels: string[]; colLabels: string[]; unit: string }) {
  const max = Math.max(1, ...rows.flat());
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[3px] text-xs">
        <thead><tr><th />{colLabels.map((c) => <th key={c} className="px-0.5 pb-1 font-normal text-ink-mute">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><th className="pr-2 text-left font-normal text-ink-soft">{rowLabels[i]}</th>
            {r.map((v, j) => <td key={j} title={`${rowLabels[i]} ${colLabels[j]}: ${v} ${unit}`} className="h-7 w-9 rounded-[4px]" style={{ background: v ? `rgba(15,124,114,${0.12 + 0.88 * (v / max)})` : "#F1F3F7" }} />)}</tr>
        ))}</tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-mute">Fewer<span className="h-2 w-24 rounded" style={{ background: "linear-gradient(90deg, rgba(15,124,114,.12), rgba(15,124,114,1))" }} />More {unit}</div>
    </div>
  );
}

export function Meter({ label, value, max = 100, suffix = "%", children }: { label: string; value: number; max?: number; suffix?: string; children?: ReactNode }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-ink-soft">{label}</span><span className="font-medium tabular-nums">{value}{suffix}</span></div>
      <div className="mt-1.5 h-2 rounded-full bg-ink/5"><div className="h-2 rounded-full bg-signal" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      {children}
    </div>
  );
}
