// Coaching page shell.
import { CoachConsole } from "@/components/coach/coach-console";
import { Navbar } from "@/components/play/navbar";
import "@/styles/profile-history-controls.css";
import "@/styles/batch25-review-workspace.css";
import "@/styles/batch25-personalized-coaching.css";
import "@/styles/coaching-overview-polish.css";
import "@/styles/coaching-learning-polish.css";

import "@/styles/coaching-replay-polish.css";

export const metadata = {
  title: "AI-Coach | Coaching",
  description:
    "Review completed Practice and Ranked games with evidence-based coaching and move replay.",
};

// The Coaching tab. `CoachConsole` does the interactive work; this page only
// arranges the heading and the shared navigation.
export default function CoachingPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to coaching
      </a>
      <Navbar />

      <main className="page-shell coaching-page" id="main-content">
        <div className="page-heading coaching-page-heading">
          <h1>Coaching<span className="title-period">.</span></h1>
        </div>

        <CoachConsole />
        {/* Global footer will be supplied by the shared layout. */}
      </main>
    </>
  );
}
