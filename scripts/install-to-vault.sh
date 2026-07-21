#!/usr/bin/env bash
# Daily Echoes for Obsidian
# Copyright (C) 2026 Wojciech Polak
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

#
# Copy the built plugin into a local Obsidian vault for testing.
# Run with --help for usage.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
	cat <<-EOF
	Copy the built plugin into a local Obsidian vault for testing.

	Reads OBSIDIAN_VAULT_PLUGINS (the vault's .obsidian/plugins directory) from
	.env in the repo root. The destination subfolder is taken from manifest.json's
	\`id\`, so it stays correct if the plugin is ever renamed.

	Usage:
	  ./scripts/install-to-vault.sh              # copy existing build
	  ./scripts/install-to-vault.sh --build      # run \`npm run build\` first
	  ./scripts/install-to-vault.sh --dry-run    # show what would happen
	EOF
}

BUILD=0
DRY_RUN=0
for arg in "$@"; do
	case "$arg" in
		--build) BUILD=1 ;;
		--dry-run) DRY_RUN=1 ;;
		-h|--help) usage; exit 0 ;;
		*) echo "error: unknown option '$arg' (try --help)" >&2; exit 2 ;;
	esac
done

# --- Load .env -------------------------------------------------------------
if [[ ! -f .env ]]; then
	cat >&2 <<-EOF
	error: .env not found in $ROOT
	Create it with the path to your vault's plugins folder, e.g.

	  OBSIDIAN_VAULT_PLUGINS="\$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/YourVault/.obsidian/plugins/"
	EOF
	exit 1
fi

# Parse .env rather than `source`-ing it: sourcing would execute whatever the
# file contains, and we only ever need one plain value out of it.
OBSIDIAN_VAULT_PLUGINS=""
while IFS='=' read -r key value || [[ -n "$key" ]]; do
	key="${key#"${key%%[![:space:]]*}"}"   # trim leading whitespace
	key="${key#export }"
	[[ -z "$key" || "$key" == \#* ]] && continue
	[[ "$key" != "OBSIDIAN_VAULT_PLUGINS" ]] && continue
	value="${value%"${value##*[![:space:]]}"}"   # trim trailing whitespace
	# Strip one layer of matching quotes, if present.
	if [[ "$value" == \"*\" ]]; then
		value="${value:1:${#value}-2}"
	elif [[ "$value" == \'*\' ]]; then
		value="${value:1:${#value}-2}"
	fi
	OBSIDIAN_VAULT_PLUGINS="$value"
done < .env

if [[ -z "${OBSIDIAN_VAULT_PLUGINS:-}" ]]; then
	echo "error: OBSIDIAN_VAULT_PLUGINS is not set in .env" >&2
	exit 1
fi

# Strip any trailing slash so we can join paths predictably.
PLUGINS_DIR="${OBSIDIAN_VAULT_PLUGINS%/}"

if [[ ! -d "$PLUGINS_DIR" ]]; then
	echo "error: plugins folder does not exist: $PLUGINS_DIR" >&2
	echo "hint: enable Community plugins in Obsidian, or create the folder yourself." >&2
	exit 1
fi

# --- Build (optional) ------------------------------------------------------
if (( BUILD )); then
	echo "==> npm run build"
	if (( DRY_RUN )); then
		echo "    (skipped: --dry-run)"
	else
		npm run build
	fi
fi

# --- Resolve destination ---------------------------------------------------
PLUGIN_ID="$(node -p "require('./manifest.json').id")"
DEST="$PLUGINS_DIR/$PLUGIN_ID"

ASSETS=(main.js manifest.json styles.css)

missing=()
for f in "${ASSETS[@]}"; do
	[[ -f "$f" ]] || missing+=("$f")
done
if (( ${#missing[@]} )); then
	echo "error: missing build artifact(s): ${missing[*]}" >&2
	echo "hint: run 'npm run build' (or re-run this script with --build)." >&2
	exit 1
fi

# --- Copy ------------------------------------------------------------------
echo "==> plugin : $PLUGIN_ID"
echo "==> dest   : $DEST"

if (( DRY_RUN )); then
	for f in "${ASSETS[@]}"; do
		echo "    would copy $f"
	done
	echo "(dry run: nothing written)"
	exit 0
fi

mkdir -p "$DEST"
for f in "${ASSETS[@]}"; do
	cp "$f" "$DEST/"
	echo "    copied $f"
done

echo
echo "Done. In Obsidian: Settings -> Community plugins -> reload, then enable \"$(node -p "require('./manifest.json').name")\"."
echo "If it was already enabled, toggle it off and on (or reload the vault) to pick up the new build."
