export function Logo({ portal, dark }: { portal?: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0F7C72" />
        {[7, 11, 15, 19, 23].map((x, i) => <rect key={x} x={x} y={16 - [3, 7, 10, 6, 3][i]} width="2.4" height={[3, 7, 10, 6, 3][i] * 2} rx="1.2" fill={i === 2 ? "#F2B54B" : "#fff"} />)}
      </svg>
      <div className="leading-tight">
        <p className={`font-display text-lg font-semibold ${dark ? "text-ink" : "text-white"}`}>PolyDial</p>
        {portal && <p className={`text-xs ${dark ? "text-ink-mute" : "text-white/50"}`}>{portal}</p>}
      </div>
    </div>
  );
}
