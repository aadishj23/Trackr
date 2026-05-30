import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeCls =
    size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return <Loader2 className={cn("animate-spin", sizeCls, className)} aria-hidden="true" />;
}

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      <span className="text-sm">{label ?? "Loading…"}</span>
    </div>
  );
}
