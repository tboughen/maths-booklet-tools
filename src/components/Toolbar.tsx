import {
  ChevronDown,
  Copy,
  LoaderCircle,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Slash,
  Undo2,
  X,
} from "lucide-react";
import type { DrawingTool } from "../domain/types";

interface ToolbarProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onEquation: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  copying: boolean;
  onCopy: () => void;
  onToggleMenu: () => void;
}

const tools: Array<{ id: DrawingTool; label: string; help: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "Select", help: "Select and edit an object", icon: MousePointer2 },
  { id: "point", label: "Point", help: "Click to add a cross", icon: X },
  { id: "segment", label: "Segment", help: "Drag between two positions", icon: Slash },
];

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="editor-toolbar" aria-label="Graph tools">
      <div className="tool-group" role="group" aria-label="Drawing tool">
        {tools.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={`tool-button${props.tool === item.id ? " tool-button--active" : ""}`} aria-pressed={props.tool === item.id} title={item.help} onClick={() => props.onToolChange(item.id)}>
              <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <button className="tool-button equation-tool" onClick={props.onEquation} title="Create a new straight line from its equation"><Plus size={16} /><span>Line by equation</span></button>
      <span className="toolbar-rule" />
      <button className="icon-button" disabled={!props.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" onClick={props.onUndo}><Undo2 size={18} /></button>
      <button className="icon-button" disabled={!props.canRedo} aria-label="Redo" title="Redo (Ctrl+Y)" onClick={props.onRedo}><Redo2 size={18} /></button>
      <button className="tool-button reset-button" aria-label="Reset diagram" title="Reset the grid and remove all objects" onClick={props.onReset}><RotateCcw size={17} aria-hidden="true" /><span>Reset</span></button>
      <div className="toolbar-spacer" />
      <div className="copy-split">
        <button className="copy-main" disabled={props.copying} title="Recommended: copy a 600 ppi image sized for Word" onClick={props.onCopy}>
          {props.copying ? <LoaderCircle className="spin" size={17} /> : <Copy size={17} />}
          {props.copying ? "Preparing…" : "Copy for Word"}
        </button>
        <button className="copy-more" aria-label="Download options" aria-haspopup="menu" onClick={props.onToggleMenu}><ChevronDown size={16} /></button>
      </div>
    </div>
  );
}
