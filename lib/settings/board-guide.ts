"use client";

import { useSyncExternalStore } from "react";
import {
  BOARD_GUIDE_KEY,
  readBoardGuide,
  writeBoardGuide,
} from "./board-guide-preference";

const EVENT = "ai-coach:board-controls-guide";

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
function snapshot() {
  return readBoardGuide(storage());
}
function serverSnapshot() {
  return true;
}
function subscribe(notify: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === BOARD_GUIDE_KEY || event.key === null) notify();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, notify);
  };
}
function update(enabled: boolean) {
  if (!writeBoardGuide(storage(), enabled)) return false;
  window.dispatchEvent(new Event(EVENT));
  return true;
}
export function useBoardGuide() {
  const enabled = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return { enabled, update };
}
