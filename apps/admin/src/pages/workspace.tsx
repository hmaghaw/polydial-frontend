import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Mail, Phone, Plus, UserPlus } from "lucide-react";
import {
  Badge, Button, BusinessHoursSection, BusinessProfileSection, Card, ConfirmDialog, DataTable, date, dateTime, dbApi, Dialog, EmptyState, ErrorState, FormDialog, LanguagesSection,
  languagesApi, Loading, PageHeader, PhoneNumbersSection, Select, supportApi, translationsApi, useAction, useAuth, usersApi, env, resetMockDb, useToast, type FieldDef, type Translation, type User,
} from "@polydial/shared";
import { ServicesManager } from "./services";

// ---------------- Team ----------------
type UserForm = Pick<User, "first_name" | "last_name" | "email" | "role" | "phone" | "active"> & { department: string };
export function TeamManagementPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list() });
  const { user: me } = useAuth();
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const save = useAction((v: UserForm) => (editing && editing !== "new" ? usersApi.update(editing.id, v) : usersApi.create(v)), { invalidate: [["users"]], success: editing === "new" ? "Invitation sent" : "Team member updated", silentError: true });
  const del = useAction((u: User) => usersApi.remove(u.id), { invalidate: [["users"]], success: "Team member removed" });
  const fields: FieldDef<UserForm>[] = [
    { name: "first_name", label: "First name", required: true, half: true },
    { name: "last_name", label: "Last name", required: true, half: true },
    { name: "email", label: "Email", type: "email", required: true, hint: "They'll get an invite to set a password." },
    { name: "phone", label: "Phone", type: "tel", half: true },
    { name: "department", label: "Department", type: "select", half: true, options: ["Customer Support", "Sales", "Technical", "Management"].map((d) => ({ value: d, label: d })) },
    { name: "role", label: "Role", type: "select", required: true, options: [{ value: "admin", label: "Admin — full access incl. billing" }, { value: "manager", label: "Manager — everything except team & billing" }, { value: "staff", label: "Staff — calls, customers, calendar" }] },
    { name: "active", label: "Active", type: "switch", description: "Inactive members can't sign in." },
  ];
  const rows = (data ?? []).filter((u) => !dept || u.department === dept);
  const top = [...(data ?? [])].filter((u) => u.active).sort((a, b) => (b.calls_handled ?? 0) - (a.calls_handled ?? 0)).slice(0, 3);
  return (
    <>
      <PageHeader title="Team" description="People who can sign in to this portal and take handed-off calls." actions={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing("new")}>Add team member</Button>} />
      {top.length > 0 && <Card className="mb-5" title="Top performers this month"><div className="grid gap-3 sm:grid-cols-3">{top.map((u, i) => (
        <div key={u.id} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-signal/10 font-display font-semibold text-signal">{i + 1}</span>
          <div><p className="font-medium">{u.first_name} {u.last_name}</p><p className="text-xs text-ink-mute tabular-nums">{u.calls_handled} calls · {u.satisfaction?.toFixed(1)} / 5</p></div></div>))}</div></Card>}
      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable rows={rows} rowKey={(u) => u.id} searchable searchText={(u) => `${u.first_name} ${u.last_name} ${u.email}`}
          toolbar={<Select aria-label="Department" className="w-48" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{["Customer Support", "Sales", "Technical", "Management"].map((d) => <option key={d}>{d}</option>)}</Select>}
          columns={[
            { key: "n", header: "Name", sortValue: (u) => u.first_name, cell: (u) => <div><p className="font-medium">{u.first_name} {u.last_name}{u.id === me?.id && <span className="text-ink-mute"> (you)</span>}</p><p className="text-xs text-ink-mute">{u.email}</p></div> },
            { key: "d", header: "Department", cell: (u) => u.department ?? "—" },
            { key: "r", header: "Role", cell: (u) => <Badge tone={u.role === "admin" ? "info" : "neutral"}>{u.role}</Badge> },
            { key: "s", header: "Status", cell: (u) => <Badge tone={!u.active ? "neutral" : u.email_verified ? "good" : "warn"}>{!u.active ? "Inactive" : u.email_verified ? "Active" : "Invited"}</Badge> },
            { key: "l", header: "Last sign-in", cell: (u) => (u.last_login ? dateTime(u.last_login) : "Never") },
            { key: "a", header: "", className: "text-right whitespace-nowrap", cell: (u) => <><Button size="sm" variant="ghost" onClick={() => setViewing(u)}>View profile</Button><Button size="sm" variant="ghost" onClick={() => setEditing(u)}>Edit</Button>{u.id !== me?.id && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(u)}>Remove</Button>}</> },
          ]} />
      )}
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add team member" : "Edit team member"} fields={fields}
        initial={editing && editing !== "new" ? { ...editing, department: editing.department ?? "" } : { first_name: "", last_name: "", email: "", phone: "", role: "staff", active: true, department: "Customer Support" }}
        submitLabel={editing === "new" ? "Send invitation" : "Save changes"} onSubmit={(v) => save.mutateAsync(v)} />
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.first_name} ${viewing.last_name}` : ""} size="sm">
        {viewing && <dl className="grid grid-cols-2 gap-3 text-sm">{[["Email", viewing.email], ["Phone", viewing.phone ?? "—"], ["Role", viewing.role], ["Department", viewing.department ?? "—"], ["Calls handled", viewing.calls_handled ?? 0], ["Satisfaction", `${viewing.satisfaction?.toFixed(1) ?? "—"} / 5`]].map(([k, v]) => <div key={k as string}><dt className="text-ink-mute">{k}</dt><dd>{v}</dd></div>)}</dl>}
      </Dialog>
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} title="Remove team member" confirmLabel="Remove" loading={del.isPending}
        body={<><b>{removing?.first_name} {removing?.last_name}</b> loses access immediately. Their call history stays.</>} onConfirm={() => del.mutate(removing!, { onSuccess: () => setRemoving(null) })} />
    </>
  );
}

// ---------------- Translations ----------------
type TrForm = Pick<Translation, "phrase" | "language_code" | "translated_phrase">;
export function TranslationsPage() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["translations", search, language], queryFn: () => translationsApi.list({ search, language }) });
  const { data: langs } = useQuery({ queryKey: ["languages"], queryFn: languagesApi.catalog });
  const [editing, setEditing] = useState<Translation | "new" | null>(null);
  const [deleting, setDeleting] = useState<Translation | null>(null);
  const save = useAction((v: TrForm) => (editing && editing !== "new" ? translationsApi.update(editing.translation_id, { ...v, updated_at: new Date().toISOString() }) : translationsApi.create(v)), { invalidate: [["translations"]], success: "Translation saved", silentError: true });
  const del = useAction((t: Translation) => translationsApi.remove(t.translation_id), { invalidate: [["translations"]], success: "Translation deleted" });
  const langName = (c: string) => langs?.find((l) => l.language_code === c)?.language_name ?? c;
  const fields: FieldDef<TrForm>[] = [
    { name: "phrase", label: "Original phrase (English)", required: true, placeholder: "Your order is confirmed" },
    { name: "language_code", label: "Language", type: "select", required: true, options: langs?.filter((l) => l.language_code !== "en").map((l) => ({ value: l.language_code, label: l.language_name })) ?? [] },
    { name: "translated_phrase", label: "Translation", type: "textarea", required: true, hint: "The AI uses this wording exactly instead of translating on the fly." },
  ];
  return (
    <>
      <PageHeader title="Translations" description="Fixed wording for phrases the AI says often, per language." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>Add translation</Button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm sm:w-80" placeholder="Search phrases or translations…" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Language" className="w-48" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="">All languages</option>{langs?.map((l) => <option key={l.language_code} value={l.language_code}>{l.language_name}</option>)}</Select>
      </div>
      {isLoading ? <Loading /> : (
        <DataTable rows={data ?? []} rowKey={(t) => t.translation_id}
          empty={<EmptyState title="No translations" body={search || language ? "Nothing matches these filters." : "Add a phrase to control exactly how the AI says it."} />}
          columns={[
            { key: "p", header: "Original phrase", cell: (t) => t.phrase },
            { key: "t", header: "Translation", cell: (t) => <span dir="auto">{t.translated_phrase}</span> },
            { key: "l", header: "Language", cell: (t) => <Badge>{langName(t.language_code)}</Badge> },
            { key: "u", header: "Last updated", cell: (t) => date(t.updated_at) },
            { key: "a", header: "", className: "text-right whitespace-nowrap", cell: (t) => <><Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(t)}>Delete</Button></> },
          ]} />
      )}
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add translation" : "Edit translation"} fields={fields}
        initial={editing && editing !== "new" ? editing : { phrase: "", language_code: "", translated_phrase: "" }} submitLabel="Save translation" onSubmit={(v) => save.mutateAsync(v)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete translation" loading={del.isPending} body={`The AI will translate "${deleting?.phrase}" automatically instead.`} onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
    </>
  );
}

// ---------------- Settings ----------------
export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Everything the AI needs to answer for your business." />
      <div className="space-y-5">
        <BusinessProfileSection />
        <LanguagesSection />
        <PhoneNumbersSection compact />
        <ServicesManager />
        <BusinessHoursSection />
      </div>
    </>
  );
}

// ---------------- Database browser (admin only) ----------------
export function DatabaseBrowserPage() {
  const tables = useQuery({ queryKey: ["db-tables"], queryFn: dbApi.tables });
  const [table, setTable] = useState("");
  const [page, setPage] = useState(1);
  const rows = useQuery({ queryKey: ["db-rows", table, page], queryFn: () => dbApi.rows(table, page), enabled: !!table });
  return (
    <>
      <PageHeader title="Database" description="Read-only view of your business's records, for troubleshooting." />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card title="Tables" bodyClass="p-2">{tables.isLoading ? <Loading /> : tables.data?.map((t) => (
          <button key={t.name} onClick={() => { setTable(t.name); setPage(1); }} className={`flex w-full justify-between rounded px-2.5 py-1.5 text-left text-sm ${table === t.name ? "bg-signal/10 text-signal-700" : "hover:bg-paper"}`}>
            <span className="font-medium">{t.name}</span><span className="tabular-nums text-ink-mute">{t.rows}</span></button>))}</Card>
        <div className="min-w-0">{!table ? <EmptyState icon={<Database className="h-8 w-8" />} title="Pick a table" body="Choose a table on the left to see its rows." />
          : rows.isLoading ? <Loading /> : rows.error ? <ErrorState error={rows.error} /> : (
            <Card title={table} description={`${rows.data!.total} rows`} bodyClass="p-0" actions={<>
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page * 20 >= rows.data!.total} onClick={() => setPage(page + 1)}>Next</Button></>}>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead className="bg-paper text-left text-ink-soft"><tr>{rows.data!.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}</tr></thead>
                <tbody>{rows.data!.rows.map((r, i) => <tr key={i} className="border-t border-line">{rows.data!.columns.map((c) => <td key={c} className="max-w-[240px] truncate whitespace-nowrap px-3 py-2" title={String(r[c] ?? "")}>{r[c] === null || r[c] === undefined ? <span className="text-ink-mute">null</span> : String(r[c])}</td>)}</tr>)}</tbody>
              </table></div>
            </Card>
          )}</div>
      </div>
    </>
  );
}

// ---------------- About & Contact ----------------
export function AboutPage() {
  const toast = useToast();
  return (
    <>
      <PageHeader title="About PolyDial" />
      <Card>
        <div className="max-w-2xl space-y-3 text-sm text-ink-soft">
          <p>PolyDial answers your business phone with a multilingual AI receptionist. It takes orders, books appointments and answers questions in the caller's language, and hands off to your team when a person is needed.</p>
          <p>This portal: version 1.0.0 · API {env.USE_MOCKS ? "in demo mode (data stays in this browser)" : env.API_BASE_URL}.</p>
        </div>
        {env.USE_MOCKS && <Button className="mt-5" variant="secondary" onClick={() => { resetMockDb(); toast("Demo data reset"); setTimeout(() => location.reload(), 400); }}>Reset demo data</Button>}
      </Card>
    </>
  );
}
export function ContactPage() {
  const { user } = useAuth();
  const send = useAction((v: { subject: string; message: string; email: string }) => supportApi.contact(v), { success: (r) => r.message, silentError: true });
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Contact support" description="We reply within one business day, Monday to Friday, 9am–6pm ET." />
      <div className="grid gap-5 md:grid-cols-3">
        <Card><Mail className="h-5 w-5 text-signal" /><p className="mt-2 font-medium">Email</p><a className="text-sm text-signal hover:underline" href="mailto:support@polydial.com">support@polydial.com</a></Card>
        <Card><Phone className="h-5 w-5 text-signal" /><p className="mt-2 font-medium">Phone</p><p className="text-sm text-ink-soft">+1 (416) 555-0100</p></Card>
        <Card><p className="font-medium">Send us a message</p><p className="mb-3 text-sm text-ink-soft">Describe what you need and we'll follow up by email.</p><Button onClick={() => setOpen(true)}>Write a message</Button></Card>
      </div>
      <FormDialog open={open} onClose={() => setOpen(false)} title="Contact support" submitLabel="Send message"
        fields={[{ name: "email", label: "Reply to", type: "email", required: true }, { name: "subject", label: "Subject", required: true }, { name: "message", label: "Message", type: "textarea", required: true, validate: (v) => (String(v).length < 10 ? "Add a bit more detail." : undefined) }]}
        initial={{ email: user?.email ?? "", subject: "", message: "" }} onSubmit={(v) => send.mutateAsync(v)} />
    </>
  );
}
