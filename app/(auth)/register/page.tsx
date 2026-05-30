"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULES, isPasswordStrong } from "@/lib/password";

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

type UsernameState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "invalid"; message: string }
  | { status: "taken" }
  | { status: "ok" };

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>({ status: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // Debounced username availability check
  useEffect(() => {
    const u = form.username.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (u.length === 0) {
      setUsernameState({ status: "idle" });
      return;
    }
    if (u.length < 3 || u.length > 32) {
      setUsernameState({ status: "invalid", message: "3–32 characters" });
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setUsernameState({ status: "invalid", message: "Only letters, numbers, . _ -" });
      return;
    }
    setUsernameState({ status: "checking" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/availability?username=${encodeURIComponent(u)}`);
        const data = await res.json();
        if (data.available) setUsernameState({ status: "ok" });
        else if (data.reason === "invalid") setUsernameState({ status: "invalid", message: "Invalid username" });
        else setUsernameState({ status: "taken" });
      } catch {
        setUsernameState({ status: "idle" });
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.username]);

  const passwordsMatch = form.confirmPassword.length === 0 || form.password === form.confirmPassword;
  const passwordStrong = isPasswordStrong(form.password);

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 0 &&
      form.email.length > 0 &&
      usernameState.status === "ok" &&
      passwordStrong &&
      form.confirmPassword.length > 0 &&
      passwordsMatch &&
      !loading
    );
  }, [form, usernameState, passwordStrong, passwordsMatch, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }
    if (!passwordStrong) {
      setError("Password does not meet all requirements");
      return;
    }
    if (usernameState.status !== "ok") {
      setError("Pick an available username");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
      setLoading(false);
      return;
    }
    const signin = await signIn("credentials", {
      identifier: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (!signin || signin.error) {
      router.push("/login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Create account</h1>
        <p className="text-sm text-muted-foreground">Join Trackr in seconds</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Your full name"
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <Input
              id="username"
              autoComplete="username"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="Pick a handle"
              required
              className="pr-10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {usernameState.status === "checking" && <Loader2 className="h-4 w-4 animate-spin" />}
              {usernameState.status === "ok" && <Check className="h-4 w-4 text-green-600" />}
              {(usernameState.status === "taken" || usernameState.status === "invalid") && (
                <X className="h-4 w-4 text-destructive" />
              )}
            </div>
          </div>
          <UsernameMessage state={usernameState} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="At least 8 characters"
            required
          />
          {form.password.length > 0 && (
            <ul className="space-y-1 pt-1">
              {PASSWORD_RULES.map((r) => {
                const passed = r.test(form.password);
                return (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 text-xs ${
                      passed ? "text-green-700" : "text-muted-foreground"
                    }`}
                  >
                    {passed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {r.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
            placeholder="Re-enter your password"
            required
          />
          {!passwordsMatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={!canSubmit} loading={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function UsernameMessage({ state }: { state: UsernameState }) {
  if (state.status === "ok") return <p className="text-xs text-green-700">Available</p>;
  if (state.status === "taken") return <p className="text-xs text-destructive">Username is taken</p>;
  if (state.status === "invalid") return <p className="text-xs text-destructive">{state.message}</p>;
  if (state.status === "checking") return <p className="text-xs text-muted-foreground">Checking…</p>;
  return null;
}
