"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BellOff, Bell, Check } from "lucide-react";
import { Card } from "@/components/ui/card";

type Notif = {
  id: string;
  type: string;
  text: string;
  url: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[] | null>(null);

  async function load() {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    load();
  }

  useEffect(() => {
    load();
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/dashboard"
        className="md:hidden inline-flex items-center text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
      </Link>

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-xs text-muted-foreground">Last 50 events</p>
          </div>
        </div>
        {items && items.length > 0 && (
          <button
            onClick={markAll}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> Mark all read
          </button>
        )}
      </header>

      {items === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/40 p-10 text-center">
          <BellOff className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">You're all caught up</p>
          <p className="text-xs text-muted-foreground mt-1">No new activity right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Link key={n.id} href={n.url} className="block">
              <Card
                className={`p-4 transition hover:shadow-sm ${
                  n.read ? "" : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{formatTime(n.createdAt)}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
