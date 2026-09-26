import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Custom hook for infinite scroll. Triggers onLoadMore when user scrolls near the bottom.
 */
export function useInfiniteScroll({
  onLoadMore,
  threshold = 0.2,
  enabled = true,
}: UseInfiniteScrollOptions) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !observerTarget.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { threshold }
    );

    observer.observe(observerTarget.current);

    return () => observer.disconnect();
  }, [onLoadMore, threshold, enabled]);

  return observerTarget;
}

/**
 * Custom hook for debounced search input
 */
export function useDebouncedSearch(initialValue = "", delay = 300) {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);

  return { value, setValue, debouncedValue };
}

/**
 * Only adopt keys the caller declared, and only when the stored value still has
 * the shape the default has. A hand-edited or stale entry then degrades to the
 * default for that one filter instead of poisoning the whole set.
 */
function mergeStored<T extends object>(fallback: T, stored: unknown): T {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return fallback;
  }
  const raw = stored as Record<string, unknown>;
  const next = { ...fallback };
  for (const key of Object.keys(fallback) as Array<keyof T & string>) {
    const value = raw[key];
    if (value !== undefined && typeof value === typeof fallback[key]) {
      next[key] = value as T[keyof T & string];
    }
  }
  return next;
}

/**
 * A set of list filters kept in localStorage, so leaving an admin list and
 * coming back lands on the same view instead of resetting to the defaults.
 *
 * The stored values are adopted in an effect rather than in the initial state:
 * localStorage does not exist during the server render, and seeding from it
 * directly would make the first client render disagree with the markup React is
 * hydrating. `hydrated` flips true once the real filters are in place, so a list
 * can hold its first fetch until then instead of fetching twice.
 *
 * Values must be JSON-serialisable primitives — a filter that needs an object
 * (a date range, say) is stored as the pieces it is rebuilt from.
 */
export function usePersistentFilters<T extends object>(
  storageKey: string,
  fallback: T,
) {
  const [filters, setFilters] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);
  // Read once, on mount: re-reading on every render of a new object literal
  // would fight the user's own changes.
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // Private mode or blocked storage: the defaults are a fine answer.
    }
    if (stored) {
      try {
        setFilters(mergeStored(fallbackRef.current, JSON.parse(stored)));
      } catch {
        // Corrupt entry; keep the defaults.
      }
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    // Writing before the stored value has been read would overwrite it with the
    // defaults on every mount.
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {
      // Not worth breaking the page over.
    }
  }, [storageKey, filters, hydrated]);

  /** Merge a partial change in, leaving the other filters alone. */
  const patchFilters = useCallback((patch: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(fallbackRef.current);
  }, []);

  return { filters, patchFilters, resetFilters, hydrated };
}

// Next resets the scroll offset on every navigation, and the admin lists fetch
// their rows on the client, so when the user comes back the page is still empty
// and there is nothing for the browser to restore against. Remember the offset
// ourselves and re-apply it once the rows are on screen. Only a real return
// restores: arriving at a list fresh should still start at the top.
let restorePath: string | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    restorePath = window.location.pathname;
  });
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Marks an in-app "back" navigation so the list at `path` restores the scroll
 * offset it was left at. Browser back/forward is picked up automatically.
 */
export function markScrollRestore(path: string) {
  restorePath = path;
}

/**
 * Restores the scroll offset of a client-fetched list. `key` should describe
 * what the list is currently showing, so an offset saved under one set of
 * filters is never re-applied to a different set of rows. `ready` should flip
 * true once those rows have rendered.
 */
export function useScrollRestoration(key: string, ready: boolean) {
  const storageKey = `scroll:${key}`;
  const restored = useRef(false);

  // A layout effect on purpose: its cleanup runs while the user is still on
  // this list, whereas a passive one would only run after the next route has
  // already reset the scroll offset to the top. An empty list has no offset
  // worth keeping, and skipping it also stops StrictMode remounts in dev from
  // overwriting a real one with zero.
  useIsomorphicLayoutEffect(() => {
    if (!ready) return;
    return () => {
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        // Storage can be unavailable (private mode, blocked cookies); losing
        // the scroll offset is not worth breaking the page over.
      }
    };
  }, [storageKey, ready]);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    if (restorePath !== window.location.pathname) return;
    restorePath = null;

    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {
      return;
    }
    const offset = Number(saved);
    if (!saved || !Number.isFinite(offset) || offset <= 0) return;
    requestAnimationFrame(() => window.scrollTo(0, offset));
  }, [storageKey, ready]);
}
