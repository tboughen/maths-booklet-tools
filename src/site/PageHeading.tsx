import { embeddedInBooklet, resourceCopyId } from "./copyDocument";
import { useContext, type ReactNode } from "react";
import { bookletTools } from "./registry";
import { ToolPageContext, useToolSwitcher } from "./toolPage";

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  // On a diagram tool's page the heading is also the way to every other tool.
  const toolId = useContext(ToolPageContext);
  const tool = bookletTools.find((item) => item.id === toolId);
  // It loads with the tool's page. If that failed, the heading stays the plain name.
  const ToolSwitcher = useToolSwitcher();
  return (
    <div className="page-heading">
      <div>
        {/* Inside the Booklet builder's diagram dialog the tool cannot switch to another tool. */}
        {tool && ToolSwitcher && !embeddedInBooklet ? <ToolSwitcher tool={tool} title={title} /> : <h1 tabIndex={-1}>{title}</h1>}
        {resourceCopyId && (
          <span className="worked-copy-badge">{embeddedInBooklet ? "Copy for the booklet card" : "Separate worked copy"}</span>
        )}
        <p>{description}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`site-panel ${className}`}>{children}</div>;
}
