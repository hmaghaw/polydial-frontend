import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Phone, RefreshCw, Volume2 } from "lucide-react";
import { Badge, Button, DataTable, dateTime, EmptyState, ErrorState, Loading, money, ordersApi, PageHeader, time, useAction, useToast, cn, type OrderStatus, type RestaurantOrder, type Tone } from "@polydial/shared";

export const statusMeta: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "New", tone: "warn" }, confirmed: { label: "Confirmed", tone: "info" }, preparing: { label: "Preparing", tone: "info" },
  ready: { label: "Ready", tone: "good" }, out_for_delivery: { label: "Out for delivery", tone: "info" }, delivered: { label: "Delivered", tone: "neutral" }, cancelled: { label: "Cancelled", tone: "bad" },
};

/** Short two-tone chime via Web Audio — no asset needed. */
export function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext; const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.45);
    });
  } catch { /* audio unavailable */ }
}
const SOUND_KEY = "pd_order_sound";

function OrderCard({ o, onStatus, busy }: { o: RestaurantOrder; onStatus: (s: OrderStatus) => void; busy: boolean }) {
  const m = statusMeta[o.order_status];
  const isNew = o.order_status === "pending";
  return (
    <article className={cn("flex flex-col rounded-xl border bg-white", isNew ? "border-live ring-2 ring-live/40" : "border-line")} aria-label={`Order ${o.order_id}`}>
      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div><p className="font-display text-lg font-semibold">#{o.order_id} · {o.customer_name}</p>
          <p className="flex items-center gap-1 text-xs text-ink-mute"><Phone className="h-3 w-3" />{o.customer_phone} · placed {time(o.order_time)}{o.scheduled_time && ` · for ${time(o.scheduled_time)}`}</p></div>
        <Badge tone={m.tone}>{isNew && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}{m.label}</Badge>
      </header>
      <ul className="flex-1 space-y-2 px-4 py-3 text-sm">{o.items.map((l) => (
        <li key={l.order_item_id} className="flex justify-between gap-3"><span><b className="tabular-nums">{l.quantity}×</b> {l.name}
          {[...l.options, ...l.modifiers].length > 0 && <span className="block text-xs text-ink-mute">{[...l.options, ...l.modifiers].join(", ")}</span>}</span><span className="tabular-nums">{money(l.total_price)}</span></li>))}
        {o.notes && <li className="rounded-md bg-paper px-2 py-1 text-xs text-ink-soft">Note: {o.notes}</li>}
      </ul>
      <p className="flex justify-between border-t border-line px-4 py-2 text-sm"><span className="text-ink-soft">Total</span><span className="font-display font-semibold tabular-nums">{money(o.total_price)}</span></p>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
        {o.order_status !== "ready" && <Button size="sm" disabled={busy} onClick={() => onStatus("ready")}>Ready</Button>}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onStatus("delivered")}>Delivered</Button>
        <Button size="sm" variant="ghost" className="text-danger" disabled={busy} onClick={() => onStatus("cancelled")}>Cancel</Button>
      </footer>
    </article>
  );
}

export function OrdersPage() {
  const toast = useToast();
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } });
  const q = useQuery({ queryKey: ["orders", "active"], queryFn: () => ordersApi.list("active"), refetchInterval: 10_000 });
  const seen = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const ids = new Set(q.data.map((o) => o.order_id));
    if (seen.current) {
      const fresh = q.data.filter((o) => !seen.current!.has(o.order_id));
      if (fresh.length) { toast(`New order from ${fresh[0].customer_name}`); if (sound) chime(); }
    }
    seen.current = ids;
  }, [q.data]); // eslint-disable-line
  const set = useAction((v: { id: number; s: OrderStatus }) => ordersApi.setStatus(v.id, v.s), { invalidate: [["orders"]], success: (r) => `Order #${r.order_id} marked ${statusMeta[r.order_status].label.toLowerCase()}` });
  const toggleSound = () => { const n = !sound; setSound(n); try { localStorage.setItem(SOUND_KEY, n ? "on" : "off"); } catch { /* ignore */ } if (n) chime(); };
  const orders = q.data ?? [];
  return (
    <>
      <PageHeader title="Live orders" description="Orders the AI took by phone. This board refreshes every 10 seconds."
        actions={<>
          <Button variant="ghost" icon={<Volume2 className="h-4 w-4" />} onClick={chime}>Test bell</Button>
          <Button variant="secondary" aria-pressed={sound} icon={sound ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} onClick={toggleSound}>Sound {sound ? "on" : "off"}</Button>
          <Button variant="secondary" loading={q.isFetching} icon={<RefreshCw className="h-4 w-4" />} onClick={() => q.refetch()}>Refresh</Button>
        </>} />
      {q.isLoading ? <Loading label="Loading orders…" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !orders.length ? (
        <EmptyState icon={<Bell />} title="No open orders" body="New phone orders appear here with a chime. Keep this tab open in the kitchen." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{orders.map((o) => <OrderCard key={o.order_id} o={o} busy={set.isPending} onStatus={(s) => set.mutate({ id: o.order_id, s })} />)}</div>
      )}
    </>
  );
}

export function OrdersHistoryPage() {
  const q = useQuery({ queryKey: ["orders", "history"], queryFn: () => ordersApi.list("history") });
  const total = (q.data ?? []).filter((o) => o.order_status === "delivered").reduce((s, o) => s + o.total_price, 0);
  return (
    <>
      <PageHeader title="Order history" description={q.data ? `${q.data.length} completed or cancelled orders · ${money(total)} delivered` : undefined}
        actions={<Button variant="secondary" loading={q.isFetching} icon={<RefreshCw className="h-4 w-4" />} onClick={() => q.refetch()}>Refresh</Button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <DataTable rows={q.data ?? []} rowKey={(o) => o.order_id} searchable searchText={(o) => `${o.order_id} ${o.customer_name} ${o.customer_phone} ${o.items.map((i) => i.name).join(" ")}`}
          empty={<EmptyState title="No past orders yet" />}
          columns={[
            { key: "id", header: "Order", sortValue: (o) => o.order_id, cell: (o) => <span className="font-medium tabular-nums">#{o.order_id}</span> },
            { key: "t", header: "Placed", sortValue: (o) => o.order_time, cell: (o) => dateTime(o.order_time) },
            { key: "c", header: "Customer", sortValue: (o) => o.customer_name, cell: (o) => <div>{o.customer_name}<p className="text-xs text-ink-mute">{o.customer_phone}</p></div> },
            { key: "i", header: "Items", cell: (o) => <span className="text-ink-soft">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</span> },
            { key: "p", header: "Total", sortValue: (o) => o.total_price, cell: (o) => <span className="tabular-nums">{money(o.total_price)}</span> },
            { key: "s", header: "Status", cell: (o) => <Badge tone={statusMeta[o.order_status].tone}>{statusMeta[o.order_status].label}</Badge> },
          ]} />
      )}
    </>
  );
}
