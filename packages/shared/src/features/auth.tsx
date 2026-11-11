import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import { authApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthProvider";
import { Button, Dialog, Loading } from "../ui/primitives";
import { FormFields, validateFields, type FieldDef } from "../ui/FormDialog";
import { Logo } from "../layout/Logo";
import { env } from "../lib/env";

function AuthFrame({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo portal={env.APP_NAME} />
        <div className="max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight text-white">Every call answered, in the caller's language.</p>
          <p className="mt-4 text-white/60">Your AI receptionist takes orders, books tables and answers questions around the clock. This portal is where you tune what it says.</p>
        </div>
        <div className="flex items-end gap-1.5" aria-hidden>
          {Array.from({ length: 48 }, (_, i) => <span key={i} className="w-1.5 rounded-full bg-white/15" style={{ height: 8 + Math.abs(Math.sin(i * 0.55) * 46) + (i % 7) * 2 }} />)}
        </div>
        {aside}
      </div>
      <div className="flex items-center justify-center bg-paper px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo dark portal={env.APP_NAME} /></div>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function useForm<V extends Record<string, any>>(fields: FieldDef<V>[], initial: V) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  const run = async (fn: (v: V) => Promise<void>) => {
    const e = validateFields(fields, values); setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true); setServerError(undefined);
    try { await fn(values); } catch (err) { setServerError(err instanceof Error ? err.message : "Something went wrong."); } finally { setPending(false); }
  };
  return { values, setValues, errors, serverError, pending, run };
}
const ServerError = ({ msg }: { msg?: string }) => msg ? <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{msg}</p> : null;

const loginFields: FieldDef<{ email: string; password: string }>[] = [
  { name: "email", label: "Email", type: "email", required: true, placeholder: "you@business.com" },
  { name: "password", label: "Password", type: "password", required: true, placeholder: "Enter your password" },
];
type Signup = { first_name: string; last_name: string; email: string; business_name: string; phone: string; password: string; confirm: string };
const signupFields: FieldDef<Signup>[] = [
  { name: "first_name", label: "First name", required: true, half: true, placeholder: "John" },
  { name: "last_name", label: "Last name", required: true, half: true, placeholder: "Smith" },
  { name: "email", label: "Email", type: "email", required: true, placeholder: "admin@business.com" },
  { name: "business_name", label: "Business name", required: true },
  { name: "phone", label: "Admin phone", type: "tel", required: true, placeholder: "+1 (555) 123-4567" },
  { name: "password", label: "Password", type: "password", required: true, placeholder: "At least 8 characters", validate: (v) => (String(v).length < 8 ? "Use at least 8 characters." : undefined) },
  { name: "confirm", label: "Confirm password", type: "password", required: true, validate: (v, all) => (v !== all.password ? "Passwords don't match." : undefined) },
];

export function LoginPage({ allowSignup = true, home = "/" }: { allowSignup?: boolean; home?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [params] = useSearchParams();
  const { signIn, status } = useAuth();
  const nav = useNavigate();
  const next = params.get("next") || home;
  const login = useForm(loginFields, { email: env.USE_MOCKS ? "admin@polydial.com" : "", password: env.USE_MOCKS ? "demo-password" : "" });
  const signup = useForm(signupFields, { first_name: "", last_name: "", email: "", business_name: "", phone: "", password: "", confirm: "" });
  const [forgot, setForgot] = useState(false);
  const [sentTo, setSentTo] = useState<string>();
  useEffect(() => { if (status === "authed") nav(next, { replace: true }); }, [status, next, nav]);

  if (mode === "up") return (
    <AuthFrame title="Create your account" subtitle="Start with a free trial. You'll pick a phone number after verifying your email.">
      <form noValidate onSubmit={(e) => { e.preventDefault(); signup.run(async (v) => { await authApi.signup(v); setSentTo(v.email); }); }}>
        <ServerError msg={signup.serverError} />
        <FormFields fields={signupFields} values={signup.values} setValues={signup.setValues} errors={signup.errors} />
        <Button className="mt-6 w-full" loading={signup.pending} type="submit">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">Already have an account? <button className="font-medium text-signal hover:underline" onClick={() => setMode("in")}>Sign in</button></p>
      <VerificationSent email={sentTo} onClose={() => { setSentTo(undefined); setMode("in"); }} />
    </AuthFrame>
  );
  return (
    <AuthFrame title="Sign in" subtitle="Manage your AI receptionist, calls and menu.">
      <form noValidate onSubmit={(e) => { e.preventDefault(); login.run(async (v) => signIn(await authApi.login(v.email, v.password))); }}>
        <ServerError msg={login.serverError} />
        <FormFields fields={loginFields} values={login.values} setValues={login.setValues} errors={login.errors} />
        <div className="mt-2 text-right"><button type="button" className="text-sm text-signal hover:underline" onClick={() => setForgot(true)}>Forgot password?</button></div>
        <Button className="mt-5 w-full" loading={login.pending} type="submit">Sign in</Button>
      </form>
      {env.USE_MOCKS && <p className="mt-4 rounded-md bg-live/10 px-3 py-2 text-xs text-[#8a5a0f]">Demo mode: any email with a password of 8+ characters signs you in.</p>}
      {allowSignup && <p className="mt-6 text-center text-sm text-ink-soft">New to PolyDial? <button className="font-medium text-signal hover:underline" onClick={() => setMode("up")}>Create an account</button></p>}
      <ForgotPasswordDialog open={forgot} onClose={() => setForgot(false)} />
    </AuthFrame>
  );
}

function VerificationSent({ email, onClose }: { email?: string; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  return (
    <Dialog open={!!email} onClose={onClose} title="Check your inbox" size="sm"
      footer={<><Button variant="secondary" loading={state === "sending"} onClick={async () => { setState("sending"); await authApi.resendVerification(email!); setState("sent"); }}>{state === "sent" ? "Sent again" : "Resend email"}</Button><Button onClick={onClose}>Go to sign in</Button></>}>
      <div className="flex gap-3 text-sm text-ink-soft"><MailCheck className="h-6 w-6 shrink-0 text-signal" />We sent a verification link to <b className="text-ink">{email}</b>. Open it to activate your account.</div>
    </Dialog>
  );
}

function ForgotPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fields: FieldDef<{ email: string }>[] = [{ name: "email", label: "Email address", type: "email", required: true, placeholder: "Enter your email" }];
  const f = useForm(fields, { email: "" });
  const [done, setDone] = useState<string>();
  useEffect(() => { if (open) setDone(undefined); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Reset password" size="sm"
      footer={done ? <Button onClick={onClose}>Done</Button> : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={f.pending} onClick={() => f.run(async (v) => setDone((await authApi.forgotPassword(v.email)).message))}>Send reset link</Button></>}>
      {done ? <p className="text-sm text-ink-soft">{done}</p> : <><ServerError msg={f.serverError} /><FormFields fields={fields} values={f.values} setValues={f.setValues} errors={f.errors} /></>}
    </Dialog>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  type V = { password: string; confirm: string };
  const fields: FieldDef<V>[] = [
    { name: "password", label: "New password", type: "password", required: true, validate: (v) => (String(v).length < 8 ? "Use at least 8 characters." : undefined) },
    { name: "confirm", label: "Confirm password", type: "password", required: true, validate: (v, a) => (v !== a.password ? "Passwords don't match." : undefined) },
  ];
  const f = useForm(fields, { password: "", confirm: "" });
  const [done, setDone] = useState(false);
  return (
    <AuthFrame title={done ? "Password updated" : "Choose a new password"}>
      {!token ? <p className="text-sm text-ink-soft">This reset link is missing its token. Request a new one from the sign-in page.</p>
        : done ? <p className="text-sm text-ink-soft">You can sign in with your new password now.</p>
        : <form noValidate onSubmit={(e) => { e.preventDefault(); f.run(async (v) => { await authApi.resetPassword(token, v.password); setDone(true); }); }}>
            <ServerError msg={f.serverError} />
            <FormFields fields={fields} values={f.values} setValues={f.setValues} errors={f.errors} />
            <Button className="mt-6 w-full" loading={f.pending} type="submit">Reset password</Button>
          </form>}
      <Link to="/login" className="mt-6 block text-center text-sm text-signal hover:underline">Back to sign in</Link>
    </AuthFrame>
  );
}

function StatusPage({ run, okTitle, okBody, failTitle }: { run: () => Promise<unknown>; okTitle: string; okBody: string; failTitle: string }) {
  const [state, setState] = useState<"busy" | "ok" | "fail">("busy");
  const [msg, setMsg] = useState("");
  useEffect(() => { run().then(() => setState("ok")).catch((e) => { setMsg(e.message); setState("fail"); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthFrame title={state === "busy" ? "One moment…" : state === "ok" ? okTitle : failTitle}>
      {state === "busy" ? <Loading /> : (
        <div className="flex gap-3 text-sm text-ink-soft">
          {state === "ok" ? <CheckCircle2 className="h-6 w-6 shrink-0 text-signal" /> : <XCircle className="h-6 w-6 shrink-0 text-danger" />}
          <p>{state === "ok" ? okBody : msg}</p>
        </div>
      )}
      {state !== "busy" && <Link to="/login" className="mt-8 inline-block"><Button variant={state === "ok" ? "primary" : "secondary"}>Go to sign in</Button></Link>}
    </AuthFrame>
  );
}

export function VerifyEmailPage() {
  const [p] = useSearchParams();
  return <StatusPage run={() => authApi.verifyEmail(p.get("token") ?? "")} okTitle="Email verified" okBody="Your account is active. Sign in to continue setup." failTitle="We couldn't verify your email" />;
}

export function AuthCallbackPage({ home = "/" }: { home?: string }) {
  const { provider = "" } = useParams();
  const [p] = useSearchParams();
  const { signIn } = useAuth();
  const nav = useNavigate();
  return <StatusPage run={async () => { signIn(await authApi.oauthCallback(provider, p.get("code") ?? "", p.get("state") ?? undefined)); nav(home, { replace: true }); }}
    okTitle="Signed in" okBody="Redirecting…" failTitle={`Couldn't sign in with ${provider}`} />;
}

export function CloverLoginPage({ home = "/" }: { home?: string }) {
  const [p] = useSearchParams();
  const { signIn } = useAuth();
  const nav = useNavigate();
  return <StatusPage run={async () => { signIn(await authApi.cloverLogin(p.get("token") ?? p.get("code") ?? "")); nav(home, { replace: true }); }}
    okTitle="Connected to Clover" okBody="Redirecting to your menu…" failTitle="Clover sign-in failed" />;
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-display text-6xl font-semibold text-ink/15">404</p>
      <p className="mt-2 font-display text-xl font-semibold text-ink">This page doesn't exist</p>
      <p className="mt-1 text-sm text-ink-soft">Check the address, or head back to the start.</p>
      <Link to="/" className="mt-6"><Button>Go to start</Button></Link>
    </div>
  );
}
