"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  inputClassName,
  id,
  onFocus,
  onBlur,
  size = "default",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  size?: "default" | "compact";
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 shrink-0",
          size === "compact" ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4"
        )}
        aria-hidden
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "pro-search-field",
          size === "compact" && "py-1.5 text-sm",
          inputClassName
        )}
      />
    </div>
  );
}
