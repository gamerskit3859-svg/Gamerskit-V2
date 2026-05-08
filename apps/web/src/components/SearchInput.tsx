"use client";
import { Search, X } from "lucide-react";
import { useDebouncedSearch } from "@/lib/hooks";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search products…",
  className = "",
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-soft)]">
        <Search size={16} strokeWidth={1.8} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-[var(--line-strong)] focus:border-black focus:outline-none transition-colors bg-[var(--bg)]"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-soft)] hover:text-[var(--fg)] transition-colors"
          aria-label="Clear search"
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
