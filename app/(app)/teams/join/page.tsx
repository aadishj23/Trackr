"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogIn, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function JoinTeamPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<{ teamName?: string; status: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not join");
      return;
    }
    setSubmitted({ teamName: data.teamName, status: data.status });
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <Clock className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Request sent</h1>
          <p className="text-sm text-muted-foreground">
            {submitted.teamName
              ? `Waiting for the manager of "${submitted.teamName}" to approve you.`
              : "Your request is pending approval."}
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Link
        href="/dashboard"
        className="md:hidden inline-flex items-center text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
      </Link>
      <div className="space-y-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <LogIn className="h-4 w-4" />
        </div>
        <h1 className="text-2xl font-bold">Join a team</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code your manager shared.
        </p>
      </div>
      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Team code</Label>
            <Input
              id="code"
              autoFocus
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="text-center text-2xl tracking-[0.3em] font-mono h-14"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            disabled={code.length !== 6}
          >
            {loading ? "Sending request…" : "Request to join"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
