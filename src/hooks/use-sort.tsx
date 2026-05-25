import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export function useSort<T>(items: T[], getters: Record<string, (item: T) => any>, initial?: { key: string; dir: SortDir }) {
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? "asc");

  const toggle = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !getters[sortKey]) return items;
    const get = getters[sortKey];
    const arr = [...items];
    arr.sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
    });
    if (sortDir === "desc") arr.reverse();
    return arr;
  }, [items, sortKey, sortDir, getters]);

  return { sorted, sortKey, sortDir, toggle };
}

export function SortHeader({
  label, sortKey, currentKey, dir, onToggle, className = "",
}: {
  label: string;
  sortKey: string;
  currentKey: string | null;
  dir: SortDir;
  onToggle: (k: string) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={"inline-flex items-center gap-1 hover:text-foreground select-none " + className}
    >
      {label}
      <Icon className={"h-3 w-3 " + (active ? "opacity-100" : "opacity-50")} />
    </button>
  );
}