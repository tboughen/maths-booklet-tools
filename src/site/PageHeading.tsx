import type { ReactNode } from "react";

export function PageHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading">
    <div><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div>
    {children && <div className="page-heading-actions">{children}</div>}
  </div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`site-panel ${className}`}>{children}</div>;
}
