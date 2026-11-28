/**
 * The screen pen, shared by the Question Bank viewer and booklet Present mode: the open/closed state, the tool,
 * colour and size settings (remembered on this device), undo and redo across the views on screen, the tool-shaped
 * pointer and the pen's keyboard shortcuts. Each page keeps its own ink store and its own Escape and arrow keys;
 * everything a teacher touches on the pen behaves the same in both places.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnnotationSettings } from "./AnnotationLayer";
import { HIGHLIGHTER_COLOURS, layerOf, PEN_COLOURS, readAnnotationPreferences, saveAnnotationPreferences, SIZES, toolCursor, withTool, type AnnotationAction, type AnnotationPreferences, type AnnotationState, type AnnotationTool, type Stroke } from "./annotations";

const TOOL_KEYS: Record<string, AnnotationTool> = { h: "highlighter", e: "eraser", l: "laser", v: "hand" };

export function usePen(ink: AnnotationState, dispatch: (action: AnnotationAction) => void) {
  const [annotating, setAnnotating] = useState(false);
  const [prefs, setPrefs] = useState<AnnotationPreferences>(readAnnotationPreferences);
  useEffect(() => saveAnnotationPreferences(prefs), [prefs]);
  // Read by key handlers between renders, so a quick second key press sees the first.
  const now = useRef({ annotating, tool: prefs.tool }); now.current = { annotating, tool: prefs.tool };

  // Undo and redo follow the order of changes across the views on screen.
  const undoKeys = useRef<string[]>([]), redoKeys = useRef<string[]>([]);
  const inkRef = useRef(ink); inkRef.current = ink;
  const commit = useCallback((key: string, strokes: Stroke[]) => { undoKeys.current.push(key); redoKeys.current = []; dispatch({ type: "set", key, strokes }); }, [dispatch]);
  const step = useCallback((from: React.MutableRefObject<string[]>, to: React.MutableRefObject<string[]>, type: "undo" | "redo", visible?: (key: string) => boolean) => {
    const keys = from.current;
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i], layer = layerOf(inkRef.current, key);
      if ((!visible || visible(key)) && (type === "undo" ? layer.past : layer.future).length) { keys.splice(i, 1); to.current.push(key); dispatch({ type, key }); return; }
    }
  }, [dispatch]);
  const undo = useCallback((visible?: (key: string) => boolean) => step(undoKeys, redoKeys, "undo", visible), [step]);
  const redo = useCallback((visible?: (key: string) => boolean) => step(redoKeys, undoKeys, "redo", visible), [step]);
  const canUndo = (visible: (key: string) => boolean) => undoKeys.current.some(key => visible(key) && layerOf(ink, key).past.length > 0);
  const canRedo = (visible: (key: string) => boolean) => redoKeys.current.some(key => visible(key) && layerOf(ink, key).future.length > 0);
  /** Clears each of these views that has ink: one undoable step in each. */
  const clear = useCallback((keys: Iterable<string>) => { for (const key of keys) if (layerOf(inkRef.current, key).strokes.length) commit(key, []); }, [commit]);
  /** Forgets undo history, when a whole new set of ink is loaded. */
  const resetHistory = useCallback(() => { undoKeys.current = []; redoKeys.current = []; }, []);

  const penSize = SIZES.find(s => s.value === prefs.penSize)!.pen, highlighterSize = SIZES.find(s => s.value === prefs.highlighterSize)!.highlighter;
  const settings = useMemo<AnnotationSettings>(() => ({ tool: prefs.tool, penColour: prefs.penColour, highlighterColour: prefs.highlighterColour, penSize, highlighterSize, straight: prefs.straight }), [prefs, penSize, highlighterSize]);
  const highlighter = prefs.tool === "highlighter";
  const cursor = (scale: number) => annotating ? toolCursor(prefs.tool, highlighter ? prefs.highlighterColour : prefs.penColour, highlighter ? highlighterSize : penSize, scale) : undefined;

  const chooseTool = useCallback((tool: AnnotationTool) => { now.current = { annotating: true, tool }; setPrefs(p => withTool(p, tool)); setAnnotating(true); }, []);
  const close = useCallback(() => { now.current = { ...now.current, annotating: false }; setAnnotating(false); }, []);
  /** The Annotate button: opens on the last drawing tool, or puts the pen down. */
  const toggle = () => (annotating ? close() : chooseTool(prefs.tool === "hand" ? "pen" : prefs.tool));

  /**
   * The pen's shortcuts: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, P (pick up or put down the pen), and while annotating
   * H, E, L, V and the colour numbers. Returns true when the key was the pen's. The page handles Escape.
   */
  const handleKey = useCallback((e: KeyboardEvent, visible?: (key: string) => boolean): boolean => {
    const k = e.key.toLowerCase();
    if (now.current.annotating && (e.ctrlKey || e.metaKey) && !e.altKey && (k === "z" || k === "y")) { e.preventDefault(); if (k === "y" || e.shiftKey) redo(visible); else undo(visible); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (k === "p") { e.preventDefault(); if (now.current.annotating && now.current.tool === "pen") close(); else chooseTool("pen"); return true; }
    if (!now.current.annotating) return false;
    const tool = TOOL_KEYS[k];
    if (tool) { e.preventDefault(); chooseTool(tool); return true; }
    const n = Number.parseInt(e.key, 10);
    const colours = now.current.tool === "highlighter" ? HIGHLIGHTER_COLOURS : PEN_COLOURS;
    const c = n >= 1 ? colours[n - 1] : undefined;
    if (!c) return false;
    e.preventDefault();
    setPrefs(p => (p.tool === "highlighter" ? { ...p, highlighterColour: c.value } : { ...withTool(p, "pen"), penColour: c.value }));
    return true;
  }, [undo, redo, close, chooseTool]);

  return { annotating, now, prefs, setPrefs, settings, cursor, chooseTool, close, toggle, handleKey, commit, undo, redo, canUndo, canRedo, clear, resetHistory, drawing: annotating && prefs.tool !== "hand" };
}
