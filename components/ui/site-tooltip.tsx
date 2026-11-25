"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  TOOLTIP_DELAY_MS,
  TOOLTIP_HIDE_MS,
  tooltipPosition,
} from "@/lib/ui/tooltip-position";

// One delegated tooltip for explicitly opted-in controls and replay cells.
// No per-cell listeners, state updates, native title delay, or clipping by board containers.
export function SiteTooltip() {
  const tipRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const element = tipRef.current;
    if (!element) return;
    const tip: HTMLDivElement = element;
    let anchor: HTMLElement | SVGElement | null = null;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    let described: Element | null = null;
    const target = (node: EventTarget | null) =>
      node instanceof Element
        ? node.closest<HTMLElement | SVGElement>("[data-tip]")
        : null;
    function removeDescription() {
      if (!described) return;
      const ids = (described.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id && id !== "site-tooltip");
      if (ids.length) described.setAttribute("aria-describedby", ids.join(" "));
      else described.removeAttribute("aria-describedby");
      described = null;
    }
    function hide() {
      clearTimeout(showTimer);
      showTimer = undefined;
      clearTimeout(hideTimer);
      observer?.disconnect();
      removeDescription();
      anchor = null;
      tip.hidden = true;
      tip.textContent = "";
    }
    function renderTip() {
      showTimer = undefined;
      if (!anchor?.isConnected || !anchor.getClientRects().length) return hide();
      const message = anchor.getAttribute("data-tip");
      if (!message) return hide();
      tip.textContent = message;
      tip.hidden = false;
      const position = tooltipPosition(
        anchor.getBoundingClientRect(),
        tip.getBoundingClientRect(),
        {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
      );
      tip.style.left = `${position.left}px`;
      tip.style.top = `${position.top}px`;
      const focused = document.activeElement;
      if (
        focused &&
        anchor.contains(focused) &&
        !focused.closest('[aria-hidden="true"]')
      ) {
        removeDescription();
        const ids = (focused.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter(Boolean);
        focused.setAttribute(
          "aria-describedby",
          [...new Set([...ids, "site-tooltip"])].join(" "),
        );
        described = focused;
      }
    }
    function start(next: HTMLElement | SVGElement | null) {
      if (!next || !next.getAttribute("data-tip")) return hide();
      clearTimeout(hideTimer);
      if (anchor === next && (!tip.hidden || showTimer !== undefined)) return;
      hide();
      anchor = next;
      observer = new MutationObserver(() => {
        if (!anchor?.isConnected || !anchor.getAttribute("data-tip")) hide();
        else if (!tip.hidden) renderTip();
      });
      observer.observe(next, { attributes: true, attributeFilter: ["data-tip"] });
      if (next.parentElement) observer.observe(next.parentElement, { childList: true });
      showTimer = setTimeout(renderTip, TOOLTIP_DELAY_MS);
    }
    function leaveSoon() {
      clearTimeout(showTimer);
      showTimer = undefined;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, TOOLTIP_HIDE_MS);
    }
    function pointerOver(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      if (event.target instanceof Node && tip.contains(event.target)) {
        clearTimeout(hideTimer);
        return;
      }
      const next = target(event.target);
      if (next) start(next);
      else if (anchor) leaveSoon();
    }
    function pointerOut(event: PointerEvent) {
      if (event.pointerType === "touch" || !anchor) return;
      if (
        event.relatedTarget instanceof Node &&
        (anchor.contains(event.relatedTarget) || tip.contains(event.relatedTarget))
      )
        return;
      if (
        target(event.target) === anchor ||
        (event.target instanceof Node && tip.contains(event.target))
      )
        leaveSoon();
    }
    function focusIn(event: FocusEvent) {
      const node = event.target;
      if (node instanceof Element && node.matches(":focus-visible")) start(target(node));
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }
    document.addEventListener("pointerover", pointerOver);
    document.addEventListener("pointerout", pointerOut);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", keyDown);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      hide();
      document.removeEventListener("pointerover", pointerOver);
      document.removeEventListener("pointerout", pointerOut);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", keyDown);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
    };
  }, [pathname]);

  return (
    <div ref={tipRef} id="site-tooltip" className="site-tooltip" role="tooltip" hidden />
  );
}
