// Cursor-paginated list hook used by most list screens.
//   const { items, loading, loadingMore, error, refresh, loadMore } =
//     usePaged("/api/dashboard/expenses", { q }, ["items", "expenses", "data"]);
// - `params` (plain object) are added to the query string; changing them reloads from page 1.
// - Stale responses from superseded requests are ignored.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { apiErrorMessage, asList, pick } from "./format";

export function usePaged(
  path: string,
  params: Record<string, string | number | undefined | null> = {},
  listKeys: string[] = ["items", "data"],
  opts: { limit?: number; debounceKey?: string } = {}
) {
  const [items, setItems] = useState<any[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const sig = JSON.stringify(params);

  const load = useCallback(
    async (cursor?: string | null) => {
      const id = ++reqId.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (opts.limit) qs.set("limit", String(opts.limit));
        for (const [k, v] of Object.entries(JSON.parse(sig))) {
          if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
        }
        if (cursor) qs.set("cursor", cursor);
        const q = qs.toString();
        const res: any = await api.get(`${path}${q ? `?${q}` : ""}`);
        if (id !== reqId.current) return;
        const list = asList(res, ...listKeys);
        setRaw(res);
        setItems((prev) => (cursor ? [...prev, ...list] : list));
        setNext(pick(res, ["nextCursor", "after", "next"]) ?? null);
      } catch (e: any) {
        if (id === reqId.current) setError(apiErrorMessage(e, "Couldn't load this list."));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, sig, opts.limit]
  );

  useEffect(() => {
    // Light debounce so typing in a search box doesn't fire a request per key.
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return {
    items,
    raw, // the full last response (for totals, summaries, etc.)
    loading,
    loadingMore,
    error,
    hasMore: !!next,
    refresh: () => load(),
    loadMore: () => {
      if (next && !loadingMore && !loading) load(next);
    },
    setItems, // for optimistic updates
  };
}
