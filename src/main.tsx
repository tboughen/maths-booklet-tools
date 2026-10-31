import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import SiteApp from "./site/SiteApp";
import { preloadPage, readPage } from "./site/registry";

// Load the opening page's code first so it renders, and saves its draft, without a loading state.
const render = () =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <SiteApp />
    </StrictMode>,
  );
Promise.resolve(preloadPage(readPage(location.search))).then(render, render);
