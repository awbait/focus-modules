#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Building frontend..."
cd frontend
bun install --frozen-lockfile
bun run build
cd ..

echo "→ Building backend (linux/amd64)..."
cd backend
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o ../backend-linux .
cd ..

echo "→ Packaging ZIP..."
rm -f domovoy-control.zip

python3 -c "
import zipfile, os

files = [
    ('manifest.json',   'manifest.json'),
    ('dist/widget.js',  'widget.js'),
    ('migrations.sql',  'migrations.sql'),
    ('backend-linux',   'backend'),
]

with zipfile.ZipFile('domovoy-control.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for src, arc in files:
        info = zipfile.ZipInfo(arc)
        if arc == 'backend':
            info.external_attr = 0o755 << 16  # chmod +x
        with open(src, 'rb') as f:
            z.writestr(info, f.read())
        print(f'  + {arc}')
print('ZIP ready:', round(os.path.getsize('domovoy-control.zip') / 1024), 'KB')
"

rm backend-linux
