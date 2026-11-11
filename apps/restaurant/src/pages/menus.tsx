import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, Search, Utensils, X } from "lucide-react";
import {
  availabilityApi, Badge, Button, Card, Checkbox, ConfirmDialog, DAYS, Dialog, EmptyState, Field, FormDialog, hhmm, Input, Loading, menusApi, money, PageHeader, sectionsApi, Select, Switch,
  useAction, cn, type Availability, type BusinessHours, type FieldDef, type ID, type Menu, type MenuSection, type RestaurantItem,
} from "@polydial/shared";
import { useCatalog } from "./catalog";
import { ItemEditDialog } from "./items";

const menuFields: FieldDef<any>[] = [
  { name: "name", label: "Menu name", required: true, placeholder: "e.g. Lunch, Weekend brunch" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "is_active", label: "Active", type: "switch", description: "Inactive menus are hidden from callers." },
];
const sectionFields: FieldDef<any>[] = [
  { name: "name", label: "Section name", required: true, placeholder: "e.g. Starters" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "display_order", label: "Display order", type: "number", min: 1, required: true, hint: "Lower numbers are read to callers first." },
];

function useMenus() {
  const menus = useQuery({ queryKey: ["menus"], queryFn: () => menusApi.list() });
  const avail = useQuery({ queryKey: ["availabilities"], queryFn: () => availabilityApi.list() });
  return { menus: menus.data ?? [], availabilities: avail.data ?? [], loading: menus.isLoading || avail.isLoading };
}
function summarize(a: Availability) {
  const open = a.details.filter((d) => !d.is_closed);
  if (!open.length) return "Closed all week";
  const same = open.every((d) => d.open_time === open[0].open_time && d.close_time === open[0].close_time);
  const days = open.length === 7 ? "Every day" : open.map((d) => DAYS[d.day_of_week].slice(0, 3)).join(", ");
  return same ? `${days}, ${hhmm(open[0].open_time)}–${hhmm(open[0].close_time)}` : `${days}, varied hours`;
}

// ---------- Availability schedule editor ----------
function AvailabilityDialog({ value, onClose }: { value: Availability | "new" | null; onClose: () => void }) {
  const blank: BusinessHours[] = DAYS.map((_, d) => ({ day_of_week: d, is_closed: d === 0, open_time: "11:00", close_time: "21:00" }));
  const [name, setName] = useState("");
  const [rows, setRows] = useState<BusinessHours[]>(blank);
  const [err, setErr] = useState<string>();
  useEffect(() => { if (value) { setName(value === "new" ? "" : value.name); setRows(value === "new" ? blank : value.details.map((d) => ({ ...d }))); setErr(undefined); } }, [value]); // eslint-disable-line
  const save = useAction((b: Partial<Availability>) => (value && value !== "new" ? availabilityApi.update(value.availability_id, b) : availabilityApi.create(b)), { invalidate: [["availabilities"]], success: "Availability saved" });
  const set = (i: number, p: Partial<BusinessHours>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const submit = () => {
    if (!name.trim()) return setErr("Give this schedule a name.");
    const bad = rows.find((r) => !r.is_closed && (!r.open_time || !r.close_time || r.open_time >= r.close_time));
    if (bad) return setErr(`${DAYS[bad.day_of_week]}: closing time must be after opening time.`);
    save.mutate({ name: name.trim(), details: rows }, { onSuccess: onClose });
  };
  return (
    <Dialog open={!!value} onClose={onClose} size="lg" title={value === "new" ? "Create availability" : "Edit availability"} description="When the menus using this schedule can be ordered from."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={submit}>Save availability</Button></>}>
      <Field label="Name" htmlFor="av-name" required><Input id="av-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lunch hours" /></Field>
      <table className="mt-4 w-full text-sm"><thead><tr className="text-left text-xs text-ink-mute"><th className="pb-2 font-medium">Day</th><th className="pb-2 font-medium">Closed</th><th className="pb-2 font-medium">Opens</th><th className="pb-2 font-medium">Closes</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.day_of_week} className="border-t border-line">
            <td className="py-2 font-medium">{DAYS[r.day_of_week]}</td>
            <td><Switch checked={r.is_closed} onChange={(v) => set(i, { is_closed: v })} /></td>
            <td><Input type="time" aria-label={`${DAYS[r.day_of_week]} opens`} disabled={r.is_closed} value={r.open_time ?? ""} onChange={(e) => set(i, { open_time: e.target.value })} className="w-32" /></td>
            <td><Input type="time" aria-label={`${DAYS[r.day_of_week]} closes`} disabled={r.is_closed} value={r.close_time ?? ""} onChange={(e) => set(i, { close_time: e.target.value })} className="w-32" /></td>
          </tr>))}</tbody></table>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
    </Dialog>
  );
}

// ---------- Add items to a section ----------
function AddItemsDialog({ section, onClose }: { section: MenuSection | null; onClose: () => void }) {
  const { items } = useCatalog();
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<ID[]>([]);
  useEffect(() => { if (section) { setIds(section.item_ids); setQ(""); } }, [section]);
  const save = useAction((v: ID[]) => sectionsApi.update(section!.menu_section_id, { item_ids: v }), { invalidate: [["sections"]], success: "Section items updated" });
  const shown = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={!!section} onClose={onClose} title={`Add items to ${section?.name ?? ""}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(ids, { onSuccess: onClose })}>Save ({ids.length})</Button></>}>
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-mute" /><Input className="pl-9" placeholder="Search items" aria-label="Search items" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!shown.length ? <p className="py-6 text-center text-sm text-ink-mute">No items match "{q}". <Link className="text-signal underline" to="/create-item-wizard">Create one</Link></p> : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">{shown.map((i) => (
          <li key={i.item_id} className="py-1"><Checkbox checked={ids.includes(i.item_id)} onChange={(on) => setIds(on ? [...ids, i.item_id] : ids.filter((x) => x !== i.item_id))}
            label={<span className="flex w-full justify-between gap-4"><span>{i.name}{!i.is_active && <span className="ml-2 text-xs text-[#9A6A10]">sold out</span>}</span><span className="tabular-nums text-ink-mute">{money(i.base_price)}</span></span>} /></li>))}</ul>)}
    </Dialog>
  );
}

// ---------- Sections of one menu ----------
function SectionsBoard({ menu, readOnly }: { menu: Menu; readOnly?: boolean }) {
  const { items } = useCatalog();
  const sections = useQuery({ queryKey: ["sections", menu.menu_id], queryFn: () => sectionsApi.list(menu.menu_id) });
  const [edit, setEdit] = useState<MenuSection | "new" | null>(null);
  const [del, setDel] = useState<MenuSection | null>(null);
  const [adding, setAdding] = useState<MenuSection | null>(null);
  const [itemEdit, setItemEdit] = useState<RestaurantItem | null>(null);
  const inv = [["sections"]];
  const save = useAction((v: Partial<MenuSection>) => (edit && edit !== "new" ? sectionsApi.update(edit.menu_section_id, v) : sectionsApi.create(menu.menu_id, v)), { invalidate: inv, success: "Section saved", silentError: true });
  const remove = useAction((s: MenuSection) => sectionsApi.remove(s.menu_section_id), { invalidate: inv, success: "Section deleted" });
  const removeItem = useAction((v: { s: MenuSection; id: ID }) => sectionsApi.update(v.s.menu_section_id, { item_ids: v.s.item_ids.filter((x) => x !== v.id) }), { invalidate: inv, success: "Item removed from section" });
  const byId = useMemo(() => new Map(items.map((i) => [i.item_id, i])), [items]);
  if (sections.isLoading) return <Loading />;
  const list = sections.data ?? [];
  return (
    <>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Sections</h2>
        {!readOnly && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Add section</Button>}</div>
      {!list.length ? <EmptyState icon={<Utensils />} title="This menu has no sections" body="Sections group items the way callers hear them — starters, mains, drinks." action={!readOnly && <Button onClick={() => setEdit("new")}>Add first section</Button>} /> : (
        <div className="space-y-4">{list.map((s) => (
          <Card key={s.menu_section_id} title={<span className="flex items-center gap-2"><span className="tabular-nums text-ink-mute">{s.display_order}.</span>{s.name}</span>} description={s.description ?? undefined}
            actions={!readOnly && <><Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(s)}>Add items</Button><Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setDel(s)}>Delete</Button></>}>
            {!s.item_ids.length ? <p className="text-sm text-ink-mute">No items in this section yet.</p> : (
              <ul className="divide-y divide-line">{s.item_ids.map((id) => byId.get(id)).filter(Boolean).map((i) => (
                <li key={i!.item_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className={cn(!i!.is_active && "text-ink-mute line-through")}>{i!.name}</span>
                  <span className="flex items-center gap-1"><span className="mr-2 tabular-nums">{money(i!.base_price)}</span>
                    {!readOnly && <><Button size="sm" variant="ghost" onClick={() => setItemEdit(i!)}>Edit item</Button><Button size="sm" variant="ghost" aria-label={`Remove ${i!.name}`} onClick={() => removeItem.mutate({ s, id: i!.item_id })}><X className="h-4 w-4" /></Button></>}</span>
                </li>))}</ul>)}
          </Card>))}</div>)}
      <FormDialog open={!!edit} onClose={() => setEdit(null)} size="sm" title={edit === "new" ? "Add section" : "Edit section"} fields={sectionFields} submitLabel="Save section"
        initial={edit && edit !== "new" ? edit : { name: "", description: "", display_order: list.length + 1 }} onSubmit={(v) => save.mutateAsync(v)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete section" loading={remove.isPending} body={<>Delete <b>{del?.name}</b>? Its items stay in your catalog.</>} onConfirm={() => remove.mutate(del!, { onSuccess: () => setDel(null) })} />
      <AddItemsDialog section={adding} onClose={() => setAdding(null)} />
      <ItemEditDialog item={itemEdit} onClose={() => setItemEdit(null)} />
    </>
  );
}

// ---------- Availability panel for one menu ----------
function AvailabilityPanel({ menu, availabilities, manage }: { menu: Menu; availabilities: Availability[]; manage?: boolean }) {
  const [edit, setEdit] = useState<Availability | "new" | null>(null);
  const [del, setDel] = useState<Availability | null>(null);
  const assign = useAction((ids: ID[]) => menusApi.setAvailabilities(menu.menu_id, ids), { invalidate: [["menus"]], success: "Menu availability updated" });
  const remove = useAction((a: Availability) => availabilityApi.remove(a.availability_id), { invalidate: [["availabilities"], ["menus"]], success: "Availability deleted" });
  return (
    <Card title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-signal" />Availability</span>} description="A menu is orderable whenever any of its schedules is open."
      actions={manage && <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Create</Button>}>
      {!availabilities.length ? <p className="text-sm text-ink-mute">No schedules yet. Without one, the menu follows your business hours.</p> : (
        <ul className="space-y-2">{availabilities.map((a) => {
          const on = menu.availability_ids.includes(a.availability_id);
          return (
            <li key={a.availability_id} className="flex items-start justify-between gap-2">
              {manage ? <Checkbox checked={on} onChange={(v) => assign.mutate(v ? [...menu.availability_ids, a.availability_id] : menu.availability_ids.filter((x) => x !== a.availability_id))}
                label={<span><span className="font-medium">{a.name}</span><span className="block text-xs text-ink-mute">{summarize(a)}</span></span>} />
                : on && <span className="text-sm"><span className="font-medium">{a.name}</span><span className="block text-xs text-ink-mute">{summarize(a)}</span></span>}
              {manage && <span className="flex shrink-0"><Button size="sm" variant="ghost" onClick={() => setEdit(a)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setDel(a)}>Delete</Button></span>}
            </li>);
        })}</ul>)}
      {!manage && !menu.availability_ids.length && availabilities.length > 0 && <p className="text-sm text-ink-mute">Follows your business hours.</p>}
      <AvailabilityDialog value={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete availability" loading={remove.isPending} body={<>Delete <b>{del?.name}</b>? Menus using it fall back to business hours.</>} onConfirm={() => remove.mutate(del!, { onSuccess: () => setDel(null) })} />
    </Card>
  );
}

function useMenuSelection(menus: Menu[]) {
  const [sel, setSel] = useState<string>("");
  useEffect(() => { if (menus.length && !menus.some((m) => String(m.menu_id) === sel)) setSel(String(menus[0].menu_id)); }, [menus, sel]);
  return [menus.find((m) => String(m.menu_id) === sel), setSel, sel] as const;
}

// ---------- /restaurant/overview ----------
export function MenuOverviewPage() {
  const { menus, availabilities, loading } = useMenus();
  const [menu, setSel, sel] = useMenuSelection(menus);
  const [edit, setEdit] = useState<Menu | "new" | null>(null);
  const save = useAction((v: Partial<Menu>) => (edit && edit !== "new" ? menusApi.update(edit.menu_id, v) : menusApi.create(v)), { invalidate: [["menus"]], success: "Menu saved", silentError: true });
  return (
    <>
      <PageHeader title="Menu overview" description="What callers can order right now, as the AI reads it."
        actions={<><Button variant="secondary" onClick={() => setEdit("new")} icon={<Plus className="h-4 w-4" />}>Add menu</Button><Link to="/menu-management"><Button>Manage menus</Button></Link></>} />
      {loading ? <Loading /> : !menus.length ? <EmptyState icon={<Utensils />} title="No menus yet" body="Create a menu so the AI can take orders." action={<Button onClick={() => setEdit("new")}>Create your first menu</Button>} /> : (
        <>
          <Card className="mb-5"><div className="flex flex-wrap items-end gap-4">
            <Field label="Menu" htmlFor="ov-menu"><Select id="ov-menu" className="sm:w-72" value={sel} onChange={(e) => setSel(e.target.value)}>{menus.map((m) => <option key={m.menu_id} value={m.menu_id}>{m.name}{m.is_active ? "" : " (inactive)"}</option>)}</Select></Field>
            {menu && <><Badge tone={menu.is_active ? "good" : "neutral"}>{menu.is_active ? "Active" : "Inactive"}</Badge><Button variant="ghost" size="sm" onClick={() => setEdit(menu)}>Edit menu</Button></>}
          </div>{menu?.description && <p className="mt-3 text-sm text-ink-soft">{menu.description}</p>}</Card>
          {menu && <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div><SectionsBoard menu={menu} readOnly /></div><div><AvailabilityPanel menu={menu} availabilities={availabilities} /></div></div>}
        </>
      )}
      <FormDialog open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Add menu" : "Edit menu"} fields={menuFields} submitLabel="Save menu"
        initial={edit && edit !== "new" ? { ...edit, description: edit.description ?? "" } : { name: "", description: "", is_active: true }} onSubmit={(v) => save.mutateAsync(v)} />
    </>
  );
}

// ---------- /menu-management ----------
export function MenuManagementPage() {
  const { menus, availabilities, loading } = useMenus();
  const [menu, setSel, sel] = useMenuSelection(menus);
  const [edit, setEdit] = useState<Menu | "new" | null>(null);
  const [del, setDel] = useState<Menu | null>(null);
  const save = useAction((v: Partial<Menu>) => (edit && edit !== "new" ? menusApi.update(edit.menu_id, v) : menusApi.create(v)), { invalidate: [["menus"]], success: "Menu saved", silentError: true });
  const remove = useAction((m: Menu) => menusApi.remove(m.menu_id), { invalidate: [["menus"], ["sections"]], success: "Menu deleted" });
  const dialogs = (
    <>
      <FormDialog open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Create menu" : "Edit menu"} fields={menuFields} submitLabel={edit === "new" ? "Create menu" : "Save menu"}
        initial={edit && edit !== "new" ? { ...edit, description: edit.description ?? "" } : { name: "", description: "", is_active: true }}
        onSubmit={async (v) => { const r = await save.mutateAsync(v); setSel(String(r.menu_id)); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Delete menu" loading={remove.isPending} body={<>Delete <b>{del?.name}</b> and all its sections? Items stay in your catalog.</>} onConfirm={() => remove.mutate(del!, { onSuccess: () => setDel(null) })} />
    </>
  );
  if (loading) return <Loading />;
  if (!menus.length) return (
    <>
      <div className="mx-auto max-w-xl py-16 text-center">
        <Utensils className="mx-auto h-10 w-10 text-signal" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Welcome to menu management</h1>
        <p className="mt-2 text-ink-soft">Build the menu your AI assistant reads to callers. Start with one menu, add sections, then drop in items.</p>
        <Button className="mt-6" onClick={() => setEdit("new")} icon={<Plus className="h-4 w-4" />}>Create your first menu</Button>
      </div>{dialogs}
    </>
  );
  return (
    <>
      <PageHeader title="Menu management" description="Menus, their sections and items, and when each menu can be ordered from." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit("new")}>Create menu</Button>} />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Menus">
        {menus.map((m) => (
          <button key={m.menu_id} role="tab" aria-selected={String(m.menu_id) === sel} onClick={() => setSel(String(m.menu_id))}
            className={cn("rounded-lg border px-4 py-2 text-left text-sm", String(m.menu_id) === sel ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30")}>
            <span className="font-medium">{m.name}</span>{!m.is_active && <span className="ml-2 text-xs opacity-70">inactive</span>}
          </button>))}
      </div>
      {menu && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div><SectionsBoard menu={menu} /></div>
          <div className="space-y-5">
            <Card title={menu.name} description={menu.description ?? "No description"} actions={<><Button size="sm" variant="ghost" onClick={() => setEdit(menu)}>Edit</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => setDel(menu)}>Delete</Button></>}>
              <Badge tone={menu.is_active ? "good" : "neutral"}>{menu.is_active ? "Active — callers can order" : "Inactive — hidden from callers"}</Badge>
            </Card>
            <AvailabilityPanel menu={menu} availabilities={availabilities} manage />
          </div>
        </div>
      )}
      {dialogs}
    </>
  );
}
