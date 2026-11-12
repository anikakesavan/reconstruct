#!/usr/bin/env bash
# One-time setup for the reconstruction service. Run from services/reconstruction.
# Python 3.10 to 3.13. Model weights (about 0.5 GB + 1.3 GB) download on the first scan.
set -euo pipefail
cd "$(dirname "$0")/.."
DA3_COMMIT=3d835ec1a5802d64a8b8b15f817a1ab54809bfe4

python -m pip install -r requirements.txt
mkdir -p third_party
if [ ! -d third_party/Depth-Anything-3/.git ]; then
  git clone https://github.com/ByteDance-Seed/Depth-Anything-3.git third_party/Depth-Anything-3
fi
git -C third_party/Depth-Anything-3 fetch --quiet origin
git -C third_party/Depth-Anything-3 checkout --quiet "$DA3_COMMIT"
echo "Done. Start the service with: uvicorn app.main:app --port 8000"
