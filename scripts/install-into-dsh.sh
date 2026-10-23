#!/bin/sh
# Pack both plugins. See INSTALL.md. Arguments are passed through.
set -eu
cd "$(dirname "$0")/.."
exec node ./scripts/install-into-dsh.mjs "$@"
