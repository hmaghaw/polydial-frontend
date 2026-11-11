import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Globe2, Phone, PhoneForwarded, Plus, Search, Star } from "lucide-react";
import { billingApi, businessApi, hoursApi, languagesApi, phonesApi, premiumApi } from "../api/endpoints";
import type { AvailableNumber, BusinessHours, BusinessLanguage, BusinessPhone, PremiumNumber } from "../api/types";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Loading, PageHeader, Select, Switch, Tabs } from "../ui/primitives";
import { DataTable } from "../ui/DataTable";
import { FormDialog, type FieldDef } from "../ui/FormDialog";
import { useAction } from "../lib/hooks";
import { useToast } from "../ui/toast";
import { cents, dateTime, DAYS, hhmm, money } from "../lib/format";
import { cn } from "../lib/cn";

const fmtPhone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 ($1) $2-$3");

// ================= Billing =================
const THRESHOLDS = [500, 1000, 1500, 2000];
const AMOUNTS = [1000, 2000, 5000, 10000];
export function BillingPage() {
  const summary = useQuery({ queryKey: ["billing"], queryFn: billingApi.summary });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: billingApi.ledger });
  const [auto, setAuto] = useState({ is_auto_recharge: false, recharge_threshold: 500, recharge_amount: 2000 });
  useEffect(() => { if (summary.data) setAuto({ is_auto_recharge: !!summary.data.is_auto_recharge, recharge_threshold: summary.data.recharge_threshold, recharge_amount: summary.data.recharge_amount }); }, [summary.data]);
  const [topUp, setTopUp] = useState(false);
  const saveAuto = useAction(() => billingApi.updateAutoRecharge(auto), { invalidate: [["billing"]], success: "Auto-recharge settings updated" });

  if (summary.isLoading) return <Loading />;
  if (summary.error) return <><PageHeader title="Billing & funds" /><ErrorState error={summary.error} onRetry={summary.refetch} /></>;
  const bal = summary.data!.balance_cents;
  return (
    <>
      <PageHeader title="Billing & funds" description="PolyDial is pay-as-you-go. Calls and phone numbers draw from this balance." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Current balance">
          <p className={cn("font-display text-5xl font-semibold tabular-nums", bal < 500 ? "text-danger" : "text-ink")}>{cents(bal)}</p>
          <p className="mt-2 text-sm text-ink-soft">{bal < 500 ? "Your balance is low. Calls stop being answered at $0." : "Roughly " + Math.floor(bal / 9) + " minutes of AI calls left."}</p>
          <Button className="mt-5" icon={<Plus className="h-4 w-4" />} onClick={() => setTopUp(true)}>Add funds</Button>
        </Card>
        <Card title="Auto-recharge" description="Top up automatically so your line never goes silent.">
          <Switch checked={auto.is_auto_recharge} onChange={(v) => setAuto({ ...auto, is_auto_recharge: v })} label="Keep my service running without interruption" />
          <div className={cn("mt-4 grid gap-4 sm:grid-cols-2", !auto.is_auto_recharge && "opacity-50")}>
            <Field label="When balance drops below" htmlFor="th"><Select id="th" disabled={!auto.is_auto_recharge} value={auto.recharge_threshold} onChange={(e) => setAuto({ ...auto, recharge_threshold: +e.target.value })}>{THRESHOLDS.map((t) => <option key={t} value={t}>{cents(t)}</option>)}</Select></Field>
            <Field label="Add this amount" htmlFor="am"><Select id="am" disabled={!auto.is_auto_recharge} value={auto.recharge_amount} onChange={(e) => setAuto({ ...auto, recharge_amount: +e.target.value })}>{AMOUNTS.map((t) => <option key={t} value={t}>{cents(t)}</option>)}</Select></Field>
          </div>
          <Button className="mt-5" variant="secondary" loading={saveAuto.isPending} onClick={() => saveAuto.mutate(undefined)}>Update settings</Button>
        </Card>
      </div>
      <Card className="mt-5" title="Transaction history" bodyClass="p-0">
        {ledger.isLoading ? <Loading /> : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-ink-soft"><tr><th className="px-5 py-2.5 font-medium">Date</th><th className="px-5 py-2.5 font-medium">Reason</th><th className="px-5 py-2.5 text-right font-medium">Amount</th></tr></thead>
            <tbody>{ledger.data?.map((l) => (
              <tr key={l.ledger_id} className="border-t border-line">
                <td className="px-5 py-3 tabular-nums text-ink-soft">{dateTime(l.created_at)}</td>
                <td className="px-5 py-3">{l.reason}{l.comments && <span className="text-ink-mute"> · {l.comments}</span>}</td>
                <td className={cn("px-5 py-3 text-right tabular-nums font-medium", l.amount_cents > 0 ? "text-signal-700" : "text-ink")}>{l.amount_cents > 0 ? "+" : ""}{cents(l.amount_cents)}</td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>
      <TopUpDialog open={topUp} onClose={() => setTopUp(false)} />
    </>
  );
}

export function TopUpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState(2000);
  const [custom, setCustom] = useState("");
  const value = custom ? Math.round(Number(custom) * 100) : amount;
  const pay = useAction((c: number) => billingApi.topUp(c), { invalidate: [["billing"], ["ledger"]] });
  const toast = useToast();
  const invalid = custom !== "" && !(Number(custom) >= 5);
  return (
    <Dialog open={open} onClose={onClose} title="Add funds" description="You'll complete payment securely with Stripe." size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={invalid} loading={pay.isPending} onClick={() => pay.mutate(value, {
        onSuccess: (r) => { if (r.checkout_url) window.location.href = r.checkout_url; else { toast(`Added ${cents(value)} to your balance`); onClose(); } },
      })}>Pay {cents(value || 0)}</Button></>}>
      <div className="grid grid-cols-4 gap-2">
        {AMOUNTS.map((a) => <button key={a} onClick={() => { setAmount(a); setCustom(""); }} className={cn("rounded-md border py-2.5 text-sm font-medium tabular-nums", !custom && amount === a ? "border-signal bg-signal/5 text-signal-700" : "border-line hover:border-ink/30")}>{cents(a)}</button>)}
      </div>
      <Field className="mt-4" label="Or enter an amount" htmlFor="cu" error={invalid ? "The minimum top-up is $5." : undefined}>
        <Input id="cu" type="number" min={5} step={1} placeholder="e.g. 35" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </Field>
    </Dialog>
  );
}

// ================= Phone numbers =================
export function PhoneNumbersSection({ compact }: { compact?: boolean }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["phones"], queryFn: phonesApi.list });
  const { data: langs } = useQuery({ queryKey: ["business-languages"], queryFn: languagesApi.business });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BusinessPhone | null>(null);
  const [deleting, setDeleting] = useState<BusinessPhone | null>(null);
  const toast = useToast();
  const save = useAction((v: Partial<BusinessPhone>) => phonesApi.update(editing!.business_phone_id, v), { invalidate: [["phones"]], success: "Phone number updated", silentError: true });
  const del = useAction((p: BusinessPhone) => phonesApi.remove(p.business_phone_id), { invalidate: [["phones"]], success: "Phone number released" });
  type F = { friendly_name: string; language_code: string; forwarding_to: string; is_primary: boolean };
  const fields: FieldDef<F>[] = [
    { name: "friendly_name", label: "Label", placeholder: "Main line" },
    { name: "language_code", label: "Greeting language", type: "select", required: true, options: langs?.map((l) => ({ value: l.language_code, label: l.language_name ?? l.language_code })) ?? [], hint: "The AI answers this number in this language first." },
    { name: "forwarding_to", label: "Forward to staff when the AI hands off", type: "tel", placeholder: "+1 416 555 0142", hint: "Leave empty to take a message instead." },
    { name: "is_primary", label: "Primary number", type: "switch", description: "Shown on your dashboard and used for test calls." },
  ];
  const body = isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data?.length
    ? <EmptyState icon={<Phone className="h-8 w-8" />} title="No phone number yet" body="Get a local number and your AI receptionist starts answering right away." action={<Button onClick={() => setAdding(true)}>Get a number</Button>} />
    : (
      <ul className="divide-y divide-line">
        {data.map((p) => (
          <li key={p.business_phone_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="flex items-center gap-2 font-display text-base font-medium tabular-nums text-ink">{fmtPhone(p.business_phone)}
                {p.is_primary && <Badge tone="good"><Star className="h-3 w-3" />Primary</Badge>}
                {p.status !== "active" && <Badge tone="bad">{p.status}</Badge>}</p>
              <p className="text-xs text-ink-mute">{p.friendly_name ?? "Unlabelled"} · greets in {p.language_code?.toUpperCase() ?? "—"} · {p.channel}
                {p.forwarding_to && <> · <PhoneForwarded className="inline h-3 w-3" /> {fmtPhone(p.forwarding_to)}</>}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(p.business_phone); toast("Number copied"); }}>Copy</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(p)}>Release</Button>
            </div>
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <Card title="Phone numbers" description={compact ? undefined : "Numbers your AI receptionist answers."} actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add number</Button>}>{body}</Card>
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title="Edit phone number" description={editing && fmtPhone(editing.business_phone)} fields={fields}
        initial={{ friendly_name: editing?.friendly_name ?? "", language_code: editing?.language_code ?? "en", forwarding_to: editing?.forwarding_to ?? "", is_primary: !!editing?.is_primary }}
        submitLabel="Save changes" onSubmit={(v) => save.mutateAsync({ ...v, forwarding_to: v.forwarding_to || null })} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Release phone number" confirmLabel="Release number" loading={del.isPending}
        body={<>Release <b>{deleting && fmtPhone(deleting.business_phone)}</b>? Callers will hear a disconnected tone, and the number may not be recoverable.</>}
        onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
      <AddNumberDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function NumberSearch({ onPick }: { onPick: (n: AvailableNumber) => void }) {
  const [q, setQ] = useState({ region: "ON", area_code: "", contains: "" });
  const [submitted, setSubmitted] = useState(q);
  const [showFilters, setShowFilters] = useState(true);
  const { data, isFetching } = useQuery({ queryKey: ["available", submitted], queryFn: () => phonesApi.search(submitted) });
  const areaErr = q.area_code && !/^\d{3}$/.test(q.area_code) ? "Area codes are 3 digits." : undefined;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-ink">Search available numbers</p>
        <button className="text-sm text-signal hover:underline" onClick={() => setShowFilters((s) => !s)}>{showFilters ? "Hide filters" : "Show filters"}</button></div>
      {showFilters && (
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (!areaErr) setSubmitted(q); }}>
          <Field label="Region" htmlFor="rg"><Select id="rg" value={q.region} onChange={(e) => setQ({ ...q, region: e.target.value })}>{["ON", "QC", "BC", "AB", "NY", "CA", "TX"].map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Area code" htmlFor="ac" error={areaErr}><Input id="ac" inputMode="numeric" placeholder="e.g. 416" value={q.area_code} onChange={(e) => setQ({ ...q, area_code: e.target.value })} /></Field>
          <Field label="Contains" htmlFor="co"><Input id="co" inputMode="numeric" placeholder="e.g. 2222" value={q.contains} onChange={(e) => setQ({ ...q, contains: e.target.value })} /></Field>
          <Button type="submit" variant="secondary" icon={<Search className="h-4 w-4" />}>Search</Button>
        </form>
      )}
      <p className="mb-2 mt-4 text-xs text-ink-mute">Available numbers ({data?.length ?? 0} found)</p>
      {isFetching ? <Loading /> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data?.map((n) => (
            <li key={n.phone_number} className="flex items-center justify-between rounded-md border border-line px-3 py-2">
              <div><p className="font-medium tabular-nums">{n.friendly_name}</p><p className="text-xs text-ink-mute">{n.locality}, {n.region} · {money(n.monthly_fee)}/mo</p></div>
              <Button size="sm" onClick={() => onPick(n)}>Choose</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PremiumList({ onPick }: { onPick: (n: PremiumNumber) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["premium"], queryFn: premiumApi.list });
  if (isLoading) return <Loading />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {data?.map((n) => (
        <li key={n._id} className={cn("flex items-center justify-between rounded-md border px-3 py-2", n.taken ? "border-line bg-paper" : "border-live/40")}>
          <div><p className={cn("font-medium tabular-nums", n.taken && "text-ink-mute line-through")}>{fmtPhone(n.phone_number)}</p><p className="text-xs text-ink-mute">One-time {money(n.price)}</p></div>
          {n.taken ? <Badge>Taken</Badge> : <Button size="sm" variant="live" onClick={() => onPick(n)}>Reserve</Button>}
        </li>
      ))}
    </ul>
  );
}

/** Tabs: standard search / premium, then the purchase confirmation (Purchase Number Flow). */
export function AddNumberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"std" | "premium">("std");
  const [pick, setPick] = useState<{ phone: string; label: string; fee: number; premiumId?: number } | null>(null);
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [topUp, setTopUp] = useState(false);
  const { data: billing } = useQuery({ queryKey: ["billing"], queryFn: billingApi.summary, enabled: open });
  const buy = useAction(() => (pick!.premiumId ? premiumApi.purchase(pick!.premiumId) : phonesApi.purchase({ phone_number: pick!.phone, enable_auto_recharge: autoRecharge })),
    { invalidate: [["phones"], ["billing"], ["ledger"], ["premium"]], success: "Number added — your AI is answering it now" });
  useEffect(() => { if (open) { setPick(null); setTab("std"); } }, [open]);
  const short = billing && pick ? billing.balance_cents < pick.fee * 100 : false;
  return (
    <>
      <Dialog open={open && !topUp} onClose={onClose} size="lg" title={pick ? "Purchase phone number" : "Add phone number"}
        footer={pick && <><Button variant="secondary" onClick={() => setPick(null)}>Back</Button>
          {short ? <Button onClick={() => setTopUp(true)}>Add funds</Button> : <Button loading={buy.isPending} onClick={() => buy.mutate(undefined, { onSuccess: onClose })}>Purchase for {money(pick.fee)}</Button>}</>}>
        {pick ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-paper p-4"><p className="text-sm text-ink-soft">Selected number</p><p className="font-display text-2xl font-semibold tabular-nums">{pick.label}</p>
              <p className="mt-1 text-sm text-ink-soft">{pick.premiumId ? "Premium number — one-time fee" : "Starter pack — first month included"}: <b className="text-ink">{money(pick.fee)}</b></p></div>
            {!pick.premiumId && <Switch checked={autoRecharge} onChange={setAutoRecharge} label="Enable auto-recharge (recommended)" description="Keeps your number active when the balance runs low." />}
            {short ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">Insufficient funds: your balance is {cents(billing!.balance_cents)}. Add funds to continue.</p>
              : <p className="rounded-md bg-signal/10 px-3 py-2 text-sm text-signal-700">Ready to purchase. {money(pick.fee)} will be taken from your balance of {cents(billing?.balance_cents ?? 0)}.</p>}
          </div>
        ) : (
          <>
            <Tabs value={tab} onChange={setTab} tabs={[{ key: "std", label: "Phone numbers" }, { key: "premium", label: "Premium numbers" }]} />
            {tab === "std" ? <NumberSearch onPick={(n) => setPick({ phone: n.phone_number, label: n.friendly_name, fee: n.monthly_fee })} />
              : <PremiumList onPick={(n) => setPick({ phone: n.phone_number, label: fmtPhone(n.phone_number), fee: n.price, premiumId: n._id })} />}
          </>
        )}
      </Dialog>
      <TopUpDialog open={topUp} onClose={() => setTopUp(false)} />
    </>
  );
}

export function BusinessPhonesPage() {
  return <><PageHeader title="Phone numbers" description="Get local or premium numbers, choose the greeting language, and set where handoffs go." /><PhoneNumbersSection /></>;
}

export function PremiumNumbersPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["premium"], queryFn: premiumApi.list });
  const [confirm, setConfirm] = useState<PremiumNumber | null>(null);
  const buy = useAction((n: PremiumNumber) => premiumApi.purchase(n._id), { invalidate: [["premium"], ["phones"], ["billing"]], success: "Premium number added" });
  return (
    <>
      <PageHeader title="Premium numbers" description="Memorable numbers callers recognise. A one-time fee comes out of your balance." />
      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable rows={data!} rowKey={(n) => n._id} columns={[
          { key: "p", header: "Phone number", cell: (n) => <span className="font-medium tabular-nums">{fmtPhone(n.phone_number)}</span> },
          { key: "c", header: "Price", cell: (n) => money(n.price), sortValue: (n) => n.price },
          { key: "s", header: "Status", cell: (n) => <Badge tone={n.taken ? "neutral" : "good"}>{n.taken ? "Taken" : "Available"}</Badge> },
          { key: "a", header: "", className: "text-right", cell: (n) => !n.taken && <Button size="sm" onClick={() => setConfirm(n)}>Purchase</Button> },
        ]} />
      )}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} tone="primary" title="Confirm purchase" confirmLabel="Confirm purchase" loading={buy.isPending}
        body={confirm && <>Buy <b>{fmtPhone(confirm.phone_number)}</b> for <b>{money(confirm.price)}</b>? It's charged to your PolyDial balance and starts answering immediately.</>}
        onConfirm={() => buy.mutate(confirm!, { onSuccess: () => setConfirm(null) })} />
    </>
  );
}

// ================= Business hours =================
type HoursForm = { is_open: boolean; open_time: string; close_time: string };
export function HoursEditor({ rows, onSave, title = "Business hours", description }: { rows: BusinessHours[]; onSave: (day: number, v: Omit<BusinessHours, "day_of_week">) => Promise<unknown>; title?: string; description?: string }) {
  const [editing, setEditing] = useState<BusinessHours | null>(null);
  const fields: FieldDef<HoursForm>[] = [
    { name: "is_open", label: "Open this day", type: "switch" },
    { name: "open_time", label: "Opening time", type: "time", required: true, half: true, hidden: (v) => !v.is_open },
    { name: "close_time", label: "Closing time", type: "time", required: true, half: true, hidden: (v) => !v.is_open, validate: (v, a) => (v <= a.open_time ? "Closing time must be after opening time." : undefined) },
  ];
  return (
    <Card title={title} description={description} bodyClass="p-0">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs text-ink-soft"><tr><th className="px-5 py-2.5 font-medium">Day</th><th className="px-5 py-2.5 font-medium">Status</th><th className="px-5 py-2.5 font-medium">Opens</th><th className="px-5 py-2.5 font-medium">Closes</th><th /></tr></thead>
        <tbody>{[...rows].sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7)).map((h) => (
          <tr key={h.day_of_week} className="border-t border-line">
            <td className="px-5 py-3 font-medium">{DAYS[h.day_of_week]}</td>
            <td className="px-5 py-3"><Badge tone={h.is_closed ? "neutral" : "good"}>{h.is_closed ? "Closed" : "Open"}</Badge></td>
            <td className="px-5 py-3 tabular-nums">{h.is_closed ? "—" : hhmm(h.open_time)}</td>
            <td className="px-5 py-3 tabular-nums">{h.is_closed ? "—" : hhmm(h.close_time)}</td>
            <td className="px-5 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(h)}>Edit</Button></td>
          </tr>))}</tbody>
      </table>
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={`Edit hours — ${editing ? DAYS[editing.day_of_week] : ""}`} fields={fields} size="sm"
        initial={{ is_open: !editing?.is_closed, open_time: editing?.open_time?.slice(0, 5) ?? "09:00", close_time: editing?.close_time?.slice(0, 5) ?? "17:00" }}
        submitLabel="Save changes" onSubmit={(v) => onSave(editing!.day_of_week, { is_closed: !v.is_open, open_time: v.is_open ? v.open_time : null, close_time: v.is_open ? v.close_time : null })} />
    </Card>
  );
}
export function BusinessHoursSection() {
  const { data, isLoading } = useQuery({ queryKey: ["hours"], queryFn: hoursApi.list });
  const save = useAction(({ day, v }: { day: number; v: Omit<BusinessHours, "day_of_week"> }) => hoursApi.update(day, v), { invalidate: [["hours"]], success: "Hours saved", silentError: true });
  if (isLoading) return <Loading />;
  return <HoursEditor rows={data ?? []} description="The AI tells callers when you're open and won't book outside these hours." onSave={(day, v) => save.mutateAsync({ day, v })} />;
}
export function BusinessHoursPage() {
  const { data: biz } = useQuery({ queryKey: ["business"], queryFn: businessApi.get });
  return <><PageHeader title="Business hours" description={biz ? `Weekly schedule for ${biz.name} (${biz.timezone}).` : undefined} /><BusinessHoursSection /></>;
}

// ================= Languages =================
export function LanguagesSection() {
  const { data, isLoading } = useQuery({ queryKey: ["business-languages"], queryFn: languagesApi.business });
  const { data: catalog } = useQuery({ queryKey: ["languages"], queryFn: languagesApi.catalog });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BusinessLanguage | null>(null);
  const [removing, setRemoving] = useState<BusinessLanguage | null>(null);
  const { data: voices } = useQuery({ queryKey: ["voices", editing?.language_code], queryFn: () => languagesApi.voices(editing!.language_code), enabled: !!editing });
  const add = useAction((code: string) => languagesApi.add(code), { invalidate: [["business-languages"]], success: "Language added", silentError: true });
  const upd = useAction((v: { language_voice_id: number | null; is_default: boolean }) => languagesApi.update(editing!.language_code, v), { invalidate: [["business-languages"]], success: "Language settings saved", silentError: true });
  const del = useAction((l: BusinessLanguage) => languagesApi.remove(l.language_code), { invalidate: [["business-languages"]], success: "Language removed" });
  const available = catalog?.filter((c) => c.supported && !data?.some((d) => d.language_code === c.language_code)) ?? [];
  return (
    <Card title="Languages" description="The AI detects the caller's language and switches automatically among these." actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add language</Button>}>
      {isLoading ? <Loading /> : (
        <ul className="flex flex-wrap gap-2">
          {data?.map((l) => (
            <li key={l.language_code} className="flex items-center gap-2 rounded-md border border-line py-1.5 pl-3 pr-1 text-sm">
              <Globe2 className="h-4 w-4 text-ink-mute" />{l.language_name}{l.is_default && <Badge tone="good">Default</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Edit</Button>
              {!l.is_default && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(l)}>Remove</Button>}
            </li>
          ))}
        </ul>
      )}
      <FormDialog open={adding} onClose={() => setAdding(false)} title="Add language" size="sm" submitLabel="Add language"
        fields={[{ name: "code", label: "Language", type: "select", required: true, placeholder: "Choose a language…", options: available.map((l) => ({ value: l.language_code, label: l.language_name })) }]}
        initial={{ code: "" }} onSubmit={(v) => add.mutateAsync(v.code)} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={`Language settings — ${editing?.language_name ?? ""}`} size="sm" submitLabel="Save changes"
        fields={[
          { name: "voice", label: "Voice", type: "select", placeholder: "Select a voice", options: voices?.map((v) => ({ value: v.language_voice_id, label: `${v.voice_name} (${v.voice_provider}, ${v.region_code})` })) ?? [] },
          { name: "is_default", label: "Set as default language for business", type: "switch" },
        ]}
        initial={{ voice: editing?.language_voice_id ?? "", is_default: !!editing?.is_default }}
        onSubmit={(v) => upd.mutateAsync({ language_voice_id: v.voice ? Number(v.voice) : null, is_default: v.is_default })} />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title="Remove language" confirmLabel="Remove language" loading={del.isPending}
        body={<>Callers speaking <b>{removing?.language_name}</b> will be answered in your default language instead.</>}
        onConfirm={() => del.mutate(removing!, { onSuccess: () => setRemoving(null) })} />
    </Card>
  );
}

// ================= Business profile =================
export function BusinessProfileSection() {
  const { data, isLoading } = useQuery({ queryKey: ["business"], queryFn: businessApi.get });
  const save = useAction((v: { name: string; address: string; branch_phone_number: string; timezone: string }) => businessApi.update(v), { invalidate: [["business"]], success: "Business profile saved", silentError: true });
  const [open, setOpen] = useState(false);
  if (isLoading || !data) return <Loading />;
  return (
    <Card title="Business profile" actions={<Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Edit</Button>}>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[["Name", data.name], ["Type", data.business_type.replace("_", " ")], ["Address", data.address ?? "—"], ["Branch phone", data.branch_phone_number ? fmtPhone(data.branch_phone_number) : "—"], ["Time zone", data.timezone]].map(([k, v]) => (
          <div key={k}><dt className="text-ink-mute">{k}</dt><dd className="mt-0.5 capitalize-first text-ink">{v}</dd></div>
        ))}
      </dl>
      <FormDialog open={open} onClose={() => setOpen(false)} title="Edit business profile" submitLabel="Save changes"
        fields={[
          { name: "name", label: "Business name", required: true },
          { name: "address", label: "Address", hint: "The AI reads this out when callers ask for directions." },
          { name: "branch_phone_number", label: "Branch phone", type: "tel", half: true },
          { name: "timezone", label: "Time zone", type: "select", half: true, required: true, options: ["America/Toronto", "America/Vancouver", "America/New_York", "America/Chicago", "America/Los_Angeles", "Africa/Cairo", "Europe/London"].map((t) => ({ value: t, label: t })) },
        ]}
        initial={{ name: data.name, address: data.address ?? "", branch_phone_number: data.branch_phone_number ?? "", timezone: data.timezone }}
        onSubmit={(v) => save.mutateAsync(v)} />
    </Card>
  );
}
