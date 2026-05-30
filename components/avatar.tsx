import { cn } from "@/lib/utils";

const palette = [
  "bg-rose-200 text-rose-900",
  "bg-orange-200 text-orange-900",
  "bg-amber-200 text-amber-900",
  "bg-lime-200 text-lime-900",
  "bg-emerald-200 text-emerald-900",
  "bg-teal-200 text-teal-900",
  "bg-sky-200 text-sky-900",
  "bg-indigo-200 text-indigo-900",
  "bg-violet-200 text-violet-900",
  "bg-fuchsia-200 text-fuchsia-900",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string) {
  const parts = name.replace(/[@_-]/g, " ").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const color = palette[hash(name) % palette.length];
  const sizeCls =
    size === "xs"
      ? "h-5 w-5 text-[9px]"
      : size === "sm"
        ? "h-7 w-7 text-[11px]"
        : size === "lg"
          ? "h-12 w-12 text-base"
          : "h-9 w-9 text-xs";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        sizeCls,
        color,
        className
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 4,
  size = "sm",
}: {
  names: string[];
  max?: number;
  size?: "xs" | "sm" | "md";
}) {
  const visible = names.slice(0, max);
  const rest = names.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} className="ring-2 ring-background" />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background font-semibold",
            size === "xs" ? "h-5 w-5 text-[9px]" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
