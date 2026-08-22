"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BtnSecondary } from "./dashboard-ui";
import { SearchInput } from "./search-input";

export type FilterField =
  | {
      type: "search";
      key: string;
      label?: string;
      placeholder?: string;
      value: string;
      onChange: (v: string) => void;
      className?: string;
    }
  | {
      type: "select";
      key: string;
      label?: string;
      placeholder?: string;
      value: string;
      onChange: (v: string) => void;
      options: Array<{ value: string; label: string }>;
      className?: string;
    }
  | {
      type: "date";
      key: string;
      label?: string;
      value: string;
      onChange: (v: string) => void;
      className?: string;
    };

export function FilterBar({
  fields,
  onClear,
  showClear,
  className,
  collapsible = true,
}: {
  fields: FilterField[];
  onClear?: () => void;
  showClear?: boolean;
  className?: string;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectCls = "pro-input text-sm py-1.5 px-2 w-full sm:w-auto sm:min-w-[130px]";
  const searchField = fields.find((f) => f.type === "search");
  const otherFields = fields.filter((f) => f.type !== "search");
  const activeCount = fields.filter((f) => f.value && f.value !== "").length;
  const canCollapse = collapsible && otherFields.length > 2;

  function renderField(field: FilterField) {
    return (
      <div key={field.key} className={cn("flex flex-col gap-1", field.className)}>
        {field.label && (
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {field.label}
          </label>
        )}
        {field.type === "search" ? (
          <SearchInput
            value={field.value}
            onChange={field.onChange}
            placeholder={field.placeholder || "Search…"}
            className="min-w-0 w-full sm:min-w-[200px] flex-1"
            size="compact"
          />
        ) : field.type === "date" ? (
          <input
            type="date"
            className={selectCls}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          />
        ) : (
          <select
            className={selectCls}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          >
            {field.placeholder && <option value="">{field.placeholder}</option>}
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-3 shadow-sm", className)}>
      <div className="flex flex-wrap gap-x-4 gap-y-3 items-end">
        {searchField && renderField(searchField)}

        {canCollapse ? (
          <>
            <div className="hidden lg:flex flex-wrap gap-x-4 gap-y-3 items-end">
              {otherFields.map(renderField)}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="lg:hidden inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </>
        ) : (
          otherFields.map(renderField)
        )}

        {showClear && onClear && (
          <BtnSecondary onClick={onClear} className="text-xs !inline-flex items-center gap-1 h-[34px]">
            <X className="h-3.5 w-3.5" /> Clear filters
          </BtnSecondary>
        )}
      </div>

      {canCollapse && expanded && (
        <div className="lg:hidden flex flex-wrap gap-x-4 gap-y-3 items-end mt-3 pt-3 border-t border-slate-100">
          {otherFields.map(renderField)}
        </div>
      )}
    </div>
  );
}
