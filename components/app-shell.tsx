"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Plus, LogIn, LogOut, Bell, Menu, X, Users, ChevronRight, Sparkles,
} from "lucide-react";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

type SidebarTeam = { id: string; name: string; code?: string; pending?: number };

export function AppShell({
  name,
  username,
  children,
}: {
  name: string;
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [managing, setManaging] = useState<SidebarTeam[]>([]);
  const [joined, setJoined] = useState<SidebarTeam[]>([]);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function refresh() {
    try {
      const [tRes, nRes] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/notifications?count=1", { cache: "no-store" }),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setManaging(
          (d.managing ?? []).map((t: { id: string; name: string; code: string; pendingCount: number }) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            pending: t.pendingCount,
          }))
        );
        setJoined(
          (d.joined ?? []).map((t: { id: string; name: string; code: string }) => ({
            id: t.id,
            name: t.name,
            code: t.code,
          }))
        );
      }
      if (nRes.ok) {
        const d = await nRes.json();
        setUnread(d.unread ?? 0);
      }
    } catch {}
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, []);

  const navItems = (
    <SidebarBody
      pathname={pathname}
      managing={managing}
      joined={joined}
      unread={unread}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="min-h-[100dvh] bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col border-r bg-card/30">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">T</div>
          <p className="text-lg font-bold tracking-tight">Trackr</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
          {navItems}
        </div>
        <UserFooter name={name} username={username} />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r flex flex-col safe-pt">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">T</div>
                <p className="text-lg font-bold tracking-tight">Trackr</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">{navItems}</div>
            <UserFooter name={name} username={username} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-20 bg-background/85 backdrop-blur border-b safe-pt">
          <div className="h-14 px-3 flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-accent text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 font-bold">
              <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm">T</div>
              <span>Trackr</span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/notifications"
                className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center px-1">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center"
                aria-label="Account"
              >
                <Avatar name={name || username || "?"} size="sm" />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 safe-pb">
          <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-4 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarBody({
  pathname,
  managing,
  joined,
  unread,
  onNavigate,
}: {
  pathname: string;
  managing: SidebarTeam[];
  joined: SidebarTeam[];
  unread: number;
  onNavigate: () => void;
}) {
  return (
    <nav className="space-y-5 py-3">
      <div className="space-y-0.5">
        <NavLink href="/dashboard" icon={<Home className="h-4 w-4" />} label="Home" active={pathname === "/dashboard"} onClick={onNavigate} />
        <NavLink
          href="/notifications"
          icon={<Bell className="h-4 w-4" />}
          label="Notifications"
          badge={unread > 0 ? (unread > 9 ? "9+" : String(unread)) : undefined}
          active={pathname.startsWith("/notifications")}
          onClick={onNavigate}
        />
      </div>

      <Section
        title="Managing"
        actionHref="/teams/new"
        actionLabel="New"
        actionIcon={<Plus className="h-3 w-3" />}
      >
        {managing.length === 0 ? (
          <EmptyHint text="You haven't created any teams" />
        ) : (
          managing.map((t) => (
            <TeamLink
              key={t.id}
              team={t}
              active={pathname === `/teams/${t.id}`}
              showPending={!!t.pending && t.pending > 0}
              pendingCount={t.pending}
              onClick={onNavigate}
            />
          ))
        )}
      </Section>

      <Section
        title="Joined"
        actionHref="/teams/join"
        actionLabel="Join"
        actionIcon={<LogIn className="h-3 w-3" />}
      >
        {joined.length === 0 ? (
          <EmptyHint text="No teams joined yet" />
        ) : (
          joined.map((t) => (
            <TeamLink key={t.id} team={t} active={pathname === `/teams/${t.id}`} onClick={onNavigate} />
          ))
        )}
      </Section>

      <div className="rounded-xl border bg-muted/30 p-3 mt-2 text-xs text-muted-foreground flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
        <span>Tip: Manager defaults can be tweaked from inside each team.</span>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/70 hover:bg-accent hover:text-foreground"
      )}
    >
      <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 min-w-[18px] h-[18px]">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Section({
  title,
  actionHref,
  actionLabel,
  actionIcon,
  children,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
        >
          {actionIcon}
          {actionLabel}
        </Link>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-3 py-1.5 text-xs text-muted-foreground">{text}</p>;
}

function TeamLink({
  team,
  active,
  showPending,
  pendingCount,
  onClick,
}: {
  team: SidebarTeam;
  active: boolean;
  showPending?: boolean;
  pendingCount?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={`/teams/${team.id}`}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/70 hover:bg-accent hover:text-foreground"
      )}
    >
      <Users className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
      <span className="flex-1 truncate">{team.name}</span>
      {showPending && pendingCount ? (
        <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center">
          {pendingCount}
        </span>
      ) : (
        <ChevronRight className="h-3 w-3 opacity-40" />
      )}
    </Link>
  );
}

function UserFooter({ name, username }: { name: string; username: string }) {
  return (
    <div className="border-t p-3 space-y-2">
      <ThemeToggle className="w-full justify-between" />
      <div className="flex items-center gap-2 px-2 pt-1">
        <Avatar name={name || username || "?"} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name || "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">@{username}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
