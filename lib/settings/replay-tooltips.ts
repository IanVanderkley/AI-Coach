"use client";
import { useEffect, useState } from "react";
const KEY = "ai-coach.replay-tooltips.v1";
const EVENT = "ai-coach:replay-tooltips";
function read() {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function useReplayTooltips() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setEnabled(read());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);
  function update(value: boolean) {
    setEnabled(value);
    try {
      window.localStorage.setItem(KEY, value ? "on" : "off");
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* Keep the current choice for this mounted view if storage is unavailable. */
    }
  }
  return { enabled, update };
}
