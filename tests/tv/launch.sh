#!/bin/zsh
# Starts the installed app in debug mode on the TV and forwards its inspector port (written to
# tests/tv/.port). TV=<ip:port> and SDB=<path> come from the environment; TV defaults to build.local.env's,
# and when nothing answers there tools/find-tv.sh scans the local network (the TV's address can change).
# The sdb server needs local-network access: start it once from a normal terminal (`sdb kill-server; sdb connect $TV`).
set -u
SDB="${SDB:-$HOME/tizen-studio/tools/sdb}"
APP=Yr0ttPlay1.OttClubPlayer
D="${0:A:h}"
[[ -z "${TV:-}" && -f "$D/../../build.local.env" ]] && TV=$(sed -n 's/^TV=//p' "$D/../../build.local.env")
TV=$("$D/../../tools/find-tv.sh" "${TV:-}") || exit 1
"$SDB" connect "$TV" >/dev/null 2>&1
"$SDB" -s "$TV" forward --remove-all >/dev/null 2>&1
timeout 20 "$SDB" -s "$TV" shell 0 kill Yr0ttPlay1 >/dev/null 2>&1; sleep 2
OUT=$(timeout 60 "$SDB" -s "$TV" shell 0 debug "$APP" 300 2>&1 | tail -1)
P=$(echo "$OUT" | grep -o 'port: [0-9]*' | grep -o '[0-9]*')
[[ -z "$P" ]] && { echo "launch failed: $OUT"; exit 1; }
echo "$P" > "$D/.port"
"$SDB" -s "$TV" forward "tcp:$P" "tcp:$P" >/dev/null && echo "inspector port $P"
