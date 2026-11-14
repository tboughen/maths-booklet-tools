import { ExternalLink, X } from "lucide-react";

/** One-time Windows Word setup so pasted diagrams keep their full 600 ppi (shared by every File menu, U4). */
export function WordSetupDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="word-help-backdrop" onMouseDown={onClose}>
      <section
        className="word-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-help-title"
        aria-describedby="word-help-description"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <header>
          <div>
            <p className="eyebrow">ONE-TIME SETUP</p>
            <h2 id="word-help-title">Keep full image quality in Word</h2>
          </div>
          <button className="word-help-dismiss" autoFocus aria-label="Close Word setup" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <p id="word-help-description">
          Set this once in Windows desktop Word so pasted diagrams keep all 600 pixels per inch.
        </p>
        <ol>
          <li>
            Open <strong>File › Options › Advanced</strong>.
          </li>
          <li>
            Find <strong>Image Size and Quality</strong> and choose <strong>All New Documents</strong>.
          </li>
          <li>
            Tick <strong>Do not compress images in file</strong>.
          </li>
          <li>
            Set <strong>Default resolution</strong> to <strong>High fidelity</strong>.
          </li>
        </ol>
        <div className="word-help-links">
          <a
            href="https://support.microsoft.com/en-au/office/change-the-default-resolution-for-inserting-pictures-in-office-f4aca5b4-6332-48c6-9488-bf5e0094a7d2"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft: change image resolution <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a
            href="https://support.microsoft.com/en-au/office/turn-off-picture-compression-81a6b603-0266-4451-b08e-fc1bf58da658"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft: turn off compression <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        <button className="word-help-done" onClick={onClose}>
          Done
        </button>
      </section>
    </div>
  );
}
