import { useEffect, useRef } from "react";

type Shortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  enabled?: boolean;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef<Shortcut[]>(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const s of shortcutsRef.current) {
        if (s.enabled === false) continue;

        const ctrlMatch = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;

        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !s.ctrl && e.key !== "Escape") return;

          e.preventDefault();
          s.handler();
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
