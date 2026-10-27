#!/bin/zsh
# Build, sign and install Настин кинозал on a Samsung TV.
# Settings come from build.local.env (git-ignored):
#   OTT_KEY=...            OTT Club subscriber key (optional: it can be entered on the TV instead)
#   CERT_PROFILE=...       Tizen security profile with the Samsung author + distributor certificates
#   DEVICE_PROFILE=...     device-profile.xml returned by Samsung with the distributor certificate
#   TV=<ip>:26101          the TV's last known address; when it does not answer, tools/find-tv.sh scans the
#                          local network for it (the router can give the TV another address)
# The sdb server must have local-network access: start it once from a normal terminal
# (`sdb kill-server; sdb connect $TV`), not from tmux.
set -eu
cd "${0:A:h}"
TIZEN=~/tizen-studio/tools/ide/bin/tizen
SDB=~/tizen-studio/tools/sdb
APP=Yr0ttPlay1.OttClubPlayer
STAGE=/home/owner/share/tmp/sdk_tools
source ./build.local.env
TV=$(tools/find-tv.sh "${TV:-}")

rm -rf .buildResult && mkdir .buildResult
cp -R config.xml index.html css js img .buildResult/
rm -f .buildResult/img/icon.svg
# Build stamp shown in the app: commit (+ if the tree has uncommitted changes) and date.
BUILD="$(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo +) $(date +%d.%m.%Y)"
# The values reach node through its environment (never argv) and are written as JSON string literals,
# so "&", "#", "'", "\" and newlines survive; an empty value keeps its placeholder.
# Each placeholder must be present exactly once (otherwise the build stops), and the result must compile.
OTT_KEY="${OTT_KEY:-}" PLAYLIST_URL="${PLAYLIST_URL:-}" BUILD="$BUILD" node -e 'const fs = require("fs"), vm = require("vm"), f = process.argv[1]; let s = fs.readFileSync(f, "utf8"); for (const k of ["OTT_KEY", "PLAYLIST_URL", "BUILD"]) { const v = process.env[k], parts = s.split(String.fromCharCode(39) + "__" + k + "__" + String.fromCharCode(39)); if (parts.length !== 2) { console.error("config.js: placeholder __" + k + "__ found " + (parts.length - 1) + " times, expected once"); process.exit(1); } if (v) s = parts.join(JSON.stringify(v)); } new vm.Script(s); fs.writeFileSync(f, s);' .buildResult/js/config.js

$TIZEN package -t wgt -s "$CERT_PROFILE" -- .buildResult
mv .buildResult/*.wgt .buildResult/package.wgt

# Samsung certificates are honoured only with the matching device profile on the TV;
# without it every install fails with a bare "install failed[118]".
$SDB connect "$TV" >/dev/null
$SDB -s "$TV" push "$DEVICE_PROFILE" "$STAGE/device-profile.xml"
$SDB -s "$TV" push .buildResult/package.wgt "$STAGE/package.wgt"
$SDB -s "$TV" shell 0 vd_appinstall "$APP" "$STAGE/package.wgt"
# The staged package carries the key. The owner's TV refuses `rm` through sdb, so an empty file is pushed
# over it (push works); the device profile holds no secret and stays.
: > .buildResult/empty.wgt
if $SDB -s "$TV" push .buildResult/empty.wgt "$STAGE/package.wgt" >/dev/null 2>&1; then
  echo "staged $STAGE/package.wgt overwritten with an empty file (the installed app is not affected)"
else
  echo "WARNING: could not overwrite $STAGE/package.wgt on the TV; it still holds the key"
fi
$SDB -s "$TV" shell 0 was_execute "$APP"
