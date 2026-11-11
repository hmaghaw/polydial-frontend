import { useEffect, useState, type ReactNode } from "react";
import { Button, Checkbox, Dialog, Field, Input, Select, Switch, Textarea } from "./primitives";
import { cn } from "../lib/cn";

export type FieldType = "text" | "email" | "tel" | "url" | "password" | "number" | "money" | "textarea" | "select" | "switch" | "time" | "date" | "datetime-local" | "multicheck";
export interface FieldDef<V> {
  name: keyof V & string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string | number; label: string }[];
  min?: number; max?: number; step?: number;
  half?: boolean;
  /** Return an error message, or undefined when valid. */
  validate?: (value: any, all: V) => string | undefined;
  hidden?: (all: V) => boolean;
  description?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateFields<V extends Record<string, any>>(fields: FieldDef<V>[], v: V) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.hidden?.(v)) continue;
    const val = v[f.name];
    const empty = val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
    if (f.required && empty) { errors[f.name] = `${f.label.replace(/\s*\(.*\)$/, "")} is required.`; continue; }
    if (!empty && (f.type === "number" || f.type === "money")) {
      const n = Number(val);
      if (Number.isNaN(n)) errors[f.name] = "Enter a number.";
      else if (f.min !== undefined && n < f.min) errors[f.name] = `Must be at least ${f.min}.`;
      else if (f.max !== undefined && n > f.max) errors[f.name] = `Must be ${f.max} or less.`;
    }
    if (!empty && f.type === "email" && !EMAIL.test(String(val))) errors[f.name] = "Enter a valid email address.";
    if (!empty && f.type === "url" && !/^https?:\/\/\S+$/.test(String(val))) errors[f.name] = "Enter a full URL starting with https://";
    if (!empty && f.type === "tel" && !/^\+?[\d\s().-]{7,}$/.test(String(val))) errors[f.name] = "Enter a valid phone number.";
    const custom = !errors[f.name] && f.validate?.(val, v);
    if (custom) errors[f.name] = custom;
  }
  return errors;
}

/** Coerces string inputs back to numbers for number/money fields. */
function normalize<V extends Record<string, any>>(fields: FieldDef<V>[], v: V): V {
  const out: Record<string, any> = { ...v };
  for (const f of fields) {
    if ((f.type === "number" || f.type === "money") && out[f.name] !== "" && out[f.name] !== null && out[f.name] !== undefined) out[f.name] = Number(out[f.name]);
    if ((f.type === "number" || f.type === "money") && out[f.name] === "") out[f.name] = null;
  }
  return out as V;
}

export function FieldInput<V extends Record<string, any>>({ f, value, onChange, error }: { f: FieldDef<V>; value: any; onChange: (v: any) => void; error?: string }) {
  const id = `f-${f.name}`;
  const common = { id, "aria-invalid": !!error, placeholder: f.placeholder };
  if (f.type === "switch") return <div className="py-1"><Switch checked={!!value} onChange={onChange} label={f.label} description={f.description ?? f.hint} /></div>;
  let control: ReactNode;
  switch (f.type) {
    case "textarea": control = <Textarea {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />; break;
    case "select": control = (
      <Select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">{f.placeholder ?? "Select…"}</option>
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>); break;
    case "multicheck": control = (
      <div className="max-h-48 overflow-y-auto rounded-md border border-line px-3 py-1">
        {f.options?.length ? f.options.map((o) => (
          <Checkbox key={o.value} label={o.label} checked={(value ?? []).includes(o.value)}
            onChange={(c) => onChange(c ? [...(value ?? []), o.value] : (value ?? []).filter((x: unknown) => x !== o.value))} />
        )) : <p className="py-2 text-sm text-ink-mute">Nothing to choose yet.</p>}
      </div>); break;
    case "money": control = (
      <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-mute">$</span>
        <Input {...common} className="pl-7" type="number" inputMode="decimal" step={f.step ?? 0.01} min={f.min} max={f.max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>); break;
    default: control = <Input {...common} type={f.type ?? "text"} step={f.step} min={f.min} max={f.max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Field label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={error}>{control}</Field>;
}

export function FormFields<V extends Record<string, any>>({ fields, values, setValues, errors }: { fields: FieldDef<V>[]; values: V; setValues: (v: V) => void; errors: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {fields.filter((f) => !f.hidden?.(values)).map((f) => (
        <div key={f.name} className={cn(f.half ? "col-span-2 sm:col-span-1" : "col-span-2")}>
          <FieldInput f={f} value={values[f.name]} error={errors[f.name]} onChange={(val) => setValues({ ...values, [f.name]: val })} />
        </div>
      ))}
    </div>
  );
}

export interface FormDialogProps<V extends Record<string, any>> {
  open: boolean; onClose: () => void; title: string; description?: ReactNode;
  fields: FieldDef<V>[]; initial: V; submitLabel: string;
  onSubmit: (v: V) => Promise<unknown> | unknown;
  extra?: ReactNode; size?: "sm" | "md" | "lg";
}
/** Schema-driven create/edit dialog: validation, pending state and server errors handled in one place. */
export function FormDialog<V extends Record<string, any>>({ open, onClose, title, description, fields, initial, submitLabel, onSubmit, extra, size }: FormDialogProps<V>) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  useEffect(() => { if (open) { setValues(initial); setErrors({}); setServerError(undefined); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = validateFields(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true); setServerError(undefined);
    try { await onSubmit(normalize(fields, values)); onClose(); }
    catch (err) { setServerError(err instanceof Error ? err.message : "Couldn't save. Try again."); }
    finally { setPending(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size={size}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={() => submit()}>{submitLabel}</Button></>}>
      <form onSubmit={submit} noValidate>
        {serverError && <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>}
        <FormFields fields={fields} values={values} setValues={setValues} errors={errors} />
        {extra}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
