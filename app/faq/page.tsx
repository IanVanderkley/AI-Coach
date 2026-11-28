import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Navbar } from "@/components/play/navbar";
import { RANK_POLICY_V4, RANK_TIERS_V4 } from "@/lib/leaderboard/rank-policy-v4";
import { XP_PER_LEVEL } from "@/lib/levels/progression";

export const metadata: Metadata = {
  title: "FAQ | MindSweeper",
  description:
    "Learn the rules of MindSweeper, Ranked rating, account XP, post-game coaching and privacy.",
};

const topics = [
  ["gameplay", "Gameplay"],
  ["ranked", "Ranked"],
  ["xp", "XP and levels"],
  ["coaching", "Coaching"],
  ["privacy", "Privacy and history"],
] as const;

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="faq-question">
      <summary>
        <span>{title}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="faq-answer">{children}</div>
    </details>
  );
}

function Topic({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="faq-topic" id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      <div className="faq-questions">{children}</div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to FAQ
      </a>
      <Navbar />
      <main className="page-shell faq-page" id="main-content" tabIndex={-1}>
        <div className="page-heading faq-heading">
          <div>
            <h1>
              FAQ<span className="title-period">.</span>
            </h1>
            <p className="page-subtitle">
              Everything you need to know to play, compete and improve.
            </p>
          </div>
        </div>
        <div className="faq-layout">
          <nav className="faq-topics" aria-label="FAQ topics">
            <h2>Contents</h2>
            {topics.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
            <a href="#about">About MindSweeper</a>
          </nav>
          <div className="faq-content">
            <Topic id="gameplay" title="Gameplay">
              <Question title="How do I win a game of Minesweeper?">
                <p>
                  Reveal every square that does not contain a mine. A revealed number
                  tells you how many mines touch that square, including diagonals. Use
                  those clues to work out which covered squares are safe. Revealing a mine
                  ends the game.
                </p>
                <p>
                  Flags help you mark suspected mines; placing flags alone does not win
                  the game.
                </p>
              </Question>
              <Question title="What is the difference between Practice and Ranked?">
                <p>
                  Practice offers Beginner (9 × 9, 10 mines), Intermediate (16 × 16, 40
                  mines) and Expert (16 × 30, 99 mines). You can play Practice without an
                  account and review completed recordings.
                </p>
                <p>
                  Ranked requires an account and uses the Intermediate board, with
                  server-recorded moves and verified results. Ranked affects Elo. Practice
                  does not. Coaching is post-game, not live Ranked assistance.
                </p>
                <p>
                  <Link href="/">Play Practice</Link> ·{" "}
                  <Link href="/ranked">Play Ranked</Link>
                </p>
              </Question>
              <Question title="How do I reveal, flag and chord?">
                <ul>
                  <li>
                    <strong>Reveal:</strong> click or tap a covered square in Reveal mode.
                  </li>
                  <li>
                    <strong>Flag:</strong> right-click a square, or tap it in Flag mode.
                  </li>
                  <li>
                    <strong>Chord:</strong> in Reveal mode, click or tap a revealed number
                    when the number of adjacent flags matches it. This opens its covered
                    unflagged neighbours. Practice also supports left + right click.
                  </li>
                </ul>
                <p>
                  A matching flag count does not prove the flags are correct. Chording
                  with incorrect flags can hit a mine. You can show or hide the board
                  controls guide in <Link href="/settings">Settings</Link>.
                </p>
              </Question>
              <Question title="Does the Ranked timer pause if I leave?">
                <p>
                  No. Once you make your first reveal, Ranked time continues even when you
                  leave the page. Resume an unfinished match through the Ranked lobby.
                </p>
              </Question>
            </Topic>
            <Topic id="ranked" title="Ranked and Elo">
              <Question title="What is Elo and how do I earn it?">
                <p>
                  Elo is our solo competitive rating, not a head-to-head rating against
                  another player. New players begin at{" "}
                  {RANK_POLICY_V4.starting.toLocaleString("en-US")} Elo (Gold V). The
                  server settles each completed Ranked match using your pre-match tier.
                  Elo is separate from XP and coaching grades.
                </p>
                <p>
                  Rating cannot exceed {RANK_POLICY_V4.maximum.toLocaleString("en-US")}.
                  Copper V includes negative ratings. Existing ratings and historical
                  awards are retained when policies change.
                </p>
              </Question>
              <Question title="What are the ranks and Elo rewards?">
                <p>
                  Every numbered division advances at 100 Elo. Copper through Emerald have
                  five divisions, Diamond has three and Omniscient has no divisions. The
                  table shows tier entry and nominal win/loss rewards before protection or
                  caps.
                </p>
                <div
                  className="faq-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Rank thresholds and rewards"
                >
                  <table className="faq-table">
                    <thead>
                      <tr>
                        <th scope="col">Tier</th>
                        <th scope="col">Entry Elo</th>
                        <th scope="col">Win</th>
                        <th scope="col">Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RANK_TIERS_V4.map((tier, index) => (
                        <tr key={tier.name}>
                          <th scope="row">{tier.name}</th>
                          <td>
                            {index === 0 ? "Below 500" : tier.min.toLocaleString("en-US")}
                          </td>
                          <td className="faq-positive">+{tier.win}</td>
                          <td className="faq-negative">−{tier.loss}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  <Link href="/ranked/rating-guide">Read the detailed rating guide</Link>.
                </p>
              </Question>
              <Question title="How does demotion protection work?">
                <p>
                  If you start above a division floor and an ordinary loss would cross it,
                  the loss stops at that floor. A subsequent ordinary loss starting
                  exactly at the floor demotes you. A win above the floor makes protection
                  available again. Copper V has no protection.
                </p>
                <p>
                  For example, at 1,505 Elo (Gold V), an ordinary loss stops at 1,500
                  instead of deducting the full 12 Elo. Another ordinary loss from 1,500
                  takes you to 1,488 (Silver I).
                </p>
              </Question>
              <Question title="What happens if my final square is a genuine 50/50 guess?">
                <p>
                  A direct reveal loss with exactly one safe square remaining and exactly
                  two equally possible candidates can earn half the normal tier victory
                  reward, rounded up and capped at 10,000 Elo.
                </p>
                <p>
                  The server must prove that final pair using visible clues, not player
                  flags. Other guesses, chord losses and unproven situations do not
                  qualify. The match still counts as a loss. XP eligibility is
                  independent.
                </p>
              </Question>
              <Question title="Which results appear on the leaderboard?">
                <p>
                  The public Elo-style rating and Fastest Wins boards use server-recorded
                  Ranked results. Fastest Wins shows eligible verified Intermediate
                  victories; Practice results and coaching grades never qualify. Public
                  visibility must be enabled. Each board displays up to 50 entries.
                </p>
                <p>
                  <Link href="/leaderboard">View the leaderboard</Link>.
                </p>
              </Question>
            </Topic>
            <Topic id="xp" title="XP and account levels">
              <Question title="How do account levels work?">
                <p>
                  Level 1 starts at 0 XP. Each additional{" "}
                  {XP_PER_LEVEL.toLocaleString("en-US")} XP advances one level. Your level
                  is separate from your Ranked Elo and coaching grade.
                </p>
              </Question>
              <Question title="How much XP can I earn?">
                <div
                  className="faq-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Current XP rewards"
                >
                  <table className="faq-table">
                    <thead>
                      <tr>
                        <th scope="col">Mode</th>
                        <th scope="col">Win</th>
                        <th scope="col">Eligible loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Beginner Practice</th>
                        <td>50</td>
                        <td>10</td>
                      </tr>
                      <tr>
                        <th scope="row">Intermediate Practice</th>
                        <td>100</td>
                        <td>20</td>
                      </tr>
                      <tr>
                        <th scope="row">Expert Practice</th>
                        <td>150</td>
                        <td>30</td>
                      </tr>
                      <tr>
                        <th scope="row">Ranked</th>
                        <td>350</td>
                        <td>50</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  These are current eligible awards, not guaranteed rewards for every
                  game. Loss XP requires at least 15 seconds and at least three distinct
                  reveal or chord positions, including the losing action. Flags do not
                  count. Practice awards require an eligible completed account recording;
                  Ranked awards require a verified server result.
                </p>
                <p>Past receipts retain the amounts originally awarded.</p>
              </Question>
              <Question title="Is there a daily XP limit?">
                <p>
                  Practice XP is capped at 500 per UTC day. If a full award would exceed
                  the cap, it is not awarded. The Practice cap does not apply to Ranked
                  XP. Guest Practice does not award account XP unless an eligible
                  recording is successfully saved to an account.
                </p>
              </Question>
            </Topic>
            <Topic id="coaching" title="Coaching and learning">
              <Question title="How is the coaching score calculated?">
                <p>
                  60% of the score is board completion. 40% is the share of provable
                  decisions that were good. Move 0 and uncertain choices are not graded as
                  decisions. If no later decision can be proved, no score is shown. This
                  is a learning aid, not an official rank.
                </p>
                <p>
                  Grades are S (90–100), A (78–89), B (65–77), C (50–64) and D (below 50).
                </p>
              </Question>
              <Question title="How are moves assessed?">
                <p>
                  Move 0 opens the board and is not assessed. Uncertain moves are not
                  automatically mistakes or unavoidable guesses.
                </p>
                <p>
                  Coaching uses visible-board evidence to identify supported decisions and
                  verified mistakes. The replay compares the information before and after
                  a recorded action. A flag is not proof of a mine.
                </p>
              </Question>
              <Question title="How do I review a game or get help understanding a move?">
                <p>
                  Open <Link href="/coaching">Coaching</Link>, choose a completed game,
                  and select a key lesson or move. The replay offers Before, After and
                  Compare views, deduction highlights and step-by-step explanations where
                  evidence is available.
                </p>
                <p>
                  Ask your coach explains verified moves using board logic. External AI
                  chat is not enabled. No live assistance is provided during Ranked play.
                </p>
              </Question>
              <Question title="How are learning progress and saved reports measured?">
                <p>
                  Save coaching reports from completed games to track learning privately
                  across devices. Progress uses saved reports of the selected mode,
                  difficulty and current analysis version, with up to 100 returned reports
                  per mode. Proven decision accuracy is good decisions divided by good
                  decisions plus proven mistakes; uncertain moves are excluded. Average
                  learning score excludes ungraded reports.
                </p>
                <p>
                  Accuracy change compares equal older and newer halves of the selected
                  reviews, with at least five games per half and provable decisions in
                  both halves. The change is shown in percentage points. Unsave removes
                  the saved report, not the game or its replay.
                </p>
              </Question>
              <Question title="Why is a game grade missing or unavailable?">
                <p>
                  Not graded means there was insufficient evidence to assign a learning
                  score. An unavailable grade can also indicate a missing or invalid
                  recording or a temporary request error. Refresh the expanded Ranked
                  history to retry unavailable grades, or review an available game
                  manually. Automatic grades can be disabled in Settings.
                </p>
              </Question>
            </Topic>
            <Topic id="privacy" title="Privacy and history">
              <Question title="Can other players see my results?">
                <p>
                  New Ranked accounts appear publicly by default when eligible. The public
                  boards show your public username and eligible results, not your email or
                  private recordings. Turn on Anonymous mode and save in{" "}
                  <Link href="/settings">Settings</Link> to hide your name and results
                  from both public leaderboards. Your own rating, XP and history are
                  unaffected.
                </p>
              </Question>
              <Question title="What is the difference between recent history and account totals?">
                <p>
                  Recent Ranked history shows up to ten completed Intermediate matches.
                  Detailed Practice account history retains up to 100 recordings; older
                  tracked totals survive recording cleanup. Only completed account uploads
                  with all recorded moves count toward tracked Practice totals.
                </p>
                <p>
                  Tracked Practice includes complete retained recordings at the time
                  tracking was introduced and subsequent eligible recorded games.
                  Previously deleted or trimmed games cannot be recovered. Practice is
                  player-recorded, not server-verified gameplay. Ranked totals are tracked
                  separately from server-owned results. Recent history is not a lifetime
                  total.
                </p>
              </Question>
              <Question title="What happens to my Practice history as a guest?">
                <p>
                  Guest Practice history is stored for the current browser tab/session,
                  not permanently in your account. Sign in and successfully sync eligible
                  recordings to retain them in account history. Account totals only
                  include successfully tracked recordings.
                </p>
              </Question>
              <Question title="Where can I manage my account and privacy?">
                <p>
                  Visit <Link href="/settings">Settings</Link> to manage account
                  information, leaderboard visibility, coaching preferences and account
                  deletion. Public visibility is independent of private learning history.
                </p>
              </Question>
            </Topic>
            <section className="faq-about" id="about" aria-labelledby="about-heading">
              <h2 id="about-heading">About MindSweeper</h2>
              <p>
                MindSweeper combines classic Minesweeper, solo Ranked competition and
                evidence-based post-game coaching. The goal is to help you understand your
                decisions, not just complete a board.
              </p>
              <Link className="faq-play-link" href="/">
                Play a game
              </Link>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
