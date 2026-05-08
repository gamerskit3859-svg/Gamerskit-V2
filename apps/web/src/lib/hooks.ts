import { useEffect, useRef, useCallback, useState } from "react";

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
  const timeoutRef = useRef<NodeJS.Timeout>();

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
