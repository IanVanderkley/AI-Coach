"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
const KEY = "ai-coach.history-grades.v1";
const FIELD = "show_coaching_history_grades";
export function historyGradesEnabled(value: unknown): boolean {
  return value !== false;
}
function localChoice() {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function useHistoryGrades() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const client = getSupabaseBrowserClient();
      if (!client) return localChoice();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) return localChoice();
      const result = await client.auth.getUser();
      if (result.error || !result.data.user)
        throw new Error("Could not load account preference");
      return historyGradesEnabled(result.data.user.user_metadata[FIELD]);
    }
    void load()
      .then((value) => {
        if (active) {
          setEnabled(value);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError("Could not load your grade preference. Refresh to retry.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function update(value: boolean) {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const client = getSupabaseBrowserClient();
      const session = client ? await client.auth.getSession() : null;
      if (session?.error) throw session.error;
      if (client && session?.data.session) {
        const { error } = await client.auth.updateUser({ data: { [FIELD]: value } });
        if (error) throw error;
      } else {
        window.localStorage.setItem(KEY, value ? "on" : "off");
      }
      setEnabled(value);
    } catch {
      setError("Could not save your grade preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return { enabled, ready, saving, error, update };
}
