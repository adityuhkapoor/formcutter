#!/usr/bin/env bash
# Refresh USCIS form PDFs and preprocess them so pdf-lib can load the page tree
# (XFA-encoded source PDFs ship with broken object refs; qpdf cleans them up).
#
# Requires: qpdf (brew install qpdf)
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p public/forms
TMP=$(mktemp -d)

FORMS=(
  "i-864"
  "i-130"
  "i-485"
  "n-400"
  "i-589"
  "i-765"
  "i-821"
)

for form in "${FORMS[@]}"; do
  echo "downloading $form..."
  curl -sSL -o "$TMP/$form.pdf" "https://www.uscis.gov/sites/default/files/document/forms/$form.pdf"
  echo "  preprocessing $form with qpdf..."
  qpdf --decrypt --object-streams=disable "$TMP/$form.pdf" "public/forms/$form.pdf"
  size=$(ls -la "public/forms/$form.pdf" | awk '{print $5}')
  echo "  -> public/forms/$form.pdf ($size bytes)"
done

rm -rf "$TMP"
echo "done"
