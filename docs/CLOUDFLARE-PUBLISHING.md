# MathsDock hosting and publishing

The browser app is served by Workers Static Assets. Reviewed PDFs and PNG previews live in the `maths-booklet-assets` R2 bucket at `https://assets.mathsdock.co.uk`. GitHub remains the source repository. The existing Pages workflow is retained during the migration for rollback.

## Local authentication

Run `scripts/cloudflare/credentials.ps1 -Action Configure` in PowerShell. Enter the Cloudflare account ID and bucket-scoped R2 Object Read & Write Access Key ID/Secret Access Key. Hidden inputs are stored using Windows DPAPI in `%LOCALAPPDATA%\MathsDock\r2-credentials.xml`, outside Git and OneDrive. The file is bound to this Windows user/computer. It cannot be used on a different machine; keep the original keys in your password manager.

Run `npm run cloudflare:login` for the one-time browser authorisation used by Wrangler. R2 S3 credentials and Workers deployment authentication are separate. Do not place either in source files, chat, screenshots, logs or command arguments.

## Release sequence

1. Finish the source changes and run `npm run build:cloudflare` followed by `npm run cloudflare:plan`.
2. Review the generated inventory. It includes exactly the catalogue's referenced assets. Each object key contains its SHA-256; identical bytes reuse one object. Original PDFs, PNGs and source catalogue are not rewritten.
3. Ensure the R2 CORS policy permits GET/HEAD from the production and actual preview origins. `scripts/cloudflare/cors.json` is the dashboard policy template. Read existing rules first, preserve them and add the actual preview origin; do not replace other projects' rules. Expose Accept-Ranges, Content-Length, Content-Range and ETag; permit the Range request header. The PDF worker, fonts and CMaps stay on the app's origin.
4. Run the encrypted-credential helper with `-Action Preview -Site https://mathsdock-preview.YOUR-SUBDOMAIN.workers.dev`. It runs service build, lint, unit tests, upload tests, typecheck and the separate Cloudflare build, then uploads/verifies assets before deploying the preview app. Existing immutable objects must match SHA-256 metadata, MD5 ETag, size, type and cache policy. Newly uploaded bytes are downloaded and hashed. Any failure stops publication. Nothing is deleted.
5. All public objects are checked for availability, ETag, size, type, immutable caching and CORS. Use `-Action VerifyAssets -Site PREVIEW_URL -Full` for byte-by-byte verification of every public asset. Review the live browser proof: question/scheme canvases, PNG preview, browser-generated compact/writing question and scheme PDF files, graph and ratio tools. The test captures the exact blob referenced by each clicked download button; native save-dialog/multiple-download policy is not tested. `CLOUDFLARE_SITE_URL=PREVIEW_URL npm run test:cloudflare:browser` uses real R2; the local test uses intercepted asset transport and is labelled accordingly.
6. After the preview is accepted, run `-Action Publish` to deploy `mathsdock.co.uk`. The production configuration changes only that custom domain. Then deploy `wrangler.redirect.jsonc` to redirect `.com` and both `www` addresses to the canonical `.co.uk`, preserving paths and query strings.
7. Verify the live catalogue and browser exports again before retiring GitHub Pages. Disable its deployment workflow only after the Cloudflare cutover is accepted. Keep the last Pages deployment available during the transition.

The helper can separately run `Upload`, `VerifyAssets` and `VerifySite`. `npm run cloudflare:publish -- --preview --site=PREVIEW_URL` is the equivalent environment-variable entry point; production omits `--preview`. These commands do not enable redirects automatically. Use Node 24, as specified in `.nvmrc`; the publisher uses Node's native TypeScript support.

## GitHub Actions

`.github/workflows/cloudflare.yml` is initially manual (`workflow_dispatch`). Create repository/environment secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Use a Workers deployment token limited to the correct account and needed permissions; its account-level rights may include other Workers, so it is not a single-Worker isolation boundary. R2 keys must be limited to the MathsDock bucket. Set an approval rule for the production environment if desired.

Select preview/production and supply the exact site URL. The workflow serialises deployments and does not cancel an in-progress upload. It performs the same checks and live browser exports, retaining a manifest and sanitized receipts for 14 days. Automatic main-branch publishing can be enabled after cutover by using this workflow; do not enable a second concurrent publisher.

## Rollback and retention

Keep prior R2 objects. A previous Workers deployment can be rolled back with Wrangler/dashboard because its catalogue still references immutable existing objects. Retained objects count toward account storage; pruning needs a separate inventory of all retained releases and explicit approval. The uploader has no deletion command. Changes to question bytes always produce a new URL; do not overwrite or purge immutable URLs to publish a correction.

An upload receipt proves upload completion, not a website deployment. The final deployment receipt is written only after live catalogue/route checks and actual browser export tests pass. Route/catalogue checks retry for up to two minutes to allow Cloudflare deployment propagation; a persistent failure still stops publishing without a success receipt. A failed post-deploy check is a release failure even if Cloudflare accepted the upload; inspect the deployment and roll back if needed. Do not infer success from an older receipt.

## Current dependency note

The inherited `pdfjs-dist` 5.6.205 triggers npm advisory GHSA-hq66-cqwq-w95j (viewer scripting). The website uses `getDocument`/canvas rendering, not the PDF viewer or its scripting manager, and sets `isEvalSupported: false`. The migration does not upgrade this major dependency. This note is not a claim that npm audit passes; a major renderer upgrade remains separate maintenance work.

References: [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/), [R2 SDK](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [PDF.js advisory](https://github.com/advisories/GHSA-hq66-cqwq-w95j).
