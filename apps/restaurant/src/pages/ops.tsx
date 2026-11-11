import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, ClipboardList, History, Layers, ListTree, Mic, MicOff, Package, RefreshCw, Utensils } from "lucide-react";
import { Badge, Button, Card, cloverApi, EmptyState, ErrorState, Input, itemsApi, money, ordersApi, PageHeader, Stat, Switch, useAction, useAuth, cn, type RestaurantItem } from "@polydial/shared";
import { useCatalog } from "./catalog";
import { chime } from "./orders";

// ---------- /restaurant hub ----------
export function RestaurantHubPage() {
  const { business } = useAuth();
  const cat = useCatalog();
  const orders = useQuery({ queryKey: ["orders", "active"], queryFn: () => ordersApi.list("active"), refetchInterval: 15_000 });
  const pending = (orders.data ?? []).filter((o) => o.order_status === "pending").length;
  const soldOut = cat.items.filter((i) => !i.is_active).length;
  const tiles = [
    { to: "/app/orders", icon: <ClipboardList />, label: "Live orders", body: "Accept, finish and close out phone orders." },
    { to: "/menu-management", icon: <Utensils />, label: "Menu management", body: "Menus, sections and when they're available." },
    { to: "/restaurant/items", icon: <Package />, label: "Items", body: "Prices, descriptions, sold-out switches." },
    { to: "/restaurant/combos", icon: <Layers />, label: "Combos", body: "Bundles and their choice groups." },
    { to: "/restaurant/options", icon: <ListTree />, label: "Options & modifiers", body: "Sizes, crusts, toppings, extras." },
    { to: "/kitchen-voice-control", icon: <ChefHat />, label: "Kitchen voice control", body: "Say “86 the salmon” to mark it sold out." },
    { to: "/clover-sync", icon: <RefreshCw />, label: "Clover sync", body: "Pull your menu from Clover POS." },
    { to: "/app/orders-history", icon: <History />, label: "Order history", body: "Completed and cancelled orders." },
  ];
  return (
    <>
      <PageHeader title={business?.name ?? "Restaurant"} description="Your AI phone assistant takes orders from this menu." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="New orders" value={orders.isLoading ? "…" : pending} sub={`${orders.data?.length ?? 0} open in total`} tone={pending ? "live" : undefined} />
        <Stat label="Items on the menu" value={cat.loading ? "…" : cat.items.length - soldOut} sub={`${soldOut} sold out`} />
        <Stat label="Combos" value={cat.loading ? "…" : cat.items.filter((i) => i.is_combo).length} />
      </div>
      <h2 className="mb-3 font-display text-lg font-semibold">Quick access</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{tiles.map((t) => (
        <Link key={t.to} to={t.to} className="group rounded-xl border border-line bg-white p-4 hover:border-signal">
          <span className="text-signal [&>svg]:h-5 [&>svg]:w-5">{t.icon}</span>
          <p className="mt-2 font-medium group-hover:text-signal-700">{t.label}</p><p className="text-sm text-ink-soft">{t.body}</p>
        </Link>))}</div>
    </>
  );
}

// ---------- /clover-sync ----------
type SyncState = { phase: "idle" } | { phase: "syncing"; step: number } | { phase: "done"; r: Awaited<ReturnType<typeof cloverApi.sync>> } | { phase: "error"; e: unknown };
const SYNC_STEPS = ["Connecting to Clover", "Reading categories", "Reading items and prices", "Reading modifier groups", "Updating your PolyDial menu"];
export function CloverSyncPage() {
  const nav = useNavigate();
  const [s, setS] = useState<SyncState>({ phase: "idle" });
  const run = async () => {
    setS({ phase: "syncing", step: 0 });
    const timer = setInterval(() => setS((p) => (p.phase === "syncing" ? { phase: "syncing", step: Math.min(p.step + 1, SYNC_STEPS.length - 1) } : p)), 500);
    try { const [r] = await Promise.all([cloverApi.sync(), new Promise((res) => setTimeout(res, 2500))]); setS({ phase: "done", r }); }
    catch (e) { setS({ phase: "error", e }); } finally { clearInterval(timer); }
  };
  return (
    <>
      <PageHeader title="Clover sync" description="Import categories, items, prices and modifiers from your Clover POS. Edits you made in PolyDial to synced items are overwritten." />
      <Card className="max-w-2xl">
        {s.phase === "idle" && (<div className="py-6 text-center"><RefreshCw className="mx-auto h-10 w-10 text-signal" /><p className="mt-3 text-ink-soft">Takes under a minute for most menus.</p><Button className="mt-5" onClick={run}>Start sync</Button></div>)}
        {s.phase === "syncing" && (
          <ol className="space-y-3" aria-live="polite">{SYNC_STEPS.map((l, i) => (
            <li key={l} className={cn("flex items-center gap-3 text-sm", i > s.step && "text-ink-mute")}>
              {i < s.step ? <CheckCircle2 className="h-5 w-5 text-signal" /> : i === s.step ? <RefreshCw className="h-5 w-5 animate-spin text-signal" /> : <span className="h-5 w-5 rounded-full border border-line" />}{l}
            </li>))}</ol>)}
        {s.phase === "done" && (
          <div className="py-4 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-signal" /><h2 className="mt-3 font-display text-xl font-semibold">Sync completed</h2>
            <p className="mt-1 text-sm text-ink-soft">{s.r.items} items, {s.r.categories} categories and {s.r.modifier_groups} modifier groups are up to date.</p>
            <div className="mt-5 flex justify-center gap-2"><Button variant="secondary" onClick={run}>Sync again</Button><Button onClick={() => nav("/menu-management")}>Continue to menu management</Button></div></div>)}
        {s.phase === "error" && <ErrorState error={s.e} onRetry={run} />}
      </Card>
    </>
  );
}

// ---------- /kitchen-voice-control ----------
type Cmd = { at: Date; text: string; result: string; ok: boolean };
const EXAMPLES = ["86 the margherita", "Mark Caesar salad sold out", "Bring back the margherita", "Turn on garlic bread"];
const OFF = /\b(86|eighty[- ]six|sold out|out of|turn off|disable|remove)\b/i;
const ON = /\b(bring back|back on|turn on|enable|available|restock(ed)?)\b/i;

export function parseKitchenCommand(text: string, items: RestaurantItem[]): { item?: RestaurantItem; active?: boolean } {
  const t = text.toLowerCase();
  const active = ON.test(t) ? true : OFF.test(t) ? false : undefined;
  // Longest name match first, then fall back to all-words match.
  const sorted = [...items].sort((a, b) => b.name.length - a.name.length);
  const item = sorted.find((i) => t.includes(i.name.toLowerCase())) ?? sorted.find((i) => i.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => t.includes(w)));
  return { item, active };
}

export function KitchenVoiceControlPage() {
  const { items, loading } = useCatalog();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState(true);
  const [log, setLog] = useState<Cmd[]>([]);
  const rec = useRef<any>(null);
  const Recognition = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
  const toggle = useAction((v: { i: RestaurantItem; active: boolean }) => itemsApi.update(v.i.item_id, { is_active: v.active }), { invalidate: [["items"]] });
  const speak = (msg: string) => { if (!feedback || !("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg)); };

  const handle = async (text: string) => {
    if (!text.trim()) return;
    const { item, active } = parseKitchenCommand(text, items);
    let c: Cmd;
    if (!item) c = { at: new Date(), text, ok: false, result: "No menu item matched." };
    else if (active === undefined) c = { at: new Date(), text, ok: false, result: `Heard “${item.name}” — say “86” or “bring back”.` };
    else {
      try { await toggle.mutateAsync({ i: item, active }); c = { at: new Date(), text, ok: true, result: `${item.name} ${active ? "is back on" : "marked sold out"}` }; }
      catch { c = { at: new Date(), text, ok: false, result: "Couldn't update the item. Try again." }; }
    }
    setLog((l) => [c, ...l].slice(0, 10));
    if (c.ok) chime();
    speak(c.result);
  };

  useEffect(() => () => rec.current?.stop?.(), []);
  const start = () => {
    if (!Recognition) return;
    const r = new Recognition(); r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      const res = e.results[e.results.length - 1]; setHeard(res[0].transcript);
      if (res.isFinal) handle(res[0].transcript);
    };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    r.start(); rec.current = r; setListening(true);
  };
  const stop = () => { rec.current?.stop(); setListening(false); };

  return (
    <>
      <PageHeader title="Kitchen voice control" description="Hands busy? Say what's run out and the AI stops offering it to callers." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col items-center py-4 text-center">
              <button onClick={listening ? stop : start} disabled={!Recognition} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Start listening"}
                className={cn("flex h-24 w-24 items-center justify-center rounded-full text-white transition", listening ? "bg-live ring-8 ring-live/30" : "bg-signal hover:bg-signal-700", !Recognition && "opacity-40")}>
                {listening ? <Mic className="h-10 w-10 animate-pulse" /> : <MicOff className="h-10 w-10" />}
              </button>
              <p className="mt-4 font-medium">{!Recognition ? "Voice isn't supported in this browser — type commands below." : listening ? "Listening…" : "Tap to start listening"}</p>
              <p className="mt-1 min-h-[1.5rem] text-sm italic text-ink-soft" aria-live="polite">{heard && `“${heard}”`}</p>
              <div className="mt-3"><Switch checked={feedback} onChange={setFeedback} label="Spoken confirmation" /></div>
            </div>
            <form className="flex gap-2 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); handle(typed); setTyped(""); }}>
              <Input aria-label="Type a command" placeholder="Or type: 86 the margherita" value={typed} onChange={(e) => setTyped(e.target.value)} /><Button type="submit" disabled={!typed.trim()}>Run</Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="text-ink-mute">Try:</span>{EXAMPLES.map((x) => <button key={x} className="rounded-full border border-line px-2 py-0.5 hover:border-signal" onClick={() => handle(x)}>{x}</button>)}</div>
          </Card>
          <Card title="Recent commands">
            {!log.length ? <p className="text-sm text-ink-mute">Nothing yet.</p> : <ul className="divide-y divide-line">{log.map((c, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm"><span><span className="text-ink-soft">“{c.text}”</span><span className={cn("block", c.ok ? "text-signal-700" : "text-danger")}>{c.result}</span></span>
                <span className="shrink-0 text-xs tabular-nums text-ink-mute">{c.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></li>))}</ul>}
          </Card>
        </div>
        <Card title="Current menu items" description="Tap a switch to change it by hand.">
          {loading ? <p className="text-sm text-ink-mute">Loading…</p> : !items.length ? <EmptyState title="No items" /> : (
            <ul className="divide-y divide-line">{items.map((i) => (
              <li key={i.item_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><span className={cn(!i.is_active && "text-ink-mute line-through")}>{i.name}</span><span className="block text-xs text-ink-mute">{money(i.base_price)}</span></span>
                <span className="flex items-center gap-2">{!i.is_active && <Badge tone="warn">86'd</Badge>}<Switch checked={i.is_active} onChange={(v) => toggle.mutate({ i, active: v })} ariaLabel={`${i.name} available`} /></span>
              </li>))}</ul>)}
        </Card>
      </div>
    </>
  );
}
