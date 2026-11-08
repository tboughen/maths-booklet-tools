/**
 * Footer for the home, All tools and not-found pages (improvement list S4, S65): who runs the
 * site, what it is for, and a short privacy notice. Editors and the question bank keep their
 * full-height working areas, so they have no footer.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="About MathsDock">
      <div className="site-footer-inner">
        <section aria-labelledby="site-footer-about">
          <h2 id="site-footer-about">About</h2>
          <p>
            MathsDock is made by Tim Boughen for maths department staff. It is a
            staff-only site: you sign in with a code sent to your email.
          </p>
          <p>
            Spotted a mistake in a question, a mark scheme or a tool? Tell Tim,
            with the page address and what you expected to see.
          </p>
        </section>
        <section aria-labelledby="site-footer-privacy">
          <h2 id="site-footer-privacy">Privacy</h2>
          <p>
            No accounts, no analytics and no advertising. Signing in sets one
            Cloudflare Access cookie that proves you are signed in.
          </p>
          <p>
            Diagrams, papers and any results file you open in Assessment
            follow-up stay in your browser on this device. MathsDock never
            uploads them.
          </p>
          <p>
            The MathsDock diagram service for ChatGPT and Claude is separate: it
            only receives what the assistant sends it.
          </p>
        </section>
      </div>
    </footer>
  );
}
