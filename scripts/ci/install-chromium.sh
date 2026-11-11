#!/usr/bin/env bash
# Installs Playwright's Chromium without depending on Ubuntu's apt mirrors.
# GitHub's ubuntu-latest image already ships Google Chrome, so Chromium's shared libraries are
# normally present. apt runs only when the browser is missing a library, and then retries, so an
# apt mirror or DNS outage no longer fails every pull request.
set -euo pipefail

npx playwright install chromium

browsers="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
missing=""
while IFS= read -r binary; do
  missing+="$(ldd "$binary" 2>/dev/null | grep 'not found' || true)"
done < <(find "$browsers" -type f \( -name chrome -o -name chrome-headless-shell \) -perm -u+x)

if [ -z "$missing" ]; then
  echo "Chromium's system libraries are already installed; skipping apt."
  exit 0
fi

echo "Chromium is missing these libraries:"
echo "$missing"
for attempt in 1 2 3; do
  if npx playwright install-deps chromium; then exit 0; fi
  echo "::warning::apt could not install Chromium's libraries (attempt $attempt of 3)."
  sleep $((attempt * 20))
done
echo "::error::Chromium's system libraries could not be installed from apt."
exit 1
