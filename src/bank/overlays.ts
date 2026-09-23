export const overlays = [
  { value: "off", label: "Off", colour: "#FFFFFF" },
  { value: "yellow", label: "Yellow", colour: "#FFF8CF" },
  { value: "blue", label: "Blue", colour: "#EDF7FB" },
  { value: "green", label: "Green", colour: "#EEF8ED" },
  { value: "lilac", label: "Lilac", colour: "#F4EFFB" },
] as const;
export type Overlay = typeof overlays[number]["value"];
export function overlayPreference(): Overlay {
  try {
    const saved = localStorage.getItem("qb-overlay");
    return overlays.find(option => option.value === saved)?.value ?? "off";
  } catch { return "off"; }
}

