/** Saving has its own quiet live region; operation feedback uses role=status. */
export function ResourceSaveStatus({
  text,
  state,
}: {
  text: string;
  state?: "saved" | "saving" | "error" | "pending";
}) {
  const kind =
    state ??
    (text === "Saved on this device"
      ? "saved"
      : text === "Saving…"
        ? "saving"
        : "error");
  return (
    <span
      className={`resource-save-status resource-save-status--${kind}`}
      aria-live="polite"
    >
      <span aria-hidden="true" />
      {text}
    </span>
  );
}
