#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

"$project_root/scripts/local/fp-daily.sh"
"$project_root/scripts/build-site.sh"
