import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref, siteSections } from "./registry";

/** Shown for mistyped, retired or unknown addresses. */
export function NotFound() {
  return (
    <main className="site-overview site-not-found" id="main-content" tabIndex={-1}>
      <PageHeading
        title="We couldn't find that page"
        description="The address may be mistyped, or the page may have moved. Choose where to go next."
      />
      <nav aria-label="Where to go next" className="site-not-found-links">
        <a href={pageHref("home")}>Home</a>
        {siteSections.map((section) => (
          <a key={section.id} href={section.href}>
            {section.name}
          </a>
        ))}
      </nav>
      <h2>Booklet tools</h2>
      <ul className="site-not-found-tools">
        {bookletTools.map((tool) => (
          <li key={tool.id}>
            <a href={pageHref(tool.id)}>{tool.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
