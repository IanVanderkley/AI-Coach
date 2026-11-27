"use client";
import { useEffect, useState } from "react";
import {
  COACHING_SECTIONS_KEY,
  DEFAULT_COACHING_SECTIONS,
  loadCoachingSections,
  type CoachingSection,
  type CoachingSections,
} from "./coaching-section-preferences";
import { readLearningView, writeLearningView } from "../coach/learning-view-preferences";
const EVENT = "ai-coach:coaching-sections";
export function readCoachingSections(): CoachingSections {
  try {
    return loadCoachingSections(window.localStorage);
  } catch {
    return { ...DEFAULT_COACHING_SECTIONS };
  }
}
export function useCoachingSections() {
  const [sections, setSections] = useState<CoachingSections>(DEFAULT_COACHING_SECTIONS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => {
      const next = readCoachingSections();
      try {
        if (!window.localStorage.getItem(COACHING_SECTIONS_KEY))
          next.progress = readLearningView(window.localStorage).expanded;
      } catch {}
      setSections(next);
      setReady(true);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);
  function update(key: CoachingSection, value: boolean) {
    const next = { ...sections, [key]: value };
    try {
      window.localStorage.setItem(COACHING_SECTIONS_KEY, JSON.stringify(next));
      if (key === "progress")
        writeLearningView(window.localStorage, {
          ...readLearningView(window.localStorage),
          expanded: value,
        });
      setSections(next);
      setError("");
      window.dispatchEvent(new Event(EVENT));
    } catch {
      setError("Could not save section defaults in this browser.");
    }
  }
  return { sections, ready, update, error };
}
