import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import {
  Badge, Button, Card, categoriesApi, Checkbox, comboGroupsApi, comboItemsApi, ConfirmDialog, DataTable, Dialog, EmptyState, Field, FormDialog, FormFields, Input, itemsApi, Loading,
  modifierGroupsApi, money, optionGroupsApi, PageHeader, Select, tagsApi, useAction, useToast, validateFields, cn, type ComboGroup, type FieldDef, type ID, type RestaurantItem,
} from "@polydial/shared";
import { useCatalog } from "./catalog";

type Basics = { name: string; description: string; base_price: number | ""; calories: number | ""; preparation_time: number | ""; image_url: string; is_active: boolean; is_combo: boolean };
export const basicsFields: FieldDef<Basics>[] = [
  { name: "name", label: "Item name", required: true, placeholder: "e.g. Chicken burger" },
  { name: "base_price", label: "Base price", type: "money", required: true, min: 0, half: true },
  { name: "preparation_time", label: "Prep time (minutes)", type: "number", min: 0, max: 240, half: true, hint: "The AI quotes pickup times from this." },
  { name: "description", label: "Description", type: "textarea", required: true, placeholder: "What's in it — the AI reads this to callers who ask.", },
  { name: "calories", label: "Calories", type: "number", min: 0, half: true },
  { name: "image_url", label: "Image URL", type: "url", half: true, placeholder: "https://…/burger.jpg" },
  { name: "is_active", label: "Available to order", type: "switch", description: "Turn off when an item sells out." },
  { name: "is_combo", label: "Combo item", type: "switch", description: "Bundles other items; set the choices on the Combos page." },
];
export const toBasics = (i?: Partial<RestaurantItem>): Basics => ({ name: i?.name ?? "", description: i?.description ?? "", base_price: i?.base_price ?? "", calories: i?.calories ?? "", preparation_time: i?.preparation_time ?? 10, image_url: i?.image_url ?? "", is_active: i?.is_active ?? true, is_combo: i?.is_combo ?? false });
const fromBasics = (b: Basics): Partial<RestaurantItem> => ({ ...b, base_price: Number(b.base_price), calories: b.calories === "" ? null : Number(b.calories), preparation_time: b.preparation_time === "" ? null : Number(b.preparation_time), image_url: b.image_url || null });

type RelKey = "category_ids" | "option_group_ids" | "modifier_group_ids" | "tag_ids";
const REL: { key: RelKey; label: string; create: string; q: string }[] = [
  { key: "category_ids", label: "Categories", create: "category", q: "categories" },
  { key: "option_group_ids", label: "Option groups", create: "option group", q: "option-groups" },
  { key: "modifier_group_ids", label: "Modifier groups", create: "modifier group", q: "modifier-groups" },
  { key: "tag_ids", label: "Tags", create: "tag", q: "tags" },
];

/** Pick categories / option groups / modifier groups / tags for an item, with inline "create new". */
export function RelationPicker({ rel, value, onChange }: { rel: RelKey; value: ID[]; onChange: (ids: ID[]) => void }) {
  const cat = useCatalog();
  const qc = useQueryClient();
  const meta = REL.find((r) => r.key === rel)!;
  const [creating, setCreating] = useState(false);
  const all: { id: ID; name: string; sub?: string }[] =
    rel === "category_ids" ? cat.categories.map((c) => ({ id: c.item_category_id, name: c.name }))
    : rel === "option_group_ids" ? cat.optionGroups.map((g) => ({ id: g.option_group_id, name: g.name, sub: g.is_required ? "required" : "optional" }))
    : rel === "modifier_group_ids" ? cat.modifierGroups.map((g) => ({ id: g.modifier_group_id, name: g.name, sub: `up to ${g.max_select}` }))
    : cat.tags.map((t) => ({ id: t.tag_id, name: t.name }));
  const fields: FieldDef<any>[] = rel === "option_group_ids" ? [{ name: "name", label: "Option group name", required: true }, { name: "is_required", label: "Required option group", type: "switch" }]
    : rel === "modifier_group_ids" ? [{ name: "name", label: "Modifier group name", required: true, placeholder: "e.g. Pizza toppings, Drink size" }, { name: "min_select", label: "Min select", type: "number", min: 0, half: true }, { name: "max_select", label: "Max select", type: "number", min: 1, half: true }]
    : [{ name: "name", label: `${meta.create[0].toUpperCase()}${meta.create.slice(1)} name`, required: true, placeholder: rel === "tag_ids" ? "Popular" : "e.g. Desserts" }];
  const create = async (v: any) => {
    const api: any = { category_ids: categoriesApi, option_group_ids: optionGroupsApi, modifier_group_ids: modifierGroupsApi, tag_ids: tagsApi }[rel];
    const r = await api.create(v);
    const id = r.item_category_id ?? r.option_group_id ?? r.modifier_group_id ?? r.tag_id;
    await qc.invalidateQueries({ queryKey: [meta.q] });
    onChange([...value, id]);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {all.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
              className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm", on ? "border-signal bg-signal/10 text-signal-700" : "border-line text-ink-soft hover:border-ink/30")}>
              {on && <Check className="h-3.5 w-3.5" />}{o.name}{o.sub && <span className="text-xs opacity-60">· {o.sub}</span>}
            </button>
          );
        })}
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-sm text-ink-mute hover:text-ink"><Plus className="h-3.5 w-3.5" />Create new {meta.create}</button>
      </div>
      <FormDialog open={creating} onClose={() => setCreating(false)} size="sm" title={`Create new ${meta.create}`} submitLabel="Create & add" fields={fields}
        initial={{ name: "", is_required: false, min_select: 0, max_select: 3 }} onSubmit={create} />
    </div>
  );
}

/** Full item editor — basics + relationships. Used by dialog and /edit-item page. */
function ItemEditorBody({ item, onSaved, onCancel }: { item: RestaurantItem; onSaved?: () => void; onCancel?: () => void }) {
  const [basics, setBasics] = useState<Basics>(toBasics(item));
  const [rels, setRels] = useState<Record<RelKey, ID[]>>({ category_ids: item.category_ids, option_group_ids: item.option_group_ids, modifier_group_ids: item.modifier_group_ids, tag_ids: item.tag_ids });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useAction((b: Partial<RestaurantItem>) => itemsApi.update(item.item_id, b), { invalidate: [["items"], ["item", item.item_id]], success: "Item saved" });
  const submit = () => {
    const e = validateFields(basicsFields, basics); setErrors(e);
    if (!Object.keys(e).length) save.mutate({ ...fromBasics(basics), ...rels }, { onSuccess: () => onSaved?.() });
  };
  return (
    <div className="space-y-6">
      <section><h3 className="mb-3 font-display font-semibold">Item details</h3><FormFields fields={basicsFields} values={basics} setValues={setBasics} errors={errors} /></section>
      {REL.map((r) => (
        <section key={r.key}><h3 className="mb-2 font-display font-semibold">{r.label}</h3>
          <RelationPicker rel={r.key} value={rels[r.key]} onChange={(ids) => setRels({ ...rels, [r.key]: ids })} /></section>
      ))}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button loading={save.isPending} onClick={submit}>Save changes</Button>
      </div>
    </div>
  );
}
export function ItemEditDialog({ item, onClose }: { item: RestaurantItem | null; onClose: () => void }) {
  return <Dialog open={!!item} onClose={onClose} title="Edit item" description={item?.name} size="lg">{item && <ItemEditorBody key={item.item_id} item={item} onSaved={onClose} onCancel={onClose} />}</Dialog>;
}
export function EditItemPage() {
  const { itemId } = useParams();
  const nav = useNavigate();
  const valid = itemId && /^\d+$/.test(itemId);
  const { data, isLoading, error } = useQuery({ queryKey: ["item", Number(itemId)], queryFn: () => itemsApi.get(itemId!), enabled: !!valid });
  const back = <Link to="/menu-management"><Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>Back to menu management</Button></Link>;
  if (!valid) return <EmptyState title="Invalid item" body="This link doesn't point to an item." action={back} />;
  if (isLoading) return <Loading />;
  if (error || !data) return <EmptyState title="Item not found" body="It may have been deleted." action={back} />;
  return (
    <>
      <PageHeader title={`Edit ${data.name}`} description={`Item #${data.item_id}`} actions={back} />
      <Card><ItemEditorBody item={data} onSaved={() => nav(-1)} /></Card>
    </>
  );
}

// ---------------- Items list ----------------
export function ItemsPage() {
  const cat = useCatalog();
  const nav = useNavigate();
  const [editing, setEditing] = useState<RestaurantItem | null>(null);
  const [deleting, setDeleting] = useState<RestaurantItem | null>(null);
  const [quick, setQuick] = useState(false);
  const del = useAction((i: RestaurantItem) => itemsApi.remove(i.item_id), { invalidate: [["items"]], success: "Item deleted" });
  const toggle = useAction((i: RestaurantItem) => itemsApi.update(i.item_id, { is_active: !i.is_active }), { invalidate: [["items"]], success: (r) => (r.is_active ? `${r.name} is back on` : `${r.name} marked sold out`) });
  const create = useAction((b: Basics) => itemsApi.create(fromBasics(b)), { invalidate: [["items"]], success: "Item added", silentError: true });
  const name = (ids: ID[], list: { id: ID; name: string }[]) => ids.map((id) => list.find((l) => l.id === id)?.name).filter(Boolean).join(", ");
  const cats = cat.categories.map((c) => ({ id: c.item_category_id, name: c.name }));
  return (
    <>
      <PageHeader title="Items" description="Everything on your menus. Turn items off when they sell out — the AI stops offering them immediately."
        actions={<><Button variant="secondary" onClick={() => setQuick(true)}>Quick add</Button><Button icon={<Plus className="h-4 w-4" />} onClick={() => nav("/create-item-wizard")}>New item</Button></>} />
      {cat.loading ? <Loading /> : (
        <DataTable rows={cat.items} rowKey={(i) => i.item_id} searchable searchText={(i) => `${i.name} ${i.description ?? ""}`}
          empty={<EmptyState title="No items yet" action={<Button onClick={() => nav("/create-item-wizard")}>Create your first item</Button>} />}
          columns={[
            { key: "n", header: "Item", sortValue: (i) => i.name, cell: (i) => <div><p className="font-medium">{i.name} {i.is_combo && <Badge tone="info">Combo</Badge>}</p>{i.description && <p className="max-w-sm truncate text-xs text-ink-mute">{i.description}</p>}</div> },
            { key: "c", header: "Category", cell: (i) => name(i.category_ids, cats) || <span className="text-ink-mute">—</span> },
            { key: "p", header: "Price", sortValue: (i) => i.base_price, cell: (i) => <span className="tabular-nums">{money(i.base_price)}</span> },
            { key: "g", header: "Choices", cell: (i) => <span className="text-xs text-ink-soft">Option groups ({i.option_group_ids.length}) · Modifier groups ({i.modifier_group_ids.length})</span> },
            { key: "s", header: "Status", cell: (i) => <button onClick={() => toggle.mutate(i)} title="Toggle availability"><Badge tone={i.is_active ? "good" : "warn"}>{i.is_active ? "Available" : "Sold out"}</Badge></button> },
            { key: "a", header: "", className: "text-right whitespace-nowrap", cell: (i) => <><Button size="sm" variant="ghost" onClick={() => setEditing(i)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(i)}>Delete</Button></> },
          ]} />
      )}
      <ItemEditDialog item={editing} onClose={() => setEditing(null)} />
      <FormDialog open={quick} onClose={() => setQuick(false)} title="Add new item" fields={basicsFields} initial={toBasics()} submitLabel="Add item" onSubmit={(v) => create.mutateAsync(v)} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete item" loading={del.isPending}
        body={<>Delete <b>{deleting?.name}</b>? It's removed from every menu section. To pause it instead, mark it sold out.</>} onConfirm={() => del.mutate(deleting!, { onSuccess: () => setDeleting(null) })} />
    </>
  );
}

// ---------------- Create item wizard ----------------
const STEPS = ["Create item", "Categories", "Options", "Modifiers", "Tags", "Review"];
export function CreateItemWizardPage() {
  const nav = useNavigate();
  const toast = useToast();
  const cat = useCatalog();
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState<Basics>(toBasics());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [item, setItem] = useState<RestaurantItem | null>(null);
  const [rels, setRels] = useState<Record<RelKey, ID[]>>({ category_ids: [], option_group_ids: [], modifier_group_ids: [], tag_ids: [] });
  const create = useAction((b: Partial<RestaurantItem>) => itemsApi.create(b), { invalidate: [["items"]] });
  const update = useAction((b: Partial<RestaurantItem>) => itemsApi.update(item!.item_id, b), { invalidate: [["items"]] });
  const relFor = REL[step - 1];
  const next = async () => {
    if (step === 0) {
      const e = validateFields(basicsFields, basics); setErrors(e);
      if (Object.keys(e).length) return;
      const r = item ? await update.mutateAsync(fromBasics(basics)) : await create.mutateAsync(fromBasics(basics));
      setItem(r);
    } else if (step <= 4) await update.mutateAsync({ [relFor.key]: rels[relFor.key] });
    setStep(step + 1);
  };
  const names = (key: RelKey) => {
    const src: Record<RelKey, { id: ID; name: string }[]> = {
      category_ids: cat.categories.map((x) => ({ id: x.item_category_id, name: x.name })), option_group_ids: cat.optionGroups.map((x) => ({ id: x.option_group_id, name: x.name })),
      modifier_group_ids: cat.modifierGroups.map((x) => ({ id: x.modifier_group_id, name: x.name })), tag_ids: cat.tags.map((x) => ({ id: x.tag_id, name: x.name })),
    };
    return rels[key].map((id) => src[key].find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "None";
  };
  return (
    <>
      <PageHeader title="Create new item" actions={<Link to="/restaurant/items"><Button variant="ghost" icon={<X className="h-4 w-4" />}>Cancel</Button></Link>} />
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-sm", i === step ? "bg-ink text-white" : i < step ? "bg-signal/10 text-signal-700" : "bg-white text-ink-mute border border-line")}>
            <span className="tabular-nums">{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>
      <Card>
        {step === 0 && <FormFields fields={basicsFields} values={basics} setValues={setBasics} errors={errors} />}
        {step >= 1 && step <= 4 && (<><h2 className="mb-1 font-display text-lg font-semibold">Add {relFor.label.toLowerCase()}</h2><p className="mb-4 text-sm text-ink-soft">Optional — skip if it doesn't apply to {item?.name}.</p>
          <RelationPicker rel={relFor.key} value={rels[relFor.key]} onChange={(ids) => setRels({ ...rels, [relFor.key]: ids })} /></>)}
        {step === 5 && item && (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-mute">Item</dt><dd className="font-medium">{item.name} · {money(item.base_price)}</dd></div>
            <div><dt className="text-ink-mute">Status</dt><dd>{item.is_active ? "Available" : "Sold out"}{item.is_combo && " · Combo"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-ink-mute">Description</dt><dd>{item.description}</dd></div>
            {REL.map((r) => <div key={r.key}><dt className="text-ink-mute">{r.label}</dt><dd>{names(r.key)}</dd></div>)}
          </dl>
        )}
        <div className="mt-6 flex justify-between border-t border-line pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 5 ? <Button loading={create.isPending || update.isPending} onClick={next}>{step === 0 ? (item ? "Save & continue" : "Create item & continue") : "Continue"}</Button>
            : <Button onClick={() => { toast(`${item!.name} is ready`); nav(item!.is_combo ? "/restaurant/combos" : "/restaurant/items"); }}>Finish</Button>}
        </div>
      </Card>
    </>
  );
}

// ---------------- Combos ----------------
export function CombosPage() {
  const cat = useCatalog();
  const combos = cat.items.filter((i) => i.is_combo);
  const [sel, setSel] = useState("");
  useEffect(() => { if (!sel && combos.length) setSel(String(combos[0].item_id)); }, [combos.length]); // eslint-disable-line
  const combo = combos.find((c) => String(c.item_id) === sel);
  const groups = useQuery({ queryKey: ["combo-groups", sel], queryFn: () => comboGroupsApi.list({ item_id: sel }), enabled: !!sel });
  const choices = useQuery({ queryKey: ["combo-items", sel], queryFn: async () => (await Promise.all((groups.data ?? []).map((g) => comboItemsApi.list({ combo_group_id: g.combo_group_id })))).flat(), enabled: !!groups.data });
  const [gEdit, setGEdit] = useState<ComboGroup | "new" | null>(null);
  const [gDel, setGDel] = useState<ComboGroup | null>(null);
  const [addTo, setAddTo] = useState<ComboGroup | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ id: ID; price_delta: number } | null>(null);
  const inv = [["combo-groups", sel], ["combo-items", sel]];
  const saveG = useAction((v: Partial<ComboGroup>) => (gEdit && gEdit !== "new" ? comboGroupsApi.update(gEdit.combo_group_id, v) : comboGroupsApi.create({ ...v, item_id: Number(sel) })), { invalidate: inv, success: "Combo group saved", silentError: true });
  const delG = useAction((g: ComboGroup) => comboGroupsApi.remove(g.combo_group_id), { invalidate: inv, success: "Combo group deleted" });
  const addItem = useAction((v: { combo_group_id: ID; item_id: ID }) => comboItemsApi.create({ ...v, price_delta: 0 }), { invalidate: inv });
  const rmItem = useAction((id: ID) => comboItemsApi.remove(id), { invalidate: inv, success: "Choice removed" });
  const setPrice = useAction((v: { id: ID; price_delta: number }) => comboItemsApi.update(v.id, { price_delta: v.price_delta }), { invalidate: inv, success: "Price adjustment saved", silentError: true });
  const itemName = (id: ID) => cat.items.find((i) => i.item_id === id)?.name ?? `#${id}`;
  const gFields: FieldDef<any>[] = [
    { name: "name", label: "Group name", required: true, placeholder: "e.g. Choose a pizza" },
    { name: "display_order", label: "Display order", type: "number", min: 1, required: true },
    { name: "min_select", label: "Min select", type: "number", min: 0, required: true, half: true },
    { name: "max_select", label: "Max select", type: "number", min: 1, required: true, half: true, validate: (v, a) => (Number(v) < Number(a.min_select) ? "Must be at least the minimum." : undefined) },
  ];
  return (
    <>
      <PageHeader title="Combos" description="Bundles where the caller picks items from each group, e.g. two pizzas and a side." />
      {cat.loading ? <Loading /> : !combos.length ? <EmptyState title="No combo items yet" body="Create an item and switch on 'Combo item' to build a bundle." action={<Link to="/create-item-wizard"><Button>Create combo item</Button></Link>} /> : (
        <>
          <Card className="mb-5"><Field label="Select combo" htmlFor="cb"><Select id="cb" className="sm:w-80" value={sel} onChange={(e) => setSel(e.target.value)}>{combos.map((c) => <option key={c.item_id} value={c.item_id}>{c.name} — {money(c.base_price)}</option>)}</Select></Field></Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Combo groups{combo && ` for ${combo.name}`}</h2><Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setGEdit("new")}>Create combo group</Button></div>
          {groups.isLoading ? <Loading /> : !groups.data?.length ? <EmptyState title="No combo groups" body="Add a group like 'Choose your pizzas' so the AI knows what to ask." /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {[...groups.data].sort((a, b) => a.display_order - b.display_order).map((g) => (
                <Card key={g.combo_group_id} title={g.name} description={`Pick ${g.min_select === g.max_select ? g.min_select : `${g.min_select}–${g.max_select}`}`}
                  actions={<><Button size="sm" variant="ghost" onClick={() => setGEdit(g)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setGDel(g)}>Delete</Button></>}>
                  <ul className="divide-y divide-line">{choices.data?.filter((c) => c.combo_group_id === g.combo_group_id).map((c) => (
                    <li key={c.combo_group_item_id} className="flex items-center justify-between py-2 text-sm"><span>{itemName(c.item_id)}</span>
                      <span className="flex items-center gap-1"><button className="tabular-nums text-ink-soft hover:text-signal" onClick={() => setPriceEdit({ id: c.combo_group_item_id, price_delta: c.price_delta })}>{c.price_delta ? `+${money(c.price_delta)}` : "No upcharge"}</button>
                        <Button size="sm" variant="ghost" aria-label="Remove choice" onClick={() => rmItem.mutate(c.combo_group_item_id)}><X className="h-4 w-4" /></Button></span></li>))}</ul>
                  <Button className="mt-3" size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAddTo(g)}>Add item</Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <FormDialog open={!!gEdit} onClose={() => setGEdit(null)} size="sm" title={gEdit === "new" ? "Create combo group" : "Edit combo group"} fields={gFields} submitLabel="Save"
        initial={gEdit && gEdit !== "new" ? gEdit : { name: "", display_order: (groups.data?.length ?? 0) + 1, min_select: 1, max_select: 1 }} onSubmit={(v) => saveG.mutateAsync(v)} />
      <ConfirmDialog open={!!gDel} onClose={() => setGDel(null)} title="Delete combo group" loading={delG.isPending} body={`Delete "${gDel?.name}" and its choices?`} onConfirm={() => delG.mutate(gDel!, { onSuccess: () => setGDel(null) })} />
      <FormDialog open={!!priceEdit} onClose={() => setPriceEdit(null)} size="sm" title="Edit combo item" submitLabel="Save" fields={[{ name: "price_delta", label: "Price adjustment", type: "money", hint: "Added to the combo price when this choice is picked." }]}
        initial={{ price_delta: priceEdit?.price_delta ?? 0 }} onSubmit={(v) => setPrice.mutateAsync({ id: priceEdit!.id, price_delta: Number(v.price_delta ?? 0) })} />
      <Dialog open={!!addTo} onClose={() => setAddTo(null)} title={`Add items to "${addTo?.name}"`} footer={<Button onClick={() => setAddTo(null)}>Done</Button>}>
        <ul className="divide-y divide-line">{cat.items.filter((i) => !i.is_combo).map((i) => {
          const there = choices.data?.find((c) => c.combo_group_id === addTo?.combo_group_id && c.item_id === i.item_id);
          return <li key={i.item_id} className="py-1"><Checkbox label={<>{i.name} <span className="text-ink-mute">· {money(i.base_price)}</span></>} checked={!!there}
            onChange={(on) => (on ? addItem.mutate({ combo_group_id: addTo!.combo_group_id, item_id: i.item_id }) : there && rmItem.mutate(there.combo_group_item_id))} /></li>;
        })}</ul>
      </Dialog>
    </>
  );
}
void Input;
