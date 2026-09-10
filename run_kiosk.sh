#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$SCRIPT_DIR/instalacion/run_debian.sh"
exec "$SCRIPT_DIR/instalacion/run_debian.sh" "$@"
