import { MousePointer2, Plus, Slash, X } from "lucide-react";
import type { DrawingTool } from "../domain/types";

const tools: Array<{
  id: DrawingTool;
  label: string;
  help: string;
  icon: typeof MousePointer2;
}> = [
  {
    id: "select",
    label: "Select",
    help: "Select and edit an object",
    icon: MousePointer2,
  },
  { id: "point", label: "Point", help: "Click to add a cross", icon: X },
  {
    id: "segment",
    label: "Segment",
    help: "Drag between two positions",
    icon: Slash,
  },
];

export function GraphTools({
  tool,
  onToolChange,
  onEquation,
}: {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onEquation: () => void;
}) {
  return (
    <section className="panel-card specialist-tools">
      <h2>Drawing tools</h2>
      <div className="tool-group" role="group" aria-label="Drawing tool">
        {tools.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`tool-button${tool === item.id ? " tool-button--active" : ""}`}
              aria-pressed={tool === item.id}
              title={item.help}
              onClick={() => onToolChange(item.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <button className="secondary-panel-button" onClick={onEquation}>
        <Plus size={16} aria-hidden="true" />
        <span>Line by equation</span>
      </button>
      <p className="panel-note">
        Choose a tool, then click or drag on the grid. Adjust its size at the
        axis ends.
      </p>
    </section>
  );
}
