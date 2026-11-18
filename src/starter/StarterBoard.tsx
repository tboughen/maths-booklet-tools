import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { renderStarterRun, type StarterRun } from "../../packages/resource-core/src/index";

/**
 * The board view (Tim, 18 Nov 2026: "same card, big"): the selected starter's card as large as
 * the screen allows, at 16:9, with a strip down the right for the timer, the starter's place in
 * the run and the answers switch. Pink means teacher only, as everywhere in MathsDock.
 * Keys: left and right arrows change starter, space starts or pauses the timer, A shows answers,
 * Escape closes.
 */
const MINUTE = 60;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function StarterBoard({ run, starter, onStarter, onClose }: { run: StarterRun; starter: number; onStarter: (s: number) => void; onClose: () => void }) {
  const [answers, setAnswers] = useState(false);
  const [length, setLength] = useState(5 * MINUTE);
  const [left, setLeft] = useState(5 * MINUTE);
  const [running, setRunning] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = run.document.starters.length;
  // The timer re-renders every second; the card is drawn only when it changes.
  const svg = useMemo(() => renderStarterRun(run, { view: answers ? "answers" : "pupil" }).cards[starter] ?? "", [run, answers, starter]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (left === 0) setRunning(false);
  }, [left]);
  // A new starter always opens with its answers hidden, so pupils never see the next one's answers.
  useEffect(() => setAnswers(false), [starter]);

  const go = (by: number) => onStarter(Math.min(count - 1, Math.max(0, starter + by)));
  const setMinutes = (m: number) => {
    const s = Math.min(30, Math.max(1, m)) * MINUTE;
    setLength(s);
    setLeft(s);
    setRunning(false);
  };
  // The latest handlers, for the listeners below (registered once).
  const latest = useRef({ go, onClose, left });
  latest.current = { go, onClose, left };

  useEffect(() => {
    const el = root.current;
    el?.focus();
    // Full screen where the browser allows it; the view works the same in the window. The browser
    // keeps Escape for leaving full screen, so leaving full screen closes the board too.
    let full = false;
    el?.requestFullscreen?.().then(
      () => void (full = true),
      () => undefined,
    );
    const change = () => {
      if (full && !document.fullscreenElement) latest.current.onClose();
    };
    // Keys are read on the document, not the board, so they still work when a button that had
    // focus becomes disabled (focus falls to the page body). Tab stays inside the board.
    const key = (e: KeyboardEvent) => {
      if (!el) return;
      if (e.key === "Tab") {
        const stops = [...el.querySelectorAll<HTMLElement>("button:not(:disabled)")];
        if (!stops.length) return;
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at === -1 || at === stops.length - 1 ? 0 : at + 1;
        stops[next].focus();
        e.preventDefault();
        return;
      }
      if ((e.target as HTMLElement).closest?.("button") && (e.key === " " || e.key === "Enter")) return;
      const { go, onClose, left } = latest.current;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") setRunning((r) => left > 0 && !r);
      else if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey && !e.altKey) setAnswers((a) => !a);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("fullscreenchange", change);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("fullscreenchange", change);
      document.removeEventListener("keydown", key, true);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  return (
    <div ref={root} className="st-board" role="dialog" aria-modal="true" aria-label={`Silent starter ${starter + 1} on the board`} tabIndex={-1}>
      <div className="st-board-card" data-testid="starter-board-card">
        <div className="st-board-art" dangerouslySetInnerHTML={{ __html: svg.replace('font-family="Inter, sans-serif"', 'font-family="MathsDock Worksheet, Inter, sans-serif"') }} />
        {answers && <span className="st-board-answers-tag">Answers</span>}
      </div>
      <aside className="st-board-strip" aria-label="Board controls">
        <button className="st-board-close" aria-label="Close the board view" onClick={onClose}>
          <X size={22} aria-hidden="true" />
        </button>
        <div className="st-board-timer" role="timer" aria-live="off" aria-label={`${clock(left)} left`} data-done={left === 0 || undefined}>
          {clock(left)}
        </div>
        <div className="st-board-row">
          <button aria-label={running ? "Pause the timer" : "Start the timer"} disabled={left === 0} onClick={() => setRunning(!running)}>
            {running ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
          </button>
          <button aria-label="Reset the timer" onClick={() => (setLeft(length), setRunning(false))}>
            <RotateCcw size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="st-board-row">
          <button aria-label="One minute less" disabled={length <= MINUTE} onClick={() => setMinutes(length / MINUTE - 1)}>
            <Minus size={18} aria-hidden="true" />
          </button>
          <span className="st-board-minutes">{length / MINUTE} min</span>
          <button aria-label="One minute more" disabled={length >= 30 * MINUTE} onClick={() => setMinutes(length / MINUTE + 1)}>
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="st-board-place">
          Starter {starter + 1} of {count}
        </div>
        <div className="st-board-row">
          <button aria-label="Previous starter" disabled={starter === 0} onClick={() => go(-1)}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button aria-label="Next starter" disabled={starter === count - 1} onClick={() => go(1)}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
        <button className="st-board-answers" aria-pressed={answers} onClick={() => setAnswers(!answers)}>
          <Eye size={18} aria-hidden="true" /> {answers ? "Hide answers" : "Show answers"}
        </button>
      </aside>
    </div>
  );
}
