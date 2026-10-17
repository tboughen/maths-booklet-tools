import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DownloadAction {
  label: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  description?: string;
  success?: string;
  separator?: boolean;
  picker?: boolean;
}
export const LINK_DESCRIPTION =
  "Anyone with the link can open the saved resource, including hidden answers.";

/** One active, viewport-bounded menu. Import/recovery dialogs stay outside it. */
export function EditorDownloadMenu({
  id,
  open,
  active = true,
  onClose,
  actions,
  onMessage,
  onBusyChange,
}: {
  id: string;
  open: boolean;
  active?: boolean;
  onClose: () => void;
  actions: DownloadAction[];
  onMessage: (message: string, error?: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const invoking = useRef(false);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 300,
    width: 300,
  });
  const callbacks = useRef({ onClose, active, open });
  callbacks.current = { onClose, active, open };
  const trigger = useCallback(
    () =>
      globalThis.document.querySelector<HTMLButtonElement>(
        `button[aria-controls="${id}"]`,
      ),
    [id],
  );
  const close = (focus = false) => {
    const restore = focus && callbacks.current.open;
    callbacks.current.onClose();
    if (restore)
      requestAnimationFrame(() => {
        if (callbacks.current.active) trigger()?.focus({ preventScroll: true });
      });
  };
  useLayoutEffect(() => {
    if (!open || !active) return;
    const place = () => {
      const rect = trigger()?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const topEdge = viewport?.offsetTop ?? 0,
        leftEdge = viewport?.offsetLeft ?? 0;
      const height = viewport?.height ?? innerHeight,
        width = viewport?.width ?? innerWidth;
      const menuWidth = Math.min(300, width - 16);
      const below = topEdge + height - rect.bottom - 16;
      const above = rect.top - topEdge - 16;
      const useBelow = below >= Math.min(280, above);
      const maxHeight = Math.max(
        48,
        Math.min(height - 16, useBelow ? below : above),
      );
      const measured = Math.min(menu.current?.scrollHeight ?? 320, maxHeight);
      const desiredTop = useBelow ? rect.bottom + 4 : rect.top - measured - 4;
      setPosition({
        top: Math.max(
          topEdge + 8,
          Math.min(desiredTop, topEdge + height - measured - 8),
        ),
        left: Math.max(
          leftEdge + 8,
          Math.min(rect.right - menuWidth, leftEdge + width - menuWidth - 8),
        ),
        maxHeight,
        width: menuWidth,
      });
    };
    place();
    const frame = requestAnimationFrame(() => {
      const items = menu.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      const last = trigger()?.dataset.menuFocus === "last";
      (last ? items?.[items.length - 1] : items?.[0])?.focus();
      place();
    });
    const outside = (e: PointerEvent) => {
      const node = e.target as Node;
      if (!menu.current?.contains(node) && !trigger()?.contains(node))
        callbacks.current.onClose();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, active, trigger]);
  useLayoutEffect(() => {
    if (!active && open) callbacks.current.onClose();
  }, [active, open]);
  if (!open || !active) return null;
  async function invoke(item: DownloadAction) {
    if (invoking.current || item.disabled) return;
    invoking.current = true;
    setBusy(true);
    onBusyChange?.(true);
    let success = false;
    try {
      await item.action();
      success = true;
      if (item.success) onMessage(item.success);
    } catch (error) {
      onMessage(
        error instanceof Error
          ? error.message
          : "This action could not be completed. Try again or save an editable file.",
        true,
      );
    } finally {
      invoking.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
    if (success) close(!item.picker);
    else
      requestAnimationFrame(() => {
        if (callbacks.current.active && callbacks.current.open) {
          [
            ...(menu.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) ?? []),
          ]
            .find(
              (button) =>
                button.querySelector("strong")?.textContent === item.label,
            )
            ?.focus();
        }
      });
  }
  return createPortal(
    <div
      ref={menu}
      id={id}
      className="resource-download-menu"
      role="menu"
      aria-label="File"
      aria-busy={busy}
      style={position}
      onKeyDown={(e) => {
        const items = [
          ...(menu.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? []),
        ];
        const index = items.indexOf(
          globalThis.document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length;
          items[next]?.focus();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          const button = trigger();
          const focusable = [
            ...globalThis.document.querySelectorAll<HTMLElement>(
              'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
            ),
          ].filter(
            (el) =>
              !menu.current?.contains(el) &&
              el.getClientRects().length &&
              !el.closest("[hidden],[inert]"),
          );
          const start = button ? focusable.indexOf(button) : -1;
          close();
          focusable[start + (e.shiftKey ? -1 : 1)]?.focus();
        }
      }}
    >
      {actions.map((item, index) => (
        <div key={item.label}>
          {item.separator && <div role="separator" />}
          <button
            role="menuitem"
            aria-label={item.label}
            aria-describedby={
              item.description ? `${id}-description-${index}` : undefined
            }
            tabIndex={-1}
            disabled={busy || item.disabled}
            onClick={() => void invoke(item)}
          >
            <strong>{item.label}</strong>
            {item.description && (
              <small id={`${id}-description-${index}`}>
                {item.description}
              </small>
            )}
          </button>
        </div>
      ))}
    </div>,
    globalThis.document.body,
  );
}
