#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_ICON_DIR="$ROOT_DIR/public/icons/wiki"
SCAN_DIRS=("$ROOT_DIR/src" "$ROOT_DIR/public")
URL_PATTERN="https://runescape\\.wiki/(images|w/Special:FilePath)/[^\"'[:space:];]+"
MANIFEST_FILE=""
FAILED_URLS_FILE="$PUBLIC_ICON_DIR/download-failures.txt"

cleanup() {
  if [[ -n "${MANIFEST_FILE:-}" && -f "$MANIFEST_FILE" ]]; then
    rm -f "$MANIFEST_FILE"
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

extract_source_name() {
  local url="$1"
  local clean_url="${url%%\?*}"
  local path_part=""

  if [[ "$clean_url" == *"/images/thumb/"* ]]; then
    path_part="${clean_url#*"/images/thumb/"}"
    path_part="${path_part%%/*}"
  elif [[ "$clean_url" == *"/images/"* ]]; then
    path_part="${clean_url#*"/images/"}"
  elif [[ "$clean_url" == *"/w/Special:FilePath/"* ]]; then
    path_part="${clean_url#*"/w/Special:FilePath/"}"
  else
    path_part="${clean_url##*/}"
  fi

  if [[ -z "$path_part" ]]; then
    path_part="icon.png"
  fi

  printf '%s' "$path_part"
}

sanitize_filename() {
  local url="$1"
  local source_name extension stem decoded

  source_name="$(extract_source_name "$url")"
  extension=".${source_name##*.}"

  if [[ "$source_name" != *.* ]]; then
    extension=".png"
    stem="$source_name"
  else
    stem="${source_name%.*}"
  fi

  stem="${stem%_icon}"

  decoded="$(printf '%s' "$stem" | perl -MURI::Escape -ne 'print uri_unescape($_)')"
  decoded="${decoded//\'/}"
  decoded="${decoded//&/ and }"
  decoded="$(printf '%s' "$decoded" | tr '[:upper:]' '[:lower:]')"
  decoded="$(printf '%s' "$decoded" | sed -E 's/[()]/ /g; s/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"

  if [[ -z "$decoded" ]]; then
    decoded="icon"
  fi

  printf '%s%s' "$decoded" "$extension"
}

resolve_download_url() {
  local url="$1"

  case "$url" in
    "https://runescape.wiki/w/Special:FilePath/Glacial_Embrace.png")
      printf '%s' "https://runescape.wiki/images/Glacial_Embrace_%28self_status%29.png"
      ;;
    "https://runescape.wiki/w/Special:FilePath/Instability.png")
      printf '%s' "https://runescape.wiki/images/Instability_%28self_status%29.png"
      ;;
    "https://runescape.wiki/w/Special:FilePath/Rampage.png")
      printf '%s' "https://runescape.wiki/images/Rampage_%28self_status%29.png"
      ;;
    "https://runescape.wiki/w/Special:FilePath/Soulfire.png")
      printf '%s' "https://runescape.wiki/images/Soulfire.gif"
      ;;
    *)
      printf '%s' "$url"
      ;;
  esac
}

resolve_local_filename() {
  local source_url="$1"

  case "$source_url" in
    "https://runescape.wiki/w/Special:FilePath/Soulfire.png")
      printf '%s' "soulfire.gif"
      ;;
    *)
      sanitize_filename "$source_url"
      ;;
  esac
}

download_icon() {
  local url="$1"
  local destination="$2"

  if [[ -f "$destination" ]]; then
    return 0
  fi

  if curl --fail --location --silent --show-error --ssl-no-revoke "$url" --output "$destination"; then
    return 0
  fi

  if curl --fail --location --silent --show-error "$url" --output "$destination"; then
    return 0
  fi

  rm -f "$destination"
  return 1
}

list_files_with_literal() {
  local needle="$1"

  if has_command rg; then
    rg -l -F "$needle" "${SCAN_DIRS[@]}"
    return
  fi

  grep -r -l -F --include='*.ts' --include='*.html' --include='*.scss' --include='*.json' --include='*.md' "$needle" "${SCAN_DIRS[@]}" 2>/dev/null || true
}

list_wiki_urls() {
  if has_command rg; then
    rg -o --no-filename --pcre2 "$URL_PATTERN" "${SCAN_DIRS[@]}" | sort -u
    return
  fi

  grep -r -h -E -o --include='*.ts' --include='*.html' --include='*.scss' --include='*.json' --include='*.md' "$URL_PATTERN" "${SCAN_DIRS[@]}" | sort -u
}

rewrite_references() {
  local source_url="$1"
  local local_path="$2"

  while IFS= read -r file_path; do
    [[ -n "$file_path" ]] || continue
    OLD_URL="$source_url" NEW_PATH="$local_path" \
      perl -0pi -e 's/\Q$ENV{OLD_URL}\E/$ENV{NEW_PATH}/g' "$file_path"
  done < <(list_files_with_literal "$source_url")
}

main() {
  trap cleanup EXIT
  require_command curl
  require_command perl
  require_command sed
  mkdir -p "$PUBLIC_ICON_DIR"

  MANIFEST_FILE="$(mktemp)"
  : > "$FAILED_URLS_FILE"

  mapfile -t wiki_urls < <(list_wiki_urls)

  if [[ "${#wiki_urls[@]}" -eq 0 ]]; then
    echo "No RuneScape Wiki asset URLs found."
    return
  fi

  echo "Found ${#wiki_urls[@]} RuneScape Wiki asset URLs."
  if ! has_command rg; then
    echo "ripgrep not found; using grep fallback."
  fi

  local downloaded_count=0
  local failed_count=0

  for source_url in "${wiki_urls[@]}"; do
    download_url="$(resolve_download_url "$source_url")"
    local_name="$(resolve_local_filename "$source_url")"
    local_relative_path="/icons/wiki/${local_name}"
    local_destination="$ROOT_DIR/public${local_relative_path}"

    if download_icon "$download_url" "$local_destination"; then
      printf '%s\t%s\n' "$source_url" "$local_relative_path" >> "$MANIFEST_FILE"
      downloaded_count=$((downloaded_count + 1))
    else
      printf '%s\n' "$source_url" >> "$FAILED_URLS_FILE"
      echo "Skipped unresolved asset: $source_url" >&2
      failed_count=$((failed_count + 1))
    fi
  done

  while IFS=$'\t' read -r source_url local_relative_path; do
    rewrite_references "$source_url" "$local_relative_path"
  done < "$MANIFEST_FILE"

  echo "Downloaded $downloaded_count icons into $PUBLIC_ICON_DIR"
  echo "Rewrote references for downloaded icons to local /icons/wiki/... paths"

  if [[ "$failed_count" -gt 0 ]]; then
    echo "$failed_count icons could not be downloaded. See $FAILED_URLS_FILE"
  else
    rm -f "$FAILED_URLS_FILE"
  fi
}

main "$@"
