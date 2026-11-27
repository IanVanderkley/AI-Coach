import Link from "next/link";
import { MineLogo } from "@/components/play/mine-logo";

/** Shared document-flow footer; no client state or network requests. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link href="/" className="site-footer-brand" aria-label="MindSweeper home">
          <MineLogo className="site-footer-mark" />
          <span>MindSweeper</span>
        </Link>
        <nav className="site-footer-links" aria-label="Help and information">
          <Link href="/faq">FAQ</Link>
          <Link href="/faq#ranked">Ranked rules</Link>
          <Link href="/faq#privacy">Privacy &amp; history</Link>
          <Link href="/faq#about">About</Link>
        </nav>
      </div>
    </footer>
  );
}
