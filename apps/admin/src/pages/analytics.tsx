import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Eye, FileText, Plus, Trash2 } from "lucide-react";
import { analyticsApi, Badge, Button, Card, ConfirmDialog, ConversationDialog, DataTable, date, dateTime, Dialog, ErrorState, FormDialog, Input, Loading, PageHeader, reportsApi, Segmented, Stat, useAction, type CallMeta, type FieldDef, type Report, type ReportSchedule } from "@polydial/shared";
import { Heatmap, HBars, Meter, SentimentStack } from "../charts";

export function VoiceAnalyticsPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["voice"], queryFn: analyticsApi.voice });
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data!;
  return (
    <>
      <PageHeader title="Voice analytics" description="How well the AI hears and responds to callers." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Speech-to-text accuracy" value={`${(d.stt_accuracy * 100).toFixed(1)}%`} sub="Words recognised correctly" />
        <Stat label="Response time" value={`${d.latency_ms} ms`} sub="From caller pause to AI reply" />
        <Stat label="Languages detected" value={d.by_language.length} />
        <Stat label="Calm or happy callers" value={`${d.emotions.slice(0, 2).reduce((s, e) => s + e.value, 0)}%`} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Accuracy by language"><HBars data={d.by_language} x="accuracy" y="language" fmt={(v) => `${v}%`} /></Card>
        <Card title="Detected emotions" description="Share of calls where each emotion dominated"><HBars data={d.emotions} x="value" y="name" fmt={(v) => `${v}%`} /></Card>
        <Card title="Voice quality" className="lg:col-span-2"><div className="grid gap-5 sm:grid-cols-3">{d.quality.map((q) => <Meter key={q.name} label={q.name} value={q.value} />)}</div>
          <p className="mt-4 text-xs text-ink-mute">Clarity: higher is better. Background noise and interruptions: share of calls affected, lower is better.</p></Card>
      </div>
    </>
  );
}

const HOURS = ["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p"];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function CallInsightsPage() {
  const [range, setRange] = useState<"week" | "month" | "quarter">("week");
  const { data, isLoading } = useQuery({ queryKey: ["insights", range], queryFn: () => analyticsApi.insights(range) });
  return (
    <>
      <PageHeader title="Call insights" description="Where calls come from, when they peak and who handles them."
        actions={<Segmented value={range} onChange={setRange} options={[{ key: "week", label: "This week" }, { key: "month", label: "This month" }, { key: "quarter", label: "This quarter" }]} />} />
      {isLoading || !data ? <Loading /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Geographic distribution" description="Calls by caller area"><HBars data={data.regions} x="calls" y="region" /></Card>
          <Card title="Peak hours" description="Calls per hour, by weekday"><Heatmap rows={data.heatmap} rowLabels={WEEK} colLabels={HOURS} unit="calls" /></Card>
          <Card title="Performance leaderboard" className="lg:col-span-2" bodyClass="p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs text-ink-soft"><tr><th className="px-5 py-2.5 font-medium">Handled by</th><th className="px-5 py-2.5 text-right font-medium">Calls</th><th className="px-5 py-2.5 text-right font-medium">Resolution</th><th className="px-5 py-2.5 text-right font-medium">Satisfaction</th></tr></thead>
              <tbody>{data.leaderboard.map((r) => (
                <tr key={r.name} className="border-t border-line"><td className="px-5 py-3 font-medium">{r.name}{r.name === "PolyDial AI" && <Badge tone="good" className="ml-2">AI</Badge>}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.calls}</td><td className="px-5 py-3 text-right tabular-nums">{Math.round(r.resolution * 100)}%</td><td className="px-5 py-3 text-right tabular-nums">{r.csat.toFixed(1)} / 5</td></tr>))}</tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}

export function SentimentAnalysisPage() {
  const { data, isLoading } = useQuery({ queryKey: ["sentiment"], queryFn: analyticsApi.sentiment });
  const [open, setOpen] = useState<CallMeta | null>(null);
  if (isLoading || !data) return <Loading />;
  const total = data.positive + data.neutral + data.negative;
  return (
    <>
      <PageHeader title="Sentiment analysis" description="How callers feel by the end of the call, and which topics drive it." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Overall sentiment" value={`${data.overall} / 100`} sub="50 is neutral" />
        <Stat label="Positive calls" value={data.positive} sub={`${Math.round((data.positive / total) * 100)}% of calls`} />
        <Stat label="Negative calls" value={data.negative} sub={`${Math.round((data.negative / total) * 100)}% of calls`} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Caller mood" description="Calls per day by sentiment"><SentimentStack data={data.trend} /></Card>
        <Card title="Recent alerts" description="Negative calls worth a follow-up">
          {data.alerts.length === 0 ? <p className="text-sm text-ink-mute">No negative calls recently.</p> : (
            <ul className="space-y-3">{data.alerts.map((c) => (
              <li key={c.call_sid} className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div className="min-w-0 flex-1 text-sm"><p className="font-medium">{c.customer_name}</p><p className="text-ink-soft">{c.summary}</p><p className="text-xs text-ink-mute">{dateTime(c.call_start)}</p></div>
                <Button size="sm" variant="ghost" onClick={() => setOpen(c)}>View details</Button></li>))}</ul>
          )}
        </Card>
      </div>
      <Card className="mt-5" title="Sentiment by topic" bodyClass="p-0">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs text-ink-soft"><tr><th className="px-5 py-2.5 font-medium">Topic</th><th className="px-5 py-2.5 font-medium">Mentions</th><th className="px-5 py-2.5 font-medium w-1/2">Positive vs negative</th></tr></thead>
          <tbody>{data.topics.map((t) => (
            <tr key={t.topic} className="border-t border-line"><td className="px-5 py-3 font-medium">{t.topic}</td><td className="px-5 py-3 tabular-nums">{t.mentions}</td>
              <td className="px-5 py-3"><div className="flex h-2.5 overflow-hidden rounded-full bg-ink/5" title={`${t.positive}% positive, ${t.negative}% negative`}>
                <div style={{ width: `${t.positive}%`, background: "#1baf7a" }} /><div className="flex-1" /><div style={{ width: `${t.negative}%`, background: "#e34948" }} /></div>
                <div className="mt-1 flex justify-between text-xs text-ink-mute tabular-nums"><span>{t.positive}% positive</span><span>{t.negative}% negative</span></div></td></tr>))}</tbody>
        </table>
      </Card>
      <ConversationDialog call={open} onClose={() => setOpen(null)} />
    </>
  );
}

const TEMPLATES = [
  { name: "Call summary", body: "Volume, duration and outcomes per day." },
  { name: "Sentiment", body: "Caller mood and flagged conversations." },
  { name: "Bookings", body: "Appointments made by the AI vs staff." },
  { name: "Billing", body: "Top-ups, call charges and number fees." },
];
export function ReportsPage() {
  const reports = useQuery({ queryKey: ["reports"], queryFn: reportsApi.list });
  const schedules = useQuery({ queryKey: ["schedules"], queryFn: reportsApi.schedules });
  const [gen, setGen] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [addSched, setAddSched] = useState(false);
  const [rmSched, setRmSched] = useState<ReportSchedule | null>(null);
  const [q, setQ] = useState("");
  const generate = useAction((v: { template: string; from: string; to: string }) => reportsApi.generate(v), { invalidate: [["reports"]], success: "Report generated", silentError: true });
  const create = useAction((v: Omit<ReportSchedule, "id">) => reportsApi.createSchedule(v), { invalidate: [["schedules"]], success: "Schedule added", silentError: true });
  const remove = useAction((s: ReportSchedule) => reportsApi.removeSchedule(s.id), { invalidate: [["schedules"]], success: "Schedule removed" });
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const download = (r: Report) => {
    const blob = new Blob([`PolyDial report\n${r.name}\nGenerated ${dateTime(r.created_at)}\n`], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${r.name.replace(/\W+/g, "-")}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const genFields: FieldDef<{ template: string; from: string; to: string }>[] = [
    { name: "from", label: "From", type: "date", required: true, half: true },
    { name: "to", label: "To", type: "date", required: true, half: true, validate: (v, a) => (v < a.from ? "End date is before the start date." : undefined) },
  ];
  return (
    <>
      <PageHeader title="Reports" description="Generate a report now or have one emailed on a schedule." />
      <h2 className="mb-3 font-display text-lg font-semibold">Report templates</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TEMPLATES.map((t) => (
          <div key={t.name} className="flex flex-col rounded-lg border border-line bg-white p-4">
            <FileText className="h-5 w-5 text-signal" /><p className="mt-2 font-medium">{t.name}</p><p className="flex-1 text-sm text-ink-mute">{t.body}</p>
            <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setPreview(t.name)}>Preview</Button><Button size="sm" onClick={() => setGen(t.name)}>Generate</Button></div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Card title="Scheduled reports" actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddSched(true)}>Add schedule</Button>}>
          {!schedules.data?.length ? <p className="text-sm text-ink-mute">No scheduled reports.</p> : (
            <ul className="divide-y divide-line">{schedules.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm"><span><span className="font-medium">{s.template}</span> <Badge>{s.frequency}</Badge><span className="block text-xs text-ink-mute">to {s.recipients}</span></span>
                <Button size="sm" variant="ghost" aria-label="Remove schedule" onClick={() => setRmSched(s)}><Trash2 className="h-4 w-4" /></Button></li>))}</ul>
          )}
        </Card>
        <Card title="Recent reports">
          <Input className="mb-3" placeholder="Search reports…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search reports" />
          {reports.isLoading ? <Loading /> : (
            <DataTable rows={(reports.data ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))} rowKey={(r) => r.id} columns={[
              { key: "n", header: "Report", cell: (r) => <span className="font-medium">{r.name}</span> },
              { key: "d", header: "Created", cell: (r) => date(r.created_at) },
              { key: "s", header: "Size", cell: (r) => `${r.size_kb} KB` },
              { key: "a", header: "", className: "text-right", cell: (r) => <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download(r)}>Download</Button> },
            ]} />
          )}
        </Card>
      </div>
      <FormDialog open={!!gen} onClose={() => setGen(null)} title={`Generate ${gen} report`} size="sm" submitLabel="Generate" fields={genFields} initial={{ template: gen ?? "", from: monthAgo, to: today }}
        onSubmit={(v) => generate.mutateAsync({ ...v, template: gen! })} />
      <Dialog open={!!preview} onClose={() => setPreview(null)} title={`${preview} — preview`} footer={<Button onClick={() => { setGen(preview); setPreview(null); }}>Generate this report</Button>}>
        <p className="text-sm text-ink-soft">{TEMPLATES.find((t) => t.name === preview)?.body} Columns: date, metric, value, comparison to previous period. Delivered as CSV.</p>
      </Dialog>
      <FormDialog open={addSched} onClose={() => setAddSched(false)} title="Add schedule" size="sm" submitLabel="Add schedule"
        fields={[
          { name: "template", label: "Report", type: "select", required: true, options: TEMPLATES.map((t) => ({ value: t.name, label: t.name })) },
          { name: "frequency", label: "Frequency", type: "select", required: true, options: [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly (Mondays)" }, { value: "monthly", label: "Monthly (1st)" }] },
          { name: "recipients", label: "Email to", type: "email", required: true, placeholder: "you@business.com" },
        ]}
        initial={{ template: "Call summary", frequency: "weekly", recipients: "" } as Omit<ReportSchedule, "id">} onSubmit={(v) => create.mutateAsync(v)} />
      <ConfirmDialog open={!!rmSched} onClose={() => setRmSched(null)} title="Remove schedule" confirmLabel="Remove" loading={remove.isPending}
        body={`Stop emailing the ${rmSched?.template} report ${rmSched?.frequency}?`} onConfirm={() => remove.mutate(rmSched!, { onSuccess: () => setRmSched(null) })} />
    </>
  );
}
