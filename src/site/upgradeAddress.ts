import { upgradeLegacyLink } from "./routes";

// Imported first by main.tsx so every module reads the path form of the address.
// Old `?tool=` links (bookmarks, booklets, MCP editor links) keep working.
const upgraded = upgradeLegacyLink(location.href);
if (upgraded) history.replaceState(history.state, "", upgraded);
