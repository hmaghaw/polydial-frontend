import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Filter, MessageSquare, PhoneIncoming, PhoneOutgoing, User, Users } from "lucide-react";
import { callsApi, customersApi, languagesApi } from "../api/endpoints";
import type { CallMeta, Customer } from "../api/types";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, Input, Loading, PageHeader, Select, type Tone } from "../ui/primitives";
import { DataTable } from "../ui/DataTable";
import { FormDialog, type FieldDef } from "../ui/FormDialog";
import { useAction } from "../lib/hooks";
import { dateTime, duration, fullName, time } from "../lib/format";
import { cn } from "../lib/cn";

export const sentimentTone: Record<string, Tone> = { positive: "good", neutral: "neutral", negative: "bad" };

export function ConversationDialog({ call, onClose }: { call: CallMeta | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["conversation", call?.call_sid], queryFn: () => callsApi.conversation(call!.call_sid), enabled: !!call });
  return (
    <Dialog open={!!call} onClose={onClose} size="lg" title="Call conversation"
      description={call && `${call.customer_name ?? "Unknown caller"} · ${dateTime(call.call_start)} · ${duration(call.call_duration)}`}>
      {call?.summary && <div className="mb-4 rounded-md bg-paper px-4 py-3 text-sm"><span className="font-medium text-ink">Summary: </span><span className="text-ink-soft">{call.summary}</span></div>}
      {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.length ? <EmptyState title="No transcript" body="This call ended before anything was said." /> : (
        <ol className="space-y-3">
          {data.filter((t) => t.role === "user" || t.role === "assistant").map((t) => (
            <li key={t.call_conversation_id} className={cn("flex gap-2.5", t.role === "user" && "flex-row-reverse")}>
              <span className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", t.role === "assistant" ? "bg-signal/10 text-signal" : "bg-ink/5 text-ink-soft")}>
                {t.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </span>
              <div className={cn("max-w-[80%] rounded-lg px-3.5 py-2 text-sm", t.role === "assistant" ? "bg-paper text-ink" : "bg-ink text-white")}>
                {t.content}<span className={cn("mt-1 block text-[11px]", t.role === "assistant" ? "text-ink-mute" : "text-white/50")}>{time(t.created_at)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}

const callColumns = (open: (c: CallMeta) => void) => [
  { key: "who", header: "Caller", cell: (c: CallMeta) => <div><p className="font-medium">{c.customer_name ?? "Unknown caller"}</p><p className="text-xs text-ink-mute tabular-nums">{c.customer_phone}</p></div>, sortValue: (c: CallMeta) => c.customer_name ?? "" },
  { key: "when", header: "When", cell: (c: CallMeta) => <span className="tabular-nums">{dateTime(c.call_start)}</span>, sortValue: (c: CallMeta) => c.call_start },
  { key: "dir", header: "Direction", cell: (c: CallMeta) => <span className="inline-flex items-center gap-1.5 text-ink-soft">{c.direction === "inbound" ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}{c.direction}</span> },
  { key: "ch", header: "Channel", cell: (c: CallMeta) => <Badge>{c.communication_channel}</Badge> },
  { key: "dur", header: "Length", cell: (c: CallMeta) => <span className="tabular-nums">{duration(c.call_duration)}</span>, sortValue: (c: CallMeta) => c.call_duration },
  { key: "sent", header: "Sentiment", cell: (c: CallMeta) => c.sentiment ? <Badge tone={sentimentTone[c.sentiment]}>{c.sentiment}</Badge> : "—" },
  { key: "act", header: "", className: "text-right", cell: (c: CallMeta) => <Button size="sm" variant="ghost" icon={<MessageSquare className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); open(c); }}>View conversation</Button> },
];

export function CallConversationsPage() {
  const empty = { search: "", from: "", to: "", channel: "", direction: "" };
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [advanced, setAdvanced] = useState(false);
  const [open, setOpen] = useState<CallMeta | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["calls", filters], queryFn: () => callsApi.list(filters) });
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });
  const active = Object.values(filters).filter(Boolean).length;
  return (
    <>
      <PageHeader title="Calls" description="Every call and WhatsApp conversation your AI receptionist handled, with full transcripts." />
      <Card className="mb-5" bodyClass="p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setFilters(draft); }}>
          <Field label="Customer" htmlFor="cs"><Input id="cs" placeholder="Search by name or phone" value={draft.search} onChange={set("search")} /></Field>
          <Field label="From" htmlFor="fd"><Input id="fd" type="date" value={draft.from} onChange={set("from")} /></Field>
          <Field label="To" htmlFor="td"><Input id="td" type="date" value={draft.to} onChange={set("to")} /></Field>
          <div className="flex gap-2"><Button type="submit">Apply filters</Button><Button type="button" variant="ghost" icon={<Filter className="h-4 w-4" />} onClick={() => setAdvanced((a) => !a)}>More</Button></div>
          {advanced && <>
            <Field label="Channel" htmlFor="ch"><Select id="ch" value={draft.channel} onChange={set("channel")}><option value="">All channels</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option></Select></Field>
            <Field label="Direction" htmlFor="dr"><Select id="dr" value={draft.direction} onChange={set("direction")}><option value="">Both directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option></Select></Field>
          </>}
        </form>
        {active > 0 && <button className="mt-3 text-sm text-signal hover:underline" onClick={() => { setDraft(empty); setFilters(empty); }}>Clear {active} filter{active > 1 ? "s" : ""}</button>}
      </Card>
      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> :
        <DataTable rows={data!} rowKey={(c) => c.call_sid} columns={callColumns(setOpen)} onRowClick={setOpen}
          empty={<EmptyState title="No calls found" body={active ? "Try widening the date range or clearing filters." : "Calls appear here once your number starts receiving them."} />} />}
      <ConversationDialog call={open} onClose={() => setOpen(null)} />
    </>
  );
}

// ---------------- Customers ----------------
type CustForm = Pick<Customer, "first_name" | "last_name" | "customer_phone" | "email" | "language" | "notes">;
export function CustomersPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list() });
  const { data: langs } = useQuery({ queryKey: ["languages"], queryFn: languagesApi.catalog });
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [callsFor, setCallsFor] = useState<Customer | null>(null);
  const save = useAction((v: CustForm) => (editing && editing !== "new" ? customersApi.update(editing.customer_id, v) : customersApi.create(v)), { invalidate: [["customers"]], success: editing === "new" ? "Customer added" : "Customer updated", silentError: true });
  const del = useAction((c: Customer) => customersApi.remove(c.customer_id), { invalidate: [["customers"]], success: "Customer deleted" });

  const fields: FieldDef<CustForm>[] = [
    { name: "first_name", label: "First name", required: true, half: true, placeholder: "Enter first name" },
    { name: "last_name", label: "Last name", half: true, placeholder: "Enter last name" },
    { name: "customer_phone", label: "Phone number", type: "tel", required: true, placeholder: "+1 416 555 0123" },
    { name: "email", label: "Email (optional)", type: "email", placeholder: "Enter email address" },
    { name: "language", label: "Preferred language", type: "select", options: langs?.map((l) => ({ value: l.language_code, label: l.language_name })) ?? [] },
    { name: "notes", label: "Notes (optional)", type: "textarea", placeholder: "Allergies, seating preferences, anything the AI should know" },
  ];
  const initial: CustForm = editing && editing !== "new" ? editing : { first_name: "", last_name: "", customer_phone: "", email: "", language: "en", notes: "" };

  return (
    <>
      <PageHeader title="Customers" description="People who've called you. The AI recognises returning callers by phone number and greets them in their language."
        actions={<Button icon={<Users className="h-4 w-4" />} onClick={() => setEditing("new")}>Add customer</Button>} />
      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable rows={data!} rowKey={(c) => c.customer_id} searchable searchText={(c) => `${fullName(c)} ${c.customer_phone} ${c.email ?? ""}`}
          empty={<EmptyState title="No customers yet" body="Customers are added automatically after their first call, or add one yourself." action={<Button onClick={() => setEditing("new")}>Add customer</Button>} />}
          columns={[
            { key: "n", header: "Name", sortValue: (c) => fullName(c), cell: (c) => <div><p className="font-medium">{fullName(c)}</p>{c.notes && <p className="max-w-xs truncate text-xs text-ink-mute">{c.notes}</p>}</div> },
            { key: "p", header: "Phone", cell: (c) => <span className="tabular-nums">{c.customer_phone}</span> },
            { key: "e", header: "Email", cell: (c) => c.email ?? <span className="text-ink-mute">—</span> },
            { key: "l", header: "Language", cell: (c) => <Badge>{(c.language || "—").toUpperCase()}</Badge> },
            { key: "a", header: "", className: "text-right whitespace-nowrap", cell: (c) => <>
              <Button size="sm" variant="ghost" onClick={() => setCallsFor(c)}>View calls</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(c)}>Delete</Button></> },
          ]} />
      )}
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add customer" : "Edit customer"} fields={fields} initial={initial}
        submitLabel={editing === "new" ? "Add customer" : "Save changes"} onSubmit={(v) => save.mutateAsync(v)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete customer" confirmLabel="Delete customer" loading={del.isPending}
        body={<>Delete <b>{deleting && fullName(deleting)}</b>? Their call history stays, but the AI will treat them as a new caller.</>}
        onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
      <CustomerCallsDialog customer={callsFor} onClose={() => setCallsFor(null)} />
    </>
  );
}

function CustomerCallsDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["customer-calls", customer?.customer_id], queryFn: () => customersApi.calls(customer!.customer_id), enabled: !!customer });
  const [open, setOpen] = useState<CallMeta | null>(null);
  return (
    <>
      <Dialog open={!!customer && !open} onClose={onClose} size="lg" title={`Call history — ${customer ? fullName(customer) : ""}`}>
        {isLoading ? <Loading /> : !data?.length ? <EmptyState title="No calls found" body="This customer hasn't called yet." /> : (
          <ul className="divide-y divide-line">
            {data.map((c) => (
              <li key={c.call_sid} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div><p className="text-ink">{c.summary}</p><p className="text-xs text-ink-mute">{dateTime(c.call_start)} · {duration(c.call_duration)}</p></div>
                <Button size="sm" variant="secondary" onClick={() => setOpen(c)}>View conversation</Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <ConversationDialog call={open} onClose={() => setOpen(null)} />
    </>
  );
}
