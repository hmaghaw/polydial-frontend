import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { appointmentsApi, Badge, Button, Card, ConfirmDialog, customersApi, fullName, FormDialog, Loading, PageHeader, Segmented, servicesApi, time, useAction, cn, type Appointment, type FieldDef, type Tone } from "@polydial/shared";

type View = "day" | "week" | "month";
const startOf = (d: Date, v: View) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  if (v === "week") x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  if (v === "month") { x.setDate(1); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); }
  return x;
};
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const localInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const statusTone: Record<string, Tone> = { scheduled: "info", confirmed: "good", completed: "neutral", cancelled: "bad", "no-show": "warn" };

type ApptForm = { customer_id: string; service_id: string; start_time: string; end_time: string; booking_type: Appointment["booking_type"]; status: string; notes: string };

export function useAppointmentEditor() {
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list() });
  const services = useQuery({ queryKey: ["services"], queryFn: () => servicesApi.list() });
  const [editing, setEditing] = useState<Appointment | { start: Date } | null>(null);
  const [deleting, setDeleting] = useState<Appointment | null>(null);
  const isEdit = editing && "appointment_id" in editing;
  const save = useAction((v: ApptForm) => {
    const body = { ...v, customer_id: v.customer_id ? Number(v.customer_id) : null, service_id: v.service_id ? Number(v.service_id) : null, start_time: new Date(v.start_time).toISOString(), end_time: new Date(v.end_time).toISOString(), notes: v.notes || null };
    return isEdit ? appointmentsApi.update((editing as Appointment).appointment_id, body) : appointmentsApi.create(body);
  }, { invalidate: [["appointments"]], success: isEdit ? "Appointment updated" : "Appointment scheduled", silentError: true });
  const del = useAction((a: Appointment) => appointmentsApi.remove(a.appointment_id), { invalidate: [["appointments"]], success: "Appointment deleted" });

  const fields: FieldDef<ApptForm>[] = [
    { name: "booking_type", label: "Type", type: "select", required: true, options: [{ value: "appointment", label: "Appointment" }, { value: "anonymous", label: "Walk-in / anonymous" }, { value: "block", label: "Blocked time" }, { value: "break", label: "Break" }, { value: "holiday", label: "Holiday" }] },
    { name: "customer_id", label: "Customer", type: "select", required: true, hidden: (v) => v.booking_type !== "appointment", options: customers.data?.map((c) => ({ value: c.customer_id, label: `${fullName(c)} · ${c.customer_phone}` })) ?? [] },
    { name: "service_id", label: "Service", type: "select", hidden: (v) => !["appointment", "anonymous"].includes(v.booking_type), options: services.data?.filter((s) => s.is_active).map((s) => ({ value: s.service_id, label: `${s.name} (${s.duration_minutes} min)` })) ?? [] },
    { name: "start_time", label: "Starts", type: "datetime-local", required: true, half: true },
    { name: "end_time", label: "Ends", type: "datetime-local", required: true, half: true, validate: (v, a) => (v <= a.start_time ? "End must be after start." : undefined) },
    { name: "status", label: "Status", type: "select", required: true, options: ["scheduled", "confirmed", "completed", "cancelled", "no-show"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Party size, special requests…" },
  ];
  const initial: ApptForm = isEdit
    ? { ...(editing as Appointment), customer_id: String((editing as Appointment).customer_id ?? ""), service_id: String((editing as Appointment).service_id ?? ""), start_time: localInput((editing as Appointment).start_time), end_time: localInput((editing as Appointment).end_time), notes: (editing as Appointment).notes ?? "" }
    : (() => { const s = editing && "start" in editing ? editing.start : new Date(); const st = new Date(s); if (st.getHours() === 0) st.setHours(12); return { customer_id: "", service_id: "", start_time: localInput(st.toISOString()), end_time: localInput(new Date(st.getTime() + 3600000).toISOString()), booking_type: "appointment", status: "scheduled", notes: "" }; })();

  const label = (a: Appointment) => {
    const c = customers.data?.find((x) => x.customer_id === a.customer_id);
    const s = services.data?.find((x) => x.service_id === a.service_id);
    return { who: c ? fullName(c) : a.booking_type === "appointment" ? "Unknown customer" : a.booking_type[0].toUpperCase() + a.booking_type.slice(1), what: s?.name ?? a.notes ?? "" };
  };
  const dialogs = (
    <>
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={isEdit ? "Edit appointment" : "Schedule appointment"} fields={fields} initial={initial}
        submitLabel={isEdit ? "Save changes" : "Schedule"} onSubmit={(v) => save.mutateAsync(v)}
        extra={isEdit && <button type="button" className="mt-4 text-sm text-danger hover:underline" onClick={() => { setDeleting(editing as Appointment); setEditing(null); }}>Delete this appointment</button>} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete appointment" loading={del.isPending}
        body="The customer won't be notified automatically. Call them if the booking was confirmed." onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
    </>
  );
  return { open: setEditing, dialogs, label };
}

export function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(new Date());
  const from = startOf(cursor, view);
  const days = view === "day" ? 1 : view === "week" ? 7 : 42;
  const to = addDays(from, days);
  const { data, isLoading } = useQuery({ queryKey: ["appointments", from.toISOString(), to.toISOString()], queryFn: () => appointmentsApi.list({ from: from.toISOString(), to: to.toISOString() }) });
  const ed = useAppointmentEditor();
  const step = (dir: number) => setCursor((c) => (view === "month" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * days)));
  const byDay = useMemo(() => Array.from({ length: days }, (_, i) => { const d = addDays(from, i); return { d, items: (data ?? []).filter((a) => sameDay(new Date(a.start_time), d)).sort((a, b) => a.start_time.localeCompare(b.start_time)) }; }), [data, from.getTime(), days]); // eslint-disable-line
  const heading = view === "month" ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : view === "day" ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : `${from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(from, 6).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  const today = new Date();

  return (
    <>
      <PageHeader title="Calendar" description="Bookings made by the AI and by your team." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => ed.open({ start: view === "day" ? cursor : new Date() })}>Schedule appointment</Button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="ghost" size="sm" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <h2 className="font-display text-lg font-semibold">{heading}</h2>
        </div>
        <Segmented value={view} onChange={setView} options={[{ key: "day", label: "Daily" }, { key: "week", label: "Weekly" }, { key: "month", label: "Monthly" }]} />
      </div>
      {isLoading ? <Loading /> : view === "day" ? (
        <Card title={`Daily schedule — ${byDay[0].items.length} appointment${byDay[0].items.length === 1 ? "" : "s"}`}>
          {byDay[0].items.length === 0 ? <p className="py-8 text-center text-sm text-ink-mute">Nothing booked. <button className="text-signal hover:underline" onClick={() => ed.open({ start: cursor })}>Schedule one</button></p> : (
            <ul className="divide-y divide-line">{byDay[0].items.map((a) => { const l = ed.label(a); return (
              <li key={a.appointment_id}><button onClick={() => ed.open(a)} className="flex w-full items-center gap-4 py-3 text-left hover:bg-paper/60">
                <span className="w-28 shrink-0 text-sm tabular-nums text-ink-soft">{time(a.start_time)} – {time(a.end_time)}</span>
                <span className="flex-1"><span className="font-medium">{l.who}</span><span className="block text-sm text-ink-mute">{l.what}</span></span>
                <Badge tone={statusTone[a.status]}>{a.status}</Badge></button></li>); })}</ul>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <div className={cn("grid min-w-[720px] grid-cols-7")}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-line bg-paper px-2 py-2 text-xs font-medium text-ink-soft">{d}</div>)}
            {byDay.map(({ d, items }) => {
              const outside = view === "month" && d.getMonth() !== cursor.getMonth();
              return (
                <div key={d.toISOString()} onDoubleClick={() => ed.open({ start: d })} className={cn("border-b border-r border-line p-1.5", view === "week" ? "min-h-[320px]" : "min-h-[110px]", outside && "bg-paper/60")}>
                  <button onClick={() => { setCursor(d); setView("day"); }} className={cn("mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs tabular-nums", sameDay(d, today) ? "bg-signal text-white" : outside ? "text-ink-mute" : "text-ink hover:bg-ink/5")}>{d.getDate()}</button>
                  <div className="space-y-1">
                    {items.slice(0, view === "month" ? 3 : 20).map((a) => { const l = ed.label(a); return (
                      <button key={a.appointment_id} onClick={() => ed.open(a)} className={cn("block w-full truncate rounded px-1.5 py-1 text-left text-xs", a.booking_type === "appointment" ? "bg-signal/10 text-signal-700 hover:bg-signal/20" : "bg-ink/5 text-ink-soft hover:bg-ink/10")}>
                        <span className="tabular-nums">{time(a.start_time)}</span> {l.who}</button>); })}
                    {view === "month" && items.length > 3 && <p className="px-1.5 text-xs text-ink-mute">+{items.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-mute">Tip: double-click a day to schedule on it.</p>
      {ed.dialogs}
    </>
  );
}
