#!/usr/bin/env bash
# Refresh public/forms/i-864.pdf from USCIS and run it through qpdf so
# pdf-lib can read the page tree. The raw USCIS PDF has broken object refs
# (XFA/LiveCycle quirks) that crash pdf-lib on getPages().
#
# Requires: qpdf (brew install qpdf)
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p public/forms
TMP=$(mktemp -d)

echo "downloading i-864..."
curl -sSL -o "$TMP/i-864.pdf" "https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf"

echo "decrypting + linearizing with qpdf..."
qpdf --decrypt --object-streams=disable "$TMP/i-864.pdf" public/forms/i-864.pdf

echo "done: $(ls -la public/forms/i-864.pdf | awk '{print $5}') bytes"
rm -rf "$TMP"
