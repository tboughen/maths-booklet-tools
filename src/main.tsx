import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import SiteApp from "./site/SiteApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
);
