import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { NOT_SAVED, openDraft, SAVED, SAVE_UNAVAILABLE, STORAGE_UNAVAILABLE, useDraftAutosave } from "./drafts";

const KEY = "maths-booklet-tools:test:v1";
const parse = (text: string) => {
  const v = JSON.parse(text) as { n?: unknown };
  if (typeof v.n !== "number") throw Error("bad");
  return v as { n: number };
};
const open = () => openDraft({ key: KEY, parse, fresh: () => ({ n: 0 }), recoveryMessage: "Needs recovery." });
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("openDraft", () => {
  it("opens the stored draft, or a fresh one when there is none", () => {
    expect(open()).toEqual({ document: { n: 0 }, recovery: null, message: "" });
    localStorage.setItem(KEY, '{"n":3}');
    expect(open()).toEqual({ document: { n: 3 }, recovery: null, message: "" });
  });
  it("keeps a draft it cannot read as recovery data and leaves it stored", () => {
    localStorage.setItem(KEY, '{"n":"three"}');
    expect(open()).toEqual({ document: { n: 0 }, recovery: '{"n":"three"}', message: "Needs recovery." });
    expect(localStorage.getItem(KEY)).toBe('{"n":"three"}');
  });
  it("says when device storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(open().message).toBe(STORAGE_UNAVAILABLE);
  });
});

describe("useDraftAutosave", () => {
  const hook = (text: string, paused = false, onConflict = vi.fn()) =>
    renderHook((p: { text: string; paused: boolean }) => useDraftAutosave({ key: KEY, text: p.text, paused: p.paused, onConflict }), { initialProps: { text, paused } });

  it("saves each change and reports it", () => {
    const { result, rerender } = hook('{"n":1}');
    expect(localStorage.getItem(KEY)).toBe('{"n":1}');
    expect(result.current.saveState).toBe(SAVED);
    rerender({ text: '{"n":2}', paused: false });
    expect(localStorage.getItem(KEY)).toBe('{"n":2}');
  });

  it("writes nothing while recovery data is shown", () => {
    localStorage.setItem(KEY, "kept");
    const { result } = hook('{"n":1}', true);
    expect(localStorage.getItem(KEY)).toBe("kept");
    expect(result.current.saveState).toBe(NOT_SAVED);
  });

  it("never overwrites another tab's newer draft", () => {
    const onConflict = vi.fn();
    const { result, rerender } = hook('{"n":1}', false, onConflict);
    localStorage.setItem(KEY, '{"n":9}');
    rerender({ text: '{"n":2}', paused: false });
    expect(onConflict).toHaveBeenCalledWith('{"n":9}', "newer");
    expect(localStorage.getItem(KEY)).toBe('{"n":9}');
    expect(result.current.saveState).toBe(NOT_SAVED);
  });

  it("guards the opened draft from the first save when told what it opened", () => {
    const onConflict = vi.fn();
    localStorage.setItem(KEY, '{"n":7}');
    renderHook(() => useDraftAutosave({ key: KEY, text: '{"n":1}', paused: false, onConflict, opened: '{"n":3}' }));
    expect(onConflict).toHaveBeenCalledWith('{"n":7}', "newer");
    expect(localStorage.getItem(KEY)).toBe('{"n":7}');
  });

  it("guards an empty start too: a draft saved meanwhile by another tab is kept", () => {
    const onConflict = vi.fn();
    localStorage.setItem(KEY, '{"n":7}');
    renderHook(() => useDraftAutosave({ key: KEY, text: '{"n":1}', paused: false, onConflict, opened: null }));
    expect(onConflict).toHaveBeenCalledWith('{"n":7}', "newer");
  });

  it("saves over the draft it opened", () => {
    localStorage.setItem(KEY, '{"n":3}');
    renderHook(() => useDraftAutosave({ key: KEY, text: '{"n":1}', paused: false, onConflict: vi.fn(), opened: '{"n":3}' }));
    expect(localStorage.getItem(KEY)).toBe('{"n":1}');
  });

  it("protects a draft another tab saves while this one is open", () => {
    const onConflict = vi.fn();
    hook('{"n":1}', false, onConflict);
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: '{"n":5}' })));
    expect(onConflict).toHaveBeenCalledWith('{"n":5}', "changed");
  });

  it("saves over protected data only when it is still the copy the teacher downloaded", () => {
    const onConflict = vi.fn();
    const { result, rerender } = hook('{"n":1}', false, onConflict);
    localStorage.setItem(KEY, '{"n":9}');
    rerender({ text: '{"n":2}', paused: false });
    rerender({ text: '{"n":2}', paused: true });
    expect(result.current.keepStored('{"n":8}')).toBe(false);
    expect(result.current.keepStored('{"n":9}')).toBe(true);
    rerender({ text: '{"n":2}', paused: false });
    expect(localStorage.getItem(KEY)).toBe('{"n":2}');
  });

  it("lets the teacher keep saving after another tab deleted the draft", () => {
    const onConflict = vi.fn();
    const { result, rerender } = hook('{"n":1}', false, onConflict);
    localStorage.removeItem(KEY);
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null })));
    expect(onConflict).toHaveBeenCalledWith("", "changed");
    rerender({ text: '{"n":1}', paused: true });
    expect(result.current.keepStored("")).toBe(true);
    rerender({ text: '{"n":2}', paused: false });
    expect(localStorage.getItem(KEY)).toBe('{"n":2}');
  });

  it("reports a save it cannot make", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("full");
    });
    const { result } = hook('{"n":1}');
    expect(result.current.saveState).toBe(SAVE_UNAVAILABLE);
  });
});
