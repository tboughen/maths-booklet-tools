import { useEffect, useId, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { RoomLayout } from "./model";

import { overlays, type Overlay } from "./overlays";

interface Props {
  value: Overlay;
  onChange: (value: Overlay) => void;
  room: RoomLayout;
  onRoomChange: (value: RoomLayout) => void;
}

function Palette({ value, onChange }: Pick<Props, "value" | "onChange">) {
  const name = useId();
  return <fieldset className="qb-overlay-palette">
    <legend>Overlay</legend>
    <div>{overlays.map(option => <label key={option.value} title={option.label}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)}/>
      <span className="qb-overlay-swatch" style={{ backgroundColor: option.colour }} aria-hidden="true">{value === option.value && <Check size={15}/>}</span>
      <span className="qb-overlay-name">{option.label}</span>
    </label>)}</div>
  </fieldset>;
}

export function OverlayControls({ value, onChange, room, onRoomChange }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const current = overlays.find(option => option.value === value)!;
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, []);
  const roomControl = <label className="qb-layout">Room <select aria-label="Room layout" value={room} onChange={event => onRoomChange(event.target.value as RoomLayout)}>
    <option value="auto">Auto</option><option value="single">Single view</option><option value="two">Two views</option>
  </select></label>;
  return <div className="qb-view-tools" onKeyDown={event => {
    // Arrow keys choose colours without navigating away from the question.
    event.stopPropagation();
    if (event.key === "Escape" && menu.current?.open) {
      event.preventDefault(); menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  }}>
    <div className="qb-overlay-inline">{roomControl}<Palette value={value} onChange={onChange}/></div>
    <details ref={menu} className="qb-overlay-menu">
      <summary className="qb-button" tabIndex={0} aria-label={`View options: overlay ${current.label}`}>
        <span className="qb-overlay-swatch" style={{ backgroundColor: current.colour }} aria-hidden="true"/>
        View <ChevronDown size={14}/>
      </summary>
      <div className="qb-overlay-panel"><Palette value={value} onChange={onChange}/>{roomControl}</div>
    </details>
  </div>;
}
