"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onCheckedChange, id, disabled, className }: CheckboxProps) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "h-5 w-5 shrink-0 rounded border border-input flex items-center justify-center transition",
        checked ? "bg-primary text-primary-foreground border-primary" : "bg-background",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
    </button>
  );
}
