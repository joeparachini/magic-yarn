import { useEffect, useMemo, useRef, useState } from "react";

type SearchableDropdownFilterProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  allLabel?: string;
  searchPlaceholder?: string;
  className?: string;
};

export function SearchableDropdownFilter({
  label,
  value,
  options,
  onChange,
  disabled = false,
  allLabel = "All",
  searchPlaceholder = "Type to filter options…",
  className = "relative flex w-full max-w-md flex-col gap-1",
}: SearchableDropdownFilterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
    };
  }, []);

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((name) => name.toLowerCase().includes(query));
  }, [options, search]);

  return (
    <div ref={containerRef} className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <button
        type="button"
        className="relative z-30 flex w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-left text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setSearch("");
        }}
        disabled={disabled}
      >
        <span>{value || allLabel}</span>
        <span className="text-xs text-muted-foreground">▼</span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onMouseDown={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full z-30 mt-2 w-full rounded-md border border-border bg-popover shadow-2xl ring-1 ring-border/70">
            <div className="border-b border-border bg-popover p-2">
              <input
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-auto bg-popover p-1">
              <button
                type="button"
                className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted/40"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setSearch("");
                }}
              >
                {allLabel}
              </button>

              {visibleOptions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted/40"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {name}
                </button>
              ))}

              {visibleOptions.length === 0 ? (
                <div className="px-2 py-2 text-sm text-muted-foreground">
                  No options found.
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
