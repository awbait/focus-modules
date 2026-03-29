#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MODULE_ID="example-counter"
OUT_DIR="dist"

echo "==> Building $MODULE_ID..."

# Clean
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# 1. Frontend: bundle TSX → widget.js
echo "  -> Building frontend..."
cd frontend
bun install --frozen-lockfile
bun run build
cp dist/widget.js "../$OUT_DIR/widget.js"
cd ..

# 2. Backend: compile Go binary (static, Linux amd64)
echo "  -> Building backend..."
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o "../$OUT_DIR/backend" .
cd ..

# 3. Copy assets
echo "  -> Copying assets..."
cp manifest.json "$OUT_DIR/"
cp migrations.sql "$OUT_DIR/"
mkdir -p "$OUT_DIR/locales"
cp locales/*.json "$OUT_DIR/locales/"
[ -f preview.png ] && cp preview.png "$OUT_DIR/" || true

# 4. Package ZIP
echo "  -> Packaging ZIP..."
cd "$OUT_DIR"
zip -r "../${MODULE_ID}.zip" manifest.json widget.js backend migrations.sql locales/
cd ..

echo "==> Done: ${MODULE_ID}.zip ($(du -h "${MODULE_ID}.zip" | cut -f1))"
