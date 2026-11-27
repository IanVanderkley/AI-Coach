"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GameCoachReport } from "@/components/coach/game-coach-report";
import { CoachPreview } from "@/components/play/coach-preview";
import { CurrentFocus } from "@/components/play/current-focus";
import { MinesweeperBoard } from "@/components/play/minesweeper-board";
import { ModeSelector } from "@/components/play/mode-selector";
import { Navbar } from "@/components/play/navbar";
import { saveLastGame } from "@/lib/coach/last-game";
import type { GameplaySession } from "@/lib/coach/types";
import { DEFAULT_DIFFICULTY, DIFFICULTY_SETTINGS } from "@/lib/game-settings";
import type { Difficulty } from "@/lib/game-settings";
import { createPracticeRepository } from "@/lib/practice/repository";
import type { PracticeSession } from "@/lib/practice/history";
import {
  readPracticeDifficulty,
  savePracticeDifficulty,
} from "@/lib/practice/difficulty-preference";

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [lastGame, setLastGame] = useState<GameplaySession | null>(null);
  const [practiceSaveState, setPracticeSaveState] = useState<
    "idle" | "saving" | "account" | "local" | "error"
  >("idle");
  const practiceRepository = useMemo(() => createPracticeRepository(), []);
  const settings = DIFFICULTY_SETTINGS[difficulty];

  // Restore the chosen difficulty after navigating to Coaching and back.
  // Read after mount to keep the server-rendered and client-rendered HTML identical.
  useEffect(() => {
    try {
      const saved = readPracticeDifficulty(window.localStorage);
      if (saved) setDifficulty(saved);
    } catch {
      // Private browsing / disabled storage never prevent a Practice game.
    }
  }, []);

  // Keep the report responsive while saving the same complete recording through
  // the repository; local storage is written before any Supabase request.
  const handleGameComplete = useCallback(
    (session: PracticeSession) => {
      setLastGame(session);
      saveLastGame(session);
      setPracticeSaveState("saving");
      return practiceRepository
        .save(session)
        .then(async (saved) => {
          const mode = await practiceRepository.getStorageMode();
          setPracticeSaveState(mode);
          if (mode === "account") {
            window.dispatchEvent(new Event("ai-coach:xp-updated"));
            return saved.id;
          }
          return null;
        })
        .catch(() => {
          setPracticeSaveState("error");
          return null;
        });
    },
    [practiceRepository],
  );

  const retryPracticeSync = useCallback(() => {
    setPracticeSaveState("saving");
    void practiceRepository
      .syncPending()
      .then(async () => setPracticeSaveState(await practiceRepository.getStorageMode()))
      .catch(() => setPracticeSaveState("error"));
  }, [practiceRepository]);

  const handleGameStart = useCallback(() => setLastGame(null), []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to game
      </a>
      <Navbar />

      <main
        className="page-shell practice-page"
        data-difficulty={difficulty}
        id="main-content"
      >
        <div className="page-heading">
          <div>
            <p className="eyebrow">PLAY. LEARN. IMPROVE.</p>
            <h1>
              Minesweeper<span className="title-period">.</span>
            </h1>
          </div>
        </div>

        <div className="practice-setup-row">
          <div className="mode-row">
            <ModeSelector />
          </div>

          <fieldset className="practice-difficulty-picker">
            <legend className="sr-only">Board difficulty</legend>
            <div className="practice-difficulty-options">
              {(["beginner", "intermediate", "expert"] as const).map((next) => {
                const option = DIFFICULTY_SETTINGS[next];
                return (
                  <label className="practice-difficulty-option" key={next}>
                    <input
                      type="radio"
                      name="practice-difficulty"
                      value={next}
                      checked={difficulty === next}
                      onChange={() => {
                        setDifficulty(next);
                        try {
                          savePracticeDifficulty(window.localStorage, next);
                        } catch {
                          /* Storage blocked */
                        }
                        setLastGame(null);
                      }}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>
                        {option.rows} × {option.columns} · {option.mines} mines
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="play-layout">
          <MinesweeperBoard
            key={difficulty}
            settings={settings}
            onGameComplete={handleGameComplete}
            onGameStart={handleGameStart}
          />
          <aside className="coach-sidebar" aria-label="Coaching tools">
            <CurrentFocus />
            <CoachPreview />
          </aside>
        </div>

        {lastGame ? <GameCoachReport session={lastGame} /> : null}
        {lastGame && practiceSaveState !== "idle" ? (
          <p className="practice-save-status" role="status" aria-live="polite">
            {practiceSaveState === "saving" && "Saving Practice history…"}
            {practiceSaveState === "account" && "Practice history saved to your account."}
            {practiceSaveState === "local" &&
              "Practice history saved in this browser tab."}
            {practiceSaveState === "error" && (
              <>
                Practice history is kept in this browser tab, but account sync failed.{" "}
                <button type="button" onClick={retryPracticeSync}>
                  Retry sync
                </button>
              </>
            )}
          </p>
        ) : null}

        {/* Shared site footer is rendered by RootLayout. */}
      </main>
    </>
  );
}
