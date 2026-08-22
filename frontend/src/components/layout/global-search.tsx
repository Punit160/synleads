"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search CRM…"
        aria-label="Search leads, deals, contacts, and more"
        size="compact"
      />
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl z-50 max-h-80 overflow-y-auto text-slate-900">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-slate-500">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <div className="py-2">
              {results!.leads.length > 0 && (
                <Section title="Leads">
                  {results!.leads.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 truncate"
                      onClick={() => go(`/dashboard/leads/${l.id}`)}
                    >
                      <span className="truncate block">{l.firstName} {l.lastName}</span>
                      {l.company && <span className="text-slate-500 truncate block"> · {l.company}</span>}
                    </button>
                  ))}
                </Section>
              )}
              {results!.contacts.length > 0 && (
                <Section title="Contacts">
                  {results!.contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                      onClick={() => go(`/dashboard/contacts/${c.id}`)}
                    >
                      {c.firstName} {c.lastName}
                    </button>
                  ))}
                </Section>
              )}
              {results!.accounts.length > 0 && (
                <Section title="Accounts">
                  {results!.accounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                      onClick={() => go(`/dashboard/accounts/${a.id}`)}
                    >
                      {a.name}
                    </button>
                  ))}
                </Section>
              )}
              {results!.deals.length > 0 && (
                <Section title="Pipeline deals">
                  {results!.deals.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                      onClick={() => go(`/dashboard/deals/${d.id}`)}
                    >
                      {d.name}
                    </button>
                  ))}
                </Section>
              )}
              {results!.customers.length > 0 && (
                <Section title="Customers">
                  {results!.customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                      onClick={() => go(`/dashboard/customers/${c.id}`)}
                    >
                      {c.name}
                      {c.company && <span className="text-slate-500"> · {c.company}</span>}
                    </button>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}
