# Cuboids

Cuboids creates black-on-white exam diagrams, visible-face cube grids and separated horizontal layers. The browser is independent of the optional MCP service. There is no new service adapter in this release.

## Editing

Select a cuboid in the inspector. Click a visible label to edit it directly. Dimension labels edit their underlying length; editing a face label creates custom text. The Labels panel can hide a label, retain an answer line, use a dimension/face area, or supply custom text. Hidden targets are available explicitly. Enter applies, Escape restores, and invalid drafts remain available while other edits and exports are blocked.

The dimensions describe real lengths. Units convert exactly between cm, mm and m; calculations use rational arithmetic. Positive dimensions are bounded from 0.01 to 10,000 cm after conversion. Explicit Cube keeps all three edges equal. Unlabelled or symbolic diagrams may use retained schematic drawing proportions; numeric diagrams share a physical scale when combined. Cube views always use the actual dimensions.

Show 1 cm³ cubes selects side 1 cm. Cube size and counts allows another cube size, expressed in the shape's unit. All three edges must divide exactly by that side; fractional edge quotients are rejected. A cube of side 2 cm represents 8 cm³, not 1 cm³. Separate layers reveals interior cubes and retains a Full height label without measuring the artificial gaps. Counts, layer numbers, volume and surface area are separate explicit teaching choices; defaults do not add answers.

Up to three independent cuboids are supported. Multiple diagrams sit side by side where at least 7 cm per diagram is available, otherwise stack. Add/remove and all document edits are undoable. Structure controls are in blue space below the clean white resource.

## Print and boundaries

Use the shared toolbar: image-only Copy to clipboard, Copy for Word, PNG (600 ppi), portable SVG and editable JSON. Preview zoom does not change physical size. Print width is 4–18 cm for the whole resource; height follows its complete artwork. Default width is 10 cm. Typography is 11 pt at physical size; main edges 0.25 mm, grid/hidden edges 0.15 mm. Labels and captions remain black and faces white.

Cube views support at most 40 cubes per axis and 10,000 per cuboid; separated layers supports at most 20 layers. Each printed front-face cell must be at least 2 mm. Image output is bounded to 64 million pixels at 600 ppi and 150 cm height. No view silently substitutes a sample for the complete shape. Unsupported decomposition retains the previous valid view; undersized output explains how to enlarge it or choose larger cubes. Editable saving remains available when an otherwise valid document cannot yet print legibly.

PNG download retains density metadata. Chrome's clipboard read-back strips density metadata while preserving pixels; Copy for Word supplies explicit centimetre dimensions through the existing sized-HTML route. Real Word insertion and physical printer review are still teacher acceptance checks.

## Persistence and examples

Storage key: `maths-booklet-tools:cuboids:v1`. Files use tool `cuboids`, schema 1, renderer `cuboids-1`; stable shape IDs and explicit label states. Valid edits autosave. Corrupt and newer-tab drafts are protected until their recovery data is downloaded. Switching tools retains pending inputs and Undo history; inactive tools do not handle shortcuts or imports.

Four generic examples preserve scaffold/explicit-worked distinctions. Six source examples use verified catalogue IDs; the supplied questions and complete relevant official scheme rows were personally inspected. The six-cube arrangement is one valid arrangement; equal-area and melting resources deliberately support only stated steps of their original questions. No source question, scheme or mapping was changed.

The All tools card uses the real renderer and its editable sample is `docs/cuboid-examples/card-preview.json`. The creation brief and review evidence are in the workspace's `reports/mathsdock-cuboids-plan-2026-10-14` and `reports/mathsdock-cuboids-preview-2026-10-14` folders.

The website release follows the existing checked publication workflow. Release receipts and live verification belong in `reports/mathsdock-cuboids-publish-2026-10-15` in the parent workspace. No MCP/tool-definition deployment is included. Reconcile newer production changes before subsequent releases.
