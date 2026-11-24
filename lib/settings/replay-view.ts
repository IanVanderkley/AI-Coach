"use client";
import { useEffect, useState } from "react";
export type ReplayView = "compare" | "before" | "after";
const KEY = "ai-coach.replay-view.v1";
const EVENT = "ai-coach:replay-view";
export function isReplayView(value: unknown): value is ReplayView {
  return value === "compare" || value === "before" || value === "after";
}
function read(): ReplayView {
  try {
    const value = window.localStorage.getItem(KEY);
    return isReplayView(value) ? value : "compare";
  } catch {
    return "compare";
  }
}
export function useReplayView() {
  const [view, setView] = useState<ReplayView>("compare");
  useEffect(() => {
    const sync = () => setView(read());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);
  function update(value: ReplayView) {
    if (!isReplayView(value)) return;
    setView(value);
    try {
      window.localStorage.setItem(KEY, value);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* Keep the choice while mounted. */
    }
  }
  return { view, update };
}
