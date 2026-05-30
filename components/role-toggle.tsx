"use client";

import { cn } from "@/lib/utils";

export type Role = "manager" | "reportee";

interface Props {
  value: Role;
  onChange: (role: Role) => void;
}

export function RoleToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex w-full rounded-full bg-muted p-1">
      {(["manager", "reportee"] as const).map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={cn(
            "flex-1 rounded-full px-4 py-2 text-sm font-medium transition capitalize",
            value === role
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          {role}
        </button>
      ))}
    </div>
  );
}
