#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [since-commit]" >&2
  exit 2
fi

trufflehog="${TRUFFLEHOG_BIN:-trufflehog}"
result="$(mktemp)"
error="$(mktemp)"
trap 'rm -f "$result" "$error"' EXIT

args=(git "file://$(git rev-parse --show-toplevel)" --branch HEAD
  --no-verification --results=unverified --json --no-update
  --fail-on-scan-errors --log-level=-1)
if [ "$#" -eq 1 ]; then
  git cat-file -e "$1^{commit}"
  args+=(--since-commit "$1")
fi

if ! "$trufflehog" "${args[@]}" >"$result" 2>"$error"; then
  echo "TruffleHog failed; inspect the scan locally without publishing raw output." >&2
  exit 2
fi

python3 - "$result" <<'PY'
import collections
import json
import sys

with open(sys.argv[1], encoding="utf-8") as output:
    findings = [json.loads(line) for line in output if line.strip()]

print(f"TruffleHog: {len(findings)} unverified candidates (verification disabled).")
for name, count in sorted(collections.Counter(
    finding["DetectorName"] for finding in findings
).items()):
    print(f"  {name}: {count}")
for finding in findings:
    source = finding.get("SourceMetadata", {}).get("Data", {}).get("Git", {})
    print(json.dumps({
        "detector": finding["DetectorName"],
        "file": source.get("file"),
        "line": source.get("line"),
    }, ensure_ascii=True))
sys.exit(1 if findings else 0)
PY
