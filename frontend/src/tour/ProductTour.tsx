import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { GlassButton } from "@/components/ui";
import { TOUR_STEPS } from "./steps";
import { useTour } from "./TourContext";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 10;

function measure(selector?: string): Rect | null {
  if (!selector) return null;
  const nodes = Array.from(document.querySelectorAll(selector));
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width >= 2 && r.height >= 2) {
      return {
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      };
    }
  }
  return null;
}

export function ProductTour() {
  const { active, stepIndex, stepCount, next, back, skip } = useTour();
  const navigate = useNavigate();
  const step = TOUR_STEPS[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || !step) return;
    setReady(false);
    setRect(null);
    if (step.route) {
      void navigate(step.route);
    }
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      const m = measure(step.target);
      if (m || !step.target) {
        setRect(m);
        setReady(true);
        return;
      }
      tries += 1;
      if (tries < 20) {
        window.setTimeout(tick, 50);
      } else {
        setRect(null);
        setReady(true);
      }
    };
    const id = window.setTimeout(tick, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [active, step, navigate, stepIndex]);

  useLayoutEffect(() => {
    if (!active) return;
    const onResize = () => setRect(measure(step?.target));
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step]);

  if (!active || !step || !ready) return null;

  const isCenter = step.placement === "center" || !rect;
  const isLast = stepIndex === stepCount - 1;

  let tipStyle: CSSProperties = {
    position: "fixed",
    zIndex: 80,
    maxWidth: 360,
  };

  if (isCenter) {
    tipStyle = {
      ...tipStyle,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else if (rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBottom = step.placement !== "top" && spaceBelow > 200;
    tipStyle = {
      ...tipStyle,
      top: placeBottom
        ? Math.min(rect.top + rect.height + 12, window.innerHeight - 220)
        : Math.max(16, rect.top - 12 - 200),
      left: Math.min(Math.max(16, rect.left), window.innerWidth - 376),
    };
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div
        className="pointer-events-auto absolute inset-0 bg-black/55 transition-opacity"
        onClick={skip}
        aria-hidden
      />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-control border border-white/55 shadow-[0_0_0_9999px_rgba(0,0,0,0.72)] transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      <div
        className="pointer-events-auto animate-fade-up rounded-soft border border-glass-border bg-[var(--bg-elevated)]/95 p-5 shadow-glass backdrop-blur-glass"
        style={tipStyle}
      >
        <p className="label-caps text-[10px] text-[var(--muted)]">
          Samouczek · {stepIndex + 1} / {stepCount}
        </p>
        <h2
          id="tour-title"
          className="mt-2 font-display text-xl font-bold text-white"
        >
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {step.body}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <GlassButton type="button" onClick={next}>
            {isLast ? "Zakończ" : "Dalej"}
          </GlassButton>
          {stepIndex > 0 && !isLast && (
            <GlassButton type="button" variant="ghost" onClick={back}>
              Wstecz
            </GlassButton>
          )}
          {!isLast && (
            <GlassButton type="button" variant="subtle" onClick={skip}>
              Pomiń
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}
