import { useEffect, useState, type ReactNode } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  Badge, Button, Card, categoriesApi, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, FormDialog, itemsApi, Loading, modifierGroupsApi, modifiersApi, money,
  optionGroupsApi, optionsApi, PageHeader, Select, tagsApi, useAction, type FieldDef,
} from "@polydial/shared";

/** Loads every catalog list the item editors need. */
export function useCatalog() {
  const items = useQuery({ queryKey: ["items"], queryFn: () => itemsApi.list() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const optionGroups = useQuery({ queryKey: ["option-groups"], queryFn: () => optionGroupsApi.list() });
  const modifierGroups = useQuery({ queryKey: ["modifier-groups"], queryFn: () => modifierGroupsApi.list() });
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => tagsApi.list() });
  return { items: items.data ?? [], categories: categories.data ?? [], optionGroups: optionGroups.data ?? [], modifierGroups: modifierGroups.data ?? [], tags: tags.data ?? [],
    loading: items.isLoading || categories.isLoading || optionGroups.isLoading || modifierGroups.isLoading || tags.isLoading };
}

interface CrudApi<R> { list: (q?: any) => Promise<R[]>; create: (b: Partial<R>) => Promise<R>; update: (id: any, b: Partial<R>) => Promise<R>; remove: (id: any) => Promise<unknown> }

/** Flat list page: categories, tags. */
function SimpleCrudPage<R extends Record<string, any>, F extends Record<string, any>>({ title, description, noun, api, qk, idKey, fields, blank, columns, usage }: {
  title: string; description: string; noun: string; api: CrudApi<R>; qk: string; idKey: keyof R & string; fields: FieldDef<F>[]; blank: F;
  columns: { key: string; header: string; cell: (r: R) => ReactNode }[]; usage: (r: R) => number;
}) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: [qk], queryFn: () => api.list() });
  const [editing, setEditing] = useState<R | "new" | null>(null);
  const [deleting, setDeleting] = useState<R | null>(null);
  const inv: QueryKey[] = [[qk], ["items"]];
  const save = useAction((v: F) => (editing && editing !== "new" ? api.update(editing[idKey], v as any) : api.create(v as any)), { invalidate: inv, success: `${noun} saved`, silentError: true });
  const del = useAction((r: R) => api.remove(r[idKey]), { invalidate: inv, success: `${noun} deleted` });
  return (
    <>
      <PageHeader title={title} description={description} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>Add {noun.toLowerCase()}</Button>} />
      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable rows={data!} rowKey={(r) => r[idKey]} searchable searchText={(r) => String(r.name)}
          empty={<EmptyState title={`No ${title.toLowerCase()} yet`} action={<Button onClick={() => setEditing("new")}>Create first {noun.toLowerCase()}</Button>} />}
          columns={[...columns, { key: "use", header: "Used by", cell: (r) => `${usage(r)} item${usage(r) === 1 ? "" : "s"}` },
            { key: "a", header: "", cell: (r) => <div className="text-right whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(r)}>Delete</Button></div> }]} />
      )}
      <FormDialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? `Add ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`} fields={fields}
        initial={editing && editing !== "new" ? ({ ...blank, ...Object.fromEntries(Object.keys(blank).map((k) => [k, editing[k] ?? blank[k]])) } as F) : blank} submitLabel="Save" onSubmit={(v) => save.mutateAsync(v)} size="sm" />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${noun.toLowerCase()}`} loading={del.isPending}
        body={<>Delete <b>{deleting?.name}</b>?{deleting && usage(deleting) > 0 && ` It will be removed from ${usage(deleting)} item${usage(deleting) === 1 ? "" : "s"}.`}</>}
        onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
    </>
  );
}

export function CategoriesPage() {
  const { items } = useCatalog();
  return <SimpleCrudPage title="Item categories" description="Group items so the AI can answer 'what pastas do you have?'" noun="Category" api={categoriesApi} qk="categories" idKey="item_category_id"
    fields={[{ name: "name", label: "Category name", required: true, placeholder: "e.g. Appetizers, Main courses, Desserts" }, { name: "description", label: "Description", type: "textarea", placeholder: "Describe this category…" }]}
    blank={{ name: "", description: "" }} usage={(c) => items.filter((i) => i.category_ids.includes(c.item_category_id)).length}
    columns={[{ key: "n", header: "Category", cell: (c) => <div><p className="font-medium">{c.name}</p>{c.description && <p className="text-xs text-ink-mute">{c.description}</p>}</div> }, { key: "id", header: "ID", cell: (c) => <span className="text-ink-mute tabular-nums">#{c.item_category_id}</span> }]} />;
}

export function TagsPage() {
  const { items } = useCatalog();
  return <SimpleCrudPage title="Tags" description="Labels like Vegetarian or Spicy that callers can filter by when they ask." noun="Tag" api={tagsApi} qk="tags" idKey="tag_id"
    fields={[{ name: "name", label: "Tag name", required: true, placeholder: "e.g. Vegetarian, Spicy, Popular" }]} blank={{ name: "" }}
    usage={(t) => items.filter((i) => i.tag_ids.includes(t.tag_id)).length} columns={[{ key: "n", header: "Tag", cell: (t) => <Badge tone="info">{t.name}</Badge> }]} />;
}

/** Group + children page: option groups/options and modifier groups/modifiers. */
function GroupChildPage<G extends Record<string, any>, C extends Record<string, any>>(p: {
  title: string; description: string; groupNoun: string; childNoun: string; groupApi: CrudApi<G>; childApi: CrudApi<C>; gqk: string; cqk: string;
  gid: keyof G & string; cid: keyof C & string; groupFields: FieldDef<any>[]; groupBlank: Record<string, any>; childFields: FieldDef<any>[]; childBlank: Record<string, any>;
  groupSummary: (g: G) => string; childExtra: (c: C) => ReactNode; usage: (g: G) => number;
}) {
  const groups = useQuery({ queryKey: [p.gqk], queryFn: () => p.groupApi.list() });
  const [sel, setSel] = useState<string>("");
  useEffect(() => { if (!sel && groups.data?.length) setSel(String(groups.data[0][p.gid])); }, [groups.data, sel, p.gid]);
  const group = groups.data?.find((g) => String(g[p.gid]) === sel);
  const children = useQuery({ queryKey: [p.cqk, sel], queryFn: () => p.childApi.list({ [p.gid]: sel }), enabled: !!sel });
  const [gEdit, setGEdit] = useState<G | "new" | null>(null);
  const [gDel, setGDel] = useState<G | null>(null);
  const [cEdit, setCEdit] = useState<C | "new" | null>(null);
  const [cDel, setCDel] = useState<C | null>(null);
  const saveG = useAction((v: any) => (gEdit && gEdit !== "new" ? p.groupApi.update(gEdit[p.gid], v) : p.groupApi.create(v)), { invalidate: [[p.gqk]], success: `${p.groupNoun} saved`, silentError: true });
  const delG = useAction((g: G) => p.groupApi.remove(g[p.gid]), { invalidate: [[p.gqk], ["items"]], success: `${p.groupNoun} deleted` });
  const saveC = useAction((v: any) => (cEdit && cEdit !== "new" ? p.childApi.update(cEdit[p.cid], v) : p.childApi.create({ ...v, [p.gid]: Number(sel) })), { invalidate: [[p.cqk]], success: `${p.childNoun} saved`, silentError: true });
  const delC = useAction((c: C) => p.childApi.remove(c[p.cid]), { invalidate: [[p.cqk]], success: `${p.childNoun} deleted` });
  const pick = (blank: Record<string, any>, r: any) => Object.fromEntries(Object.keys(blank).map((k) => [k, r?.[k] ?? blank[k]]));

  return (
    <>
      <PageHeader title={p.title} description={p.description} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setGEdit("new")}>Add {p.groupNoun.toLowerCase()}</Button>} />
      {groups.isLoading ? <Loading /> : !groups.data?.length ? <EmptyState title={`No ${p.groupNoun.toLowerCase()}s yet`} action={<Button onClick={() => setGEdit("new")}>Add {p.groupNoun.toLowerCase()}</Button>} /> : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Card title={`${p.groupNoun}s`}>
            <Field label={`Select ${p.groupNoun.toLowerCase()}`} htmlFor="grp"><Select id="grp" value={sel} onChange={(e) => setSel(e.target.value)}>{groups.data.map((g) => <option key={g[p.gid]} value={g[p.gid]}>{g.name}</option>)}</Select></Field>
            {group && <div className="mt-4 space-y-2 text-sm">
              <p className="font-display text-lg font-semibold">{group.name}</p>
              <p className="text-ink-soft">{p.groupSummary(group)}</p>
              <p className="text-ink-mute">Attached to {p.usage(group)} item{p.usage(group) === 1 ? "" : "s"}</p>
              <div className="flex gap-2 pt-2"><Button size="sm" variant="secondary" onClick={() => setGEdit(group)}>Edit group</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setGDel(group)}>Delete group</Button></div>
            </div>}
          </Card>
          <Card title={`${p.childNoun}s${group ? ` in ${group.name}` : ""}`} actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} disabled={!group} onClick={() => setCEdit("new")}>Add {p.childNoun.toLowerCase()}</Button>}>
            {children.isLoading ? <Loading /> : !children.data?.length ? <EmptyState title={`No ${p.childNoun.toLowerCase()}s in this group`} body="Callers won't hear any choices until you add some." /> : (
              <ul className="divide-y divide-line">{[...children.data].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map((c) => (
                <li key={c[p.cid]} className="flex items-center justify-between gap-3 py-2.5">
                  <div><p className="font-medium">{c.name} {p.childExtra(c)}</p><p className="text-xs text-ink-mute tabular-nums">{Number(c.price_delta) === 0 ? "No extra charge" : `${Number(c.price_delta) > 0 ? "+" : ""}${money(c.price_delta)}`}</p></div>
                  <div className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => setCEdit(c)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setCDel(c)}>Delete</Button></div>
                </li>))}</ul>
            )}
          </Card>
        </div>
      )}
      <FormDialog open={!!gEdit} onClose={() => setGEdit(null)} size="sm" title={gEdit === "new" ? `Add ${p.groupNoun.toLowerCase()}` : `Edit ${p.groupNoun.toLowerCase()}`} fields={p.groupFields}
        initial={gEdit === "new" ? p.groupBlank : pick(p.groupBlank, gEdit)} submitLabel={gEdit === "new" ? "Create" : "Update group"} onSubmit={async (v) => { const r: any = await saveG.mutateAsync(v); if (gEdit === "new") setSel(String(r[p.gid])); }} />
      <FormDialog open={!!cEdit} onClose={() => setCEdit(null)} size="sm" title={cEdit === "new" ? `Add ${p.childNoun.toLowerCase()}` : `Edit ${p.childNoun.toLowerCase()}`} fields={p.childFields}
        initial={cEdit === "new" ? p.childBlank : pick(p.childBlank, cEdit)} submitLabel="Save" onSubmit={(v) => saveC.mutateAsync(v)} />
      <ConfirmDialog open={!!gDel} onClose={() => setGDel(null)} title={`Delete ${p.groupNoun.toLowerCase()}`} loading={delG.isPending}
        body={<>Delete <b>{gDel?.name}</b> and all its {p.childNoun.toLowerCase()}s? It's removed from every item that uses it.</>} onConfirm={() => delG.mutate(gDel!, { onSuccess: () => { setGDel(null); setSel(""); } })} />
      <ConfirmDialog open={!!cDel} onClose={() => setCDel(null)} title={`Delete ${p.childNoun.toLowerCase()}`} loading={delC.isPending} body={<>Delete <b>{cDel?.name}</b>?</>} onConfirm={() => delC.mutate(cDel!, { onSuccess: () => setCDel(null) })} />
    </>
  );
}

const minMax = (min: number, max: number) => (max <= 1 ? (min ? "Pick exactly one" : "Pick up to one") : `Pick ${min}–${max}`);
const maxGteMin = (v: number, a: any) => (Number(v) < Number(a.min_select) ? "Maximum must be at least the minimum." : undefined);

export function OptionsPage() {
  const { items } = useCatalog();
  return <GroupChildPage title="Options" description="Choices that replace each other, like size or crust. Callers pick from these." groupNoun="Option group" childNoun="Option"
    groupApi={optionGroupsApi} childApi={optionsApi} gqk="option-groups" cqk="options" gid="option_group_id" cid="option_id"
    groupFields={[{ name: "name", label: "Group name", required: true, placeholder: "e.g. Size" }, { name: "min_select", label: "Minimum select", type: "number", min: 0, half: true, required: true }, { name: "max_select", label: "Maximum select", type: "number", min: 1, half: true, required: true, validate: maxGteMin }, { name: "is_required", label: "Required option group", type: "switch", description: "The AI must ask the caller to choose." }]}
    groupBlank={{ name: "", min_select: 1, max_select: 1, is_required: true }}
    childFields={[{ name: "name", label: "Option name", required: true, placeholder: "e.g. Large (16\")" }, { name: "price_delta", label: "Price change", type: "money", hint: "Negative for cheaper, e.g. -3.00" }, { name: "display_order", label: "Display order", type: "number", min: 0, half: true }, { name: "is_default", label: "Default choice", type: "switch" }]}
    childBlank={{ name: "", price_delta: 0, display_order: 1, is_default: false }}
    groupSummary={(g) => `${g.is_required ? "Required" : "Optional"} · ${minMax(g.min_select, g.max_select)}`} childExtra={(c) => (c.is_default ? <Badge tone="good">Default</Badge> : null)}
    usage={(g) => items.filter((i) => i.option_group_ids.includes(g.option_group_id)).length} />;
}

export function ModifiersPage() {
  const { items } = useCatalog();
  return <GroupChildPage title="Modifiers" description="Add-ons that stack, like extra toppings or dips." groupNoun="Modifier group" childNoun="Modifier"
    groupApi={modifierGroupsApi} childApi={modifiersApi} gqk="modifier-groups" cqk="modifiers" gid="modifier_group_id" cid="modifier_id"
    groupFields={[{ name: "name", label: "Group name", required: true, placeholder: "e.g. Pizza toppings" }, { name: "min_select", label: "Minimum select", type: "number", min: 0, half: true, required: true }, { name: "max_select", label: "Maximum select", type: "number", min: 1, half: true, required: true, validate: maxGteMin }, { name: "is_required", label: "Required group", type: "switch" }]}
    groupBlank={{ name: "", min_select: 0, max_select: 3, is_required: false }}
    childFields={[{ name: "name", label: "Modifier name", required: true, placeholder: "e.g. Hot sauce" }, { name: "price_delta", label: "Price change", type: "money" }, { name: "display_order", label: "Display order", type: "number", min: 0, half: true }, { name: "is_active", label: "Active modifier", type: "switch", description: "Turn off when you run out." }]}
    childBlank={{ name: "", price_delta: 0, display_order: 1, is_active: true }}
    groupSummary={(g) => `${g.is_required ? "Required" : "Optional"} · ${minMax(g.min_select, g.max_select)}`} childExtra={(c) => (!c.is_active ? <Badge>Off</Badge> : null)}
    usage={(g) => items.filter((i) => i.modifier_group_ids.includes(g.modifier_group_id)).length} />;
}
