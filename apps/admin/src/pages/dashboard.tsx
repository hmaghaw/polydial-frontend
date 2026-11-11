import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, History, PhoneCall, Plus, Settings2, Users } from "lucide-react";
import { analyticsApi, appointmentsApi, Badge, billingApi, Button, Card, cents, duration, phonesApi, Stat, time, TopUpDialog, AddNumberDialog, useAuth, useToast, type Appointment } from "@polydial/shared";
import { ServicesManager } from "./services";
import { statusTone, useAppointmentEditor } from "./calendar";
import { VolumeChart } from "../charts";

export function DashboardPage() {
  const { user, business } = useAuth();
  const toast = useToast();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const appts = useQuery({ queryKey: ["appointments", "today"], queryFn: () => appointmentsApi.list({ from: start.toISOString(), to: end.toISOString() }) });
  const phones = useQuery({ queryKey: ["phones"], queryFn: phonesApi.list });
  const billing = useQuery({ queryKey: ["billing"], queryFn: billingApi.summary });
  const overview = useQuery({ queryKey: ["overview"], queryFn: analyticsApi.overview });
  const [topUp, setTopUp] = useState(false);
  const [addNumber, setAddNumber] = useState(false);
  const ed = useAppointmentEditor();
  const primary = phones.data?.find((p) => p.is_primary) ?? phones.data?.[0];
  const o = overview.data;
  const hour = new Date().getHours();

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, {user?.first_name}</h1>
        <p className="mt-1 text-sm text-ink-soft">Here's how {business?.name} is being answered today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Calls today" value={o?.calls_today ?? "—"} sub={o && `${o.calls_week} this week`} tone="live" />
        <Stat label="Resolved by AI" value={o ? `${Math.round(o.resolution_rate * 100)}%` : "—"} sub="No staff handoff needed" />
        <Stat label="Average call" value={o ? duration(o.avg_duration) : "—"} />
        <Stat label="Balance" value={billing.data ? cents(billing.data.balance_cents) : "—"} sub={<button onClick={() => setTopUp(true)} className="text-signal hover:underline">Top up balance</button>} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Call volume" description="Last 14 days, all lines">{o ? <VolumeChart data={o.volume} /> : <div className="h-64" />}</Card>
        <Card title="System status">
          {primary ? (
            <>
              <p className="text-sm text-ink-soft">Your AI receptionist answers</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{primary.business_phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`tel:${primary.business_phone}`}><Button size="sm" icon={<PhoneCall className="h-4 w-4" />}>Make test call</Button></a>
                <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => { navigator.clipboard?.writeText(primary.business_phone); toast("Number copied"); }}>Copy phone number</Button>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-ink-soft">Lines</span><span>{phones.data!.length}</span></li>
                <li className="flex justify-between"><span className="text-ink-soft">Auto-recharge</span><Badge tone={billing.data?.is_auto_recharge ? "good" : "warn"}>{billing.data?.is_auto_recharge ? "On" : "Off"}</Badge></li>
              </ul>
              <div className="mt-4 flex gap-3 text-sm"><Link className="text-signal hover:underline" to="/business-phones">Manage all numbers</Link><Link className="text-signal hover:underline" to="/settings">Manage settings</Link></div>
            </>
          ) : (
            <div className="text-sm text-ink-soft">No number yet — callers can't reach the AI. <Button className="mt-3" onClick={() => setAddNumber(true)}>Add your first number</Button></div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Today's appointments" actions={<Link to="/calendar"><Button size="sm" variant="ghost">View all appointments</Button></Link>}>
          {appts.data?.length ? (
            <ul className="divide-y divide-line">
              {appts.data.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((a: Appointment) => { const l = ed.label(a); return (
                <li key={a.appointment_id} className="flex items-center gap-3 py-2.5">
                  <span className="w-16 text-sm tabular-nums text-ink-soft">{time(a.start_time)}</span>
                  <span className="flex-1 text-sm"><span className="font-medium">{l.who}</span><span className="block text-xs text-ink-mute">{l.what}</span></span>
                  <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => ed.open(a)}>View details</Button>
                </li>); })}
            </ul>
          ) : <div className="py-8 text-center text-sm text-ink-mute">No appointments today.<div className="mt-3"><Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => ed.open({ start: new Date() })}>Schedule appointment</Button></div></div>}
        </Card>
        <ServicesManager compact />
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Quick actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { to: "/customers", icon: <Users />, title: "Manage customers", body: "Contact details and caller notes" },
          { to: "/call-conversations", icon: <History />, title: "Call history", body: "Transcripts and summaries" },
          { to: "/calendar", icon: <CalendarDays />, title: "Appointments", body: "Daily, weekly and monthly view" },
          { to: "/settings", icon: <Settings2 />, title: "Settings", body: "Languages, numbers, hours" },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="group flex gap-3 rounded-lg border border-line bg-white p-4 hover:border-signal/50">
            <span className="text-signal [&>svg]:h-5 [&>svg]:w-5">{q.icon}</span>
            <span><span className="block font-medium text-ink">{q.title}</span><span className="text-sm text-ink-mute">{q.body}</span></span>
          </Link>
        ))}
      </div>
      <TopUpDialog open={topUp} onClose={() => setTopUp(false)} />
      <AddNumberDialog open={addNumber} onClose={() => setAddNumber(false)} />
      {ed.dialogs}
    </>
  );
}
