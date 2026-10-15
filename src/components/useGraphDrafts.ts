import { useCallback, useRef, useState } from "react";

type Entry = { text: string; error?: string };
export function useGraphDrafts() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const current = useRef(entries);
  const change = useCallback((id: string, entry?: Entry) => {
    const next = { ...current.current };
    if (entry) next[id] = entry;
    else delete next[id];
    current.current = next;
    setEntries(next);
  }, []);
  const cancel = useCallback((id: string) => change(id), [change]);
  const edit = useCallback(
    (id: string, text: string, committed: string) => {
      change(id, text === committed ? undefined : { text });
    },
    [change],
  );
  const hasPending = useCallback(
    () => Object.keys(current.current).length > 0,
    [],
  );
  return {
    entries,
    change,
    cancel,
    edit,
    hasPending,
    pending: Object.keys(entries).length > 0,
  };
}
export type GraphDrafts = ReturnType<typeof useGraphDrafts>;
