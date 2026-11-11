import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Languages, Plus } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FormDialog, Loading, PageHeader, Select, languagesApi, money, servicesApi, useAction, type FieldDef, type Service } from "@polydial/shared";

type SvcForm = { name: string; description: string; duration_minutes: number | ""; price: number | ""; buffer_before_minutes: number | ""; buffer_after_minutes: number | ""; is_active: boolean };
const detailFields: FieldDef<SvcForm>[] = [
  { name: "duration_minutes", label: "Duration (minutes)", type: "number", required: true, min: 5, max: 480, half: true },
  { name: "price", label: "Price", type: "money", required: true, min: 0, half: true },
  { name: "buffer_before_minutes", label: "Buffer before (minutes)", type: "number", min: 0, max: 120, half: true, hint: "Prep time blocked before each booking." },
  { name: "buffer_after_minutes", label: "Buffer after (minutes)", type: "number", min: 0, max: 120, half: true, hint: "Clean-up time after." },
  { name: "is_active", label: "Service is active", type: "switch", description: "Inactive services aren't offered to callers." },
];
const nameFields: FieldDef<SvcForm>[] = [
  { name: "name", label: "Service name", required: true, placeholder: "e.g. Hair cut" },
  { name: "description", label: "Description", type: "textarea", placeholder: "What callers should know — the AI uses this to answer questions." },
];

/** Service list with per-language names. Used on the Services page and the dashboard. */
export function ServicesManager({ compact }: { compact?: boolean }) {
  const services = useQuery({ queryKey: ["services"], queryFn: () => servicesApi.list() });
  const langs = useQuery({ queryKey: ["business-languages"], queryFn: languagesApi.business });
  const defaultLang = langs.data?.find((l) => l.is_default)?.language_code ?? "en";
  const [lang, setLang] = useState<string>("");
  const viewLang = lang || defaultLang;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [translating, setTranslating] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const create = useAction((v: SvcForm) => servicesApi.create(v as unknown as Service), { invalidate: [["services"]], success: "Service created", silentError: true });
  const update = useAction((v: SvcForm) => servicesApi.update(editing!.service_id, v as unknown as Service), { invalidate: [["services"]], success: "Service updated", silentError: true });
  const translate = useAction((v: SvcForm) => servicesApi.translate(translating!.service_id, viewLang, { name: v.name, description: v.description || null }), { invalidate: [["services"]], success: "Translation updated", silentError: true });
  const del = useAction((s: Service) => servicesApi.remove(s.service_id), { invalidate: [["services"]], success: "Service deleted" });

  const isDefault = viewLang === defaultLang;
  const label = (s: Service) => (isDefault ? s : s.translations?.[viewLang]) ?? null;
  const blank: SvcForm = { name: "", description: "", duration_minutes: 30, price: 0, buffer_before_minutes: 0, buffer_after_minutes: 0, is_active: true };

  return (
    <Card title="Services" description={compact ? "What callers can book" : "What the AI can book for callers, with names in each language you support."}
      actions={<>
        <Select aria-label="Language" className="h-8 w-40 text-sm" value={viewLang} onChange={(e) => setLang(e.target.value)}>
          {langs.data?.map((l) => <option key={l.language_code} value={l.language_code}>{l.language_name}{l.is_default ? " (default)" : ""}</option>)}
        </Select>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Add service</Button>
      </>}>
      {services.isLoading ? <Loading /> : services.error ? <ErrorState error={services.error} onRetry={services.refetch} /> : !services.data?.length
        ? <EmptyState title="No services yet" body="Add what you offer so the AI can book it." action={<Button onClick={() => setCreating(true)}>Add your first service</Button>} />
        : (
          <ul className="divide-y divide-line">
            {(compact ? services.data.slice(0, 4) : services.data).map((s) => {
              const t = label(s);
              return (
                <li key={s.service_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {t?.name ?? <span className="italic text-ink-mute">{s.name} — not translated</span>}
                      {!s.is_active && <Badge>Inactive</Badge>}
                    </p>
                    {t?.description && <p className="mt-0.5 max-w-xl text-sm text-ink-soft">{t.description}</p>}
                    <p className="mt-1 text-xs text-ink-mute tabular-nums">{s.duration_minutes} min · {Number(s.price) ? money(s.price) : "Free"}{(s.buffer_before_minutes || s.buffer_after_minutes) ? ` · buffers ${s.buffer_before_minutes}/${s.buffer_after_minutes} min` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    {!isDefault && <Button size="sm" variant="ghost" icon={<Languages className="h-3.5 w-3.5" />} onClick={() => setTranslating(s)}>Update translation</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(s)}>Delete</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      <FormDialog open={creating} onClose={() => setCreating(false)} title="Add service" submitLabel="Create service" fields={[...nameFields, ...detailFields]} initial={blank} onSubmit={(v) => create.mutateAsync(v)} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title="Edit service" submitLabel="Update service" fields={[...nameFields, ...detailFields]}
        initial={editing ? { ...blank, ...editing, description: editing.description ?? "" } : blank} onSubmit={(v) => update.mutateAsync(v)} />
      <FormDialog open={!!translating} onClose={() => setTranslating(null)} title={`Update translation (${viewLang.toUpperCase()})`} description={translating ? `Original: ${translating.name}` : undefined}
        submitLabel="Update translation" fields={nameFields}
        initial={{ ...blank, name: translating?.translations?.[viewLang]?.name ?? "", description: translating?.translations?.[viewLang]?.description ?? "" }} onSubmit={(v) => translate.mutateAsync(v)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete service" loading={del.isPending}
        body={<>Delete <b>{deleting?.name}</b>? Existing appointments keep their time, but callers can't book it anymore.</>}
        onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
    </Card>
  );
}

export function ServicesPage() {
  return <><PageHeader title="Services" description="Define what callers can book, how long it takes and what it costs." /><ServicesManager /></>;
}
