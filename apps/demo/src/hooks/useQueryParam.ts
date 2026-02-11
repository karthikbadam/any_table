import { useCallback, useEffect, useState } from "react";

function readParam(key: string, defaultValue: string): string {
  if (typeof window === "undefined") return defaultValue;
  const params = new URLSearchParams(window.location.search);
  return params.get(key) ?? defaultValue;
}

export function useQueryParam(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readParam(key, defaultValue));

  useEffect(() => {
    const onPopState = () => {
      setValue(readParam(key, defaultValue));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key, defaultValue]);

  const setQueryValue = useCallback(
    (next: string) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const query = params.toString();
      const nextUrl = query
        ? `${window.location.pathname}?${query}${window.location.hash}`
        : `${window.location.pathname}${window.location.hash}`;
      window.history.pushState(null, "", nextUrl);
      setValue(next);
    },
    [key, defaultValue],
  );

  return [value, setQueryValue];
}
