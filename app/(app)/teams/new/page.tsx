"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string; name: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create team");
      return;
    }
    const data = await res.json();
    setCreated(data);
  }

  if (created) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-success/10 text-success grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold">{created.name} is live</h1>
          <p className="text-sm text-muted-foreground">
            Share this code with your reportees to invite them.
          </p>
        </div>
        <Card className="p-6 text-center bg-gradient-to-br from-primary/5 to-card">
          <p className="text-xs text-muted-foreground">Team code</p>
          <p className="text-4xl font-mono font-bold tracking-[0.3em] mt-2 mb-3">{created.code}</p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(created.code);
              } catch {}
            }}
            className="text-xs text-primary hover:underline"
          >
            Copy code
          </button>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => router.push("/dashboard")}>
            Dashboard
          </Button>
          <Button className="flex-1" onClick={() => router.push(`/teams/${created.id}`)}>
            Open team
          </Button>
        </div>
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
          <Users className="h-4 w-4" />
        </div>
        <h1 className="text-2xl font-bold">Create a team</h1>
        <p className="text-sm text-muted-foreground">
          You'll get a 6-digit code to share with your reportees.
        </p>
      </div>
      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team name</Label>
            <Input
              id="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team name"
              required
              minLength={2}
              maxLength={60}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading || name.trim().length < 2}>
            {loading ? "Creating…" : "Create team"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
