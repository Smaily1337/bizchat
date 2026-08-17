import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TOUR_STEPS, TOUR_STORAGE_KEY } from "./steps";

type TourContextValue = {
  active: boolean;
  stepIndex: number;
  stepCount: number;
  completed: boolean;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function readCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    return false;
  }
}

function writeCompleted() {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    /* ignore quota */
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(readCompleted);

  useEffect(() => {
    if (completed || active) return;
    const t = window.setTimeout(() => {
      if (!readCompleted()) {
        setActive(true);
        setStepIndex(0);
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [completed, active]);

  const finish = useCallback(() => {
    writeCompleted();
    setCompleted(true);
    setActive(false);
    setStepIndex(0);
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        queueMicrotask(() => finish());
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      stepCount: TOUR_STEPS.length,
      completed,
      start,
      next,
      back,
      skip,
      finish,
    }),
    [active, stepIndex, completed, start, next, back, skip, finish],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
