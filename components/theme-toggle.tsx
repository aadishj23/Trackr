"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "system" as const, icon: Monitor, label: "System" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
  ];
  return (
    <div className={cn("inline-flex rounded-full bg-muted p-1", className)}>
      {options.map((o) => {
        const Icon = o.icon;
        const sel = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center transition",
              sel ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={o.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
