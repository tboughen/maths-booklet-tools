import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SurfaceOverlay } from "../../packages/worked-core/src/index";
import type { ServedParts } from "./cuts";
import type { BankQuestion, BankView, RoomLayout, ViewRole } from "./model";
import { questionResource } from "./resources";
import { useStageZoom } from "./useStageZoom";
import { addedHeight, type WorkedShown } from "./worked";
import { stepZoom } from "./zoom";

/** What one step of the viewer shows: a question page, or a part stacked under its stem and the parts it needs. */
export interface Slide {items: {pdf: string; view: BankView; worked?: boolean; overlay?: SurfaceOverlay}[]; width: number; height: number; label: string; repeatedContext?: string}
/** The gap between stacked cuts, in points. */
export const STACK_GAP = 12;

interface Options {
  role: ViewRole;
  /** Whether this pane is on screen. A pane that is not keeps its place but measures and listens to nothing. */
  shown: boolean;
  question: BankQuestion | undefined;
  /** The parts a topic matched, where the question is cut into parts. */
  served: ServedParts | undefined;
  /** Show only those parts (never applies to a mark scheme). */
  partsView: boolean;
  /** The loaded worked solution, for the worked solution pane only. */
  worked?: WorkedShown;
  /** The view asked for; it is kept within the views there are. */
  wanted: number;
  zoom: number;
  setZoom: (zoom: number) => void;
  fit: "page" | "width";
  room: RoomLayout;
  onSwipe: (direction: 1 | -1) => void;
  /** Gestures are on: there is a question and the viewer is in use. */
  enabled: boolean;
  /** A drawing tool is active. */
  drawing: boolean;
  /** Changes whenever the page around the stage is laid out differently, so the stage is measured again. */
  layout: string;
}

/**
 * One pane of the question viewer: the views of one role (question, mark scheme or worked solution)
 * for the current question, how they fit their stage, and that stage's zoom and pan. Each pane keeps
 * its own zoom and place, so the panes that are on can sit side by side.
 */
export function usePane({ role, shown, question, served, partsView, worked, wanted, zoom, setZoom, fit, room, onSwipe, enabled, drawing, layout }: Options) {
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 900, height: 500 });
  // Measured before the first paint, so a pane never draws at a size left over from another layout.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || !shown) return;
    const resize = () => setStageSize(previous => previous.width === el.clientWidth && previous.height === el.clientHeight ? previous : { width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(resize);
    observer.observe(el); resize();
    return () => observer.disconnect();
  }, [shown, layout]);

  // Asked for only while the pane is on screen: a worked solution that does not fit its question's revision throws.
  const resource = useMemo(() => question && shown ? questionResource(question, role) : undefined, [question, shown, role]);
  const partMode = role !== "scheme" && !!served && partsView;
  const views = useMemo<Slide[]>(() => {
    if (!shown) return [];
    if (role === "worked-solution") {
      const items = worked?.items;
      if (!items?.length) return [];
      return [{ items: items.map(item => ({ ...item, worked: true })), width: Math.max(...items.map(i => i.view.width)), height: items.reduce((n, i) => n + i.view.height + addedHeight(i.overlay), 0) + STACK_GAP * (items.length - 1), label: partMode && served ? `Worked solution · ${served.title}` : "Worked solution" }];
    }
    if (partMode && served) { const items = served.cuts.flatMap(s => s.cut.views.map(view => ({ pdf: s.cut.pdf, view }))); return [{ items, width: Math.max(...items.map(i => i.view.width)), height: items.reduce((n, i) => n + i.view.height, 0) + STACK_GAP * (items.length - 1), label: served.title }]; }
    return (resource?.views || []).map(view => ({ items: [{ pdf: resource!.pdf, view }], width: view.width, height: view.height, label: view.label, repeatedContext: view.repeatedContext }));
  }, [shown, partMode, served, resource, role, worked]);
  const viewIndex = Math.min(Math.max(0, wanted), Math.max(0, views.length - 1));
  const view = views[viewIndex] as Slide | undefined;
  const availablePair = views.slice(viewIndex, viewIndex + 2);
  const pairScale = availablePair.length === 2 ? Math.min((stageSize.width - 48) / availablePair.reduce((n, v) => n + v.width, 0), (stageSize.height - 32) / Math.max(...availablePair.map(v => v.height))) : 0;
  const two = availablePair.length === 2 && (room === "two" || (room === "auto" && stageSize.width >= 1500 && pairScale >= 1.3));
  const visibleViews = two ? availablePair : view ? [view] : [];
  const widthScale = visibleViews.length ? (stageSize.width - 32 - (two ? 16 : 0)) / visibleViews.reduce((n, v) => n + v.width, 0) : 1;
  const fitScale = visibleViews.length ? Math.min(widthScale, (stageSize.height - 32) / Math.max(...visibleViews.map(v => v.height))) : 1;
  const scale = Math.max(.01, (fit === "width" ? widthScale : fitScale) * zoom);
  const pannable = visibleViews.reduce((n, v) => n + v.width * scale, 0) + (two ? 16 : 0) + 32 > stageSize.width + 1 || Math.max(0, ...visibleViews.map(v => v.height * scale)) + 32 > stageSize.height + 1;
  const { requestZoom, panBy, forgetPlace } = useStageZoom({ stage, zoom, scale, setZoom, onSwipe, layoutKey: `${question?.id}|${role}|${viewIndex}|${two}|${partMode}`, shown, enabled: enabled && shown, drawing });
  const zoomStep = useCallback((direction: 1 | -1) => requestZoom(stepZoom(zoom, direction)), [requestZoom, zoom]);
  const zoomFit = useCallback(() => requestZoom(1), [requestZoom]);
  /** The screen-only ink layer of one view in this pane. */
  const inkKey = useCallback((item: { pdf: string; view: { page: number } }) => question ? `${question.id}|${question.revision}|${role}|${item.pdf}|${item.view.page}` : "", [question, role]);
  const visibleKeys = visibleViews.flatMap(v => v.items).map(inkKey).filter(Boolean);
  return { role, stage, resource, partMode, views, viewIndex, view, two, visibleViews, scale, zoom, pannable, panBy, forgetPlace, zoomStep, zoomFit, inkKey, visibleKeys };
}

export type Pane = ReturnType<typeof usePane>;
