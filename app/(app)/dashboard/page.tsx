"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, LogIn, Users, ArrowUpRight, Inbox } from "lucide-react";
import { RoleToggle, type Role } from "@/components/role-toggle";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

type ManagedTeam = { id: string; name: string; code: string; memberCount: number; pendingCount: number };
type JoinedTeam = { id: string; name: string; code: string; memberCount: number };

export default function DashboardPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [managing, setManaging] = useState<ManagedTeam[] | null>(null);
  const [joined, setJoined] = useState<JoinedTeam[] | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => {
        const m = d.managing ?? [];
        const j = d.joined ?? [];
        setManaging(m);
        setJoined(j);
        setRole((prev) => prev ?? (m.length > 0 ? "manager" : "reportee"));
      })
      .catch(() => {
        setManaging([]);
        setJoined([]);
        setRole((prev) => prev ?? "reportee");
      });
  }, []);

  const activeRole: Role = role ?? "reportee";

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Switch views to see what you manage or what's been assigned to you.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <RoleToggle value={activeRole} onChange={setRole} />
        {activeRole === "manager" ? (
          <Link
            href="/teams/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Create team
          </Link>
        ) : (
          <Link
            href="/teams/join"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90"
          >
            <LogIn className="h-3.5 w-3.5" /> Join team
          </Link>
        )}
      </div>

      {activeRole === "manager" ? (
        <ManagerView teams={managing} />
      ) : (
        <ReporteeView teams={joined} />
      )}
    </div>
  );
}

function ManagerView({ teams }: { teams: ManagedTeam[] | null }) {
  if (teams === null) return <SkeletonGrid />;
  if (teams.length === 0) {
    return (
      <EmptyState
        title="No teams yet"
        body="Create a team to start assigning tasks to your reportees."
        ctaHref="/teams/new"
        ctaLabel="Create your first team"
      />
    );
  }
  return (
    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((t) => (
        <TeamCard key={t.id} team={t} role="manager" pendingCount={t.pendingCount} />
      ))}
    </div>
  );
}

function ReporteeView({ teams }: { teams: JoinedTeam[] | null }) {
  if (teams === null) return <SkeletonGrid />;
  if (teams.length === 0) {
    return (
      <EmptyState
        title="No teams joined"
        body="Ask your manager for a 6-digit code and join their team."
        ctaHref="/teams/join"
        ctaLabel="Join a team"
      />
    );
  }
  return (
    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((t) => (
        <TeamCard key={t.id} team={t} role="reportee" />
      ))}
    </div>
  );
}

function TeamCard({
  team,
  role,
  pendingCount = 0,
}: {
  team: ManagedTeam | JoinedTeam;
  role: "manager" | "reportee";
  pendingCount?: number;
}) {
  return (
    <Link
      href={`/teams/${team.id}`}
      className="group relative rounded-2xl border bg-card p-5 hover:shadow-md hover:border-primary/30 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {role === "manager" ? "Managing" : "Member"}
          </p>
          <h3 className="text-lg font-semibold truncate">{team.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium h-5 px-1.5 min-w-[20px]">
              {pendingCount} pending
            </span>
          )}
          <Avatar name={team.name} size="md" />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {team.memberCount} members
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-mono tracking-widest text-foreground/70">{team.code}</span>
        </span>
      </div>

      <ArrowUpRight className="absolute top-4 right-4 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition opacity-0 group-hover:opacity-100" />
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-5 w-32 rounded bg-muted" />
          </div>
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/40 p-10 text-center max-w-md mx-auto">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 mb-5">{body}</p>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

// Keep `cn` import alive for tree-shake quirks
void cn;
