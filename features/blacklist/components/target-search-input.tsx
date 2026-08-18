"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export type TargetCandidate = {
  id: string;
  label: string;
  sublabel: string;
};

type Props = {
  searchUrl: (query: string) => string;
  placeholder: string;
  onSelect: (candidate: TargetCandidate) => void;
  disabled?: boolean;
};

/** Debounced @handle / KOBAID / shopname search box shared by the shop
 * and superadmin blacklist forms — client, 2026-08-18: "search the
 * blacklist via @usename or @shopname." */
export function TargetSearchInput({ searchUrl, placeholder, onSelect, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<TargetCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setCandidates([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const response = await fetch(searchUrl(query), { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { candidates?: TargetCandidate[] };
      setCandidates(payload.candidates ?? []);
      setOpen(true);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && candidates.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-white/10 bg-surface shadow-lg">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  onSelect(candidate);
                  setQuery("");
                  setCandidates([]);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{candidate.label}</span>
                <span className="text-xs text-muted">{candidate.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
