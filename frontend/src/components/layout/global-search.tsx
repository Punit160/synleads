"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Handshake, Search, Target, UserCheck, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SearchInput } from "@/components/ui/search-input";
import { useTenantPath } from "@/lib/use-tenant-path";

type SearchResults = {
  leads: Array<{ id: string; firstName: string; lastName: string | null; company: string | null }>;
  contacts: Array<{ id: string; firstName: string; lastName: string | null }>;
  accounts: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string; company: string | null }>;
};

export function GlobalSearch({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const tp = useTenantPath();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults(null));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        const input = inputWrap.current?.querySelector("input");
        input?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const hasResults =
    results &&
    (results.leads.length + results.contacts.length + results.accounts.length + results.deals.length + results.customers.length > 0);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    router.push(tp(path));
  }

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <div ref={inputWrap} className="relative">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={dark ? "Search CRM…" : "Search leads, deals, contacts…"}
          aria-label="Search leads, deals, contacts, and more"
          size="compact"
          inputClassName="pr-12"
        />
        <kbd className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          ⌘K
        </kbd>
      </div>
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg border border-slate-200 bg-white shadow-xl z-50 max-h-80 overflow-y-auto text-slate-900">
          {!hasResults ? (
            <div className="px-4 py-6 text-center">
              <Search className="h-5 w-5 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="py-1.5">
              {results!.leads.length > 0 && (
                <Section title="Leads" icon={Target}>
                  {results!.leads.map((l) => (
                    <ResultRow
                      key={l.id}
                      title={`${l.firstName} ${l.lastName || ""}`.trim()}
                      subtitle={l.company}
                      onClick={() => go(`/dashboard/leads/${l.id}`)}
                    />
                  ))}
                </Section>
              )}
              {results!.contacts.length > 0 && (
                <Section title="Contacts" icon={Users}>
                  {results!.contacts.map((c) => (
                    <ResultRow
                      key={c.id}
                      title={`${c.firstName} ${c.lastName || ""}`.trim()}
                      onClick={() => go(`/dashboard/contacts/${c.id}`)}
                    />
                  ))}
                </Section>
              )}
              {results!.accounts.length > 0 && (
                <Section title="Accounts" icon={Building2}>
                  {results!.accounts.map((a) => (
                    <ResultRow key={a.id} title={a.name} onClick={() => go(`/dashboard/accounts/${a.id}`)} />
                  ))}
                </Section>
              )}
              {results!.deals.length > 0 && (
                <Section title="Deals" icon={Handshake}>
                  {results!.deals.map((d) => (
                    <ResultRow key={d.id} title={d.name} onClick={() => go(`/dashboard/deals/${d.id}`)} />
                  ))}
                </Section>
              )}
              {results!.customers.length > 0 && (
                <Section title="Customers" icon={UserCheck}>
                  {results!.customers.map((c) => (
                    <ResultRow
                      key={c.id}
                      title={c.name}
                      subtitle={c.company}
                      onClick={() => go(`/dashboard/customers/${c.id}`)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Target; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {title}
      </p>
      {children}
    </div>
  );
}

function ResultRow({ title, subtitle, onClick }: { title: string; subtitle?: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-sm hover:bg-brand-muted truncate"
      onClick={onClick}
    >
      <span className="block truncate text-slate-800">{title}</span>
      {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
    </button>
  );
}
