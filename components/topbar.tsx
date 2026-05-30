"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "./notification-bell";

export function TopBar({ name, username }: { name: string; username: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur border-b safe-pt">
      <Link href="/dashboard" className="text-lg font-bold">
        Trackr
      </Link>
      <div className="flex items-center gap-2">
        <div className="text-right leading-tight pr-1">
          <p className="text-sm font-medium truncate max-w-[120px]">{name}</p>
          <p className="text-[10px] text-muted-foreground">@{username}</p>
        </div>
        <NotificationBell />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
