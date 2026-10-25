#!/bin/zsh
# Runs the behaviour suite (tests/*.test.js) with Node 22's built-in test runner.
# Prints one line per test name (ok / not ok), the counts, and exits non-zero on any failure.
#   tests/run.sh                 the whole suite
#   tests/run.sh --junit FILE    also write a JUnit report (per-test names, for by-name regression diffs)
# The headless-browser checks in tests/e2e/ are run separately (they need Chrome and the network).
set -u
cd "${0:A:h}/.."
NODE="${NODE:-/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node}"
[[ -x "$NODE" ]] || NODE="$(command -v node)"

files=(tests/*.test.js)
if (( ${#files} == 0 )); then echo "no test files found in tests/" >&2; exit 2; fi
echo "node $("$NODE" --version) · ${#files} test files"

reporters=(--test-reporter=tap --test-reporter-destination=stdout)
if [[ "${1:-}" == "--junit" && -n "${2:-}" ]]; then
  reporters+=(--test-reporter=junit "--test-reporter-destination=$2")
fi

out="$("$NODE" --test --test-concurrency=4 "${reporters[@]}" "${files[@]}" 2>&1)"
rc=$?
# Per-test lines (top-level tests only) and the summary.
print -r -- "$out" | grep -E '^(not )?ok [0-9]+ - ' | sed -E 's/^(not ok|ok) [0-9]+ - /\1 · /'
print -r -- "$out" | grep -E '^# (tests|pass|fail|cancelled|skipped|todo|duration_ms) '
# Collected nothing = not a pass.
tests="$(print -r -- "$out" | sed -nE 's/^# tests ([0-9]+)$/\1/p')"
if [[ -z "$tests" || "$tests" == "0" ]]; then echo "NO TESTS RAN" >&2; exit 2; fi
if (( rc != 0 )); then
  echo "--- failure details ---"
  print -r -- "$out" | grep -E -A12 '^not ok [0-9]+ - ' | grep -E '^not ok|error:|expected|actual|^\s+[A-Za-z].*: ' | head -200
fi
exit $rc
