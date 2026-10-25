#!/bin/zsh
# Build, sign and install Кинозал Анастасия on a Samsung TV.
# Settings come from build.local.env (git-ignored):
#   OTT_KEY=...            OTT Club subscriber key (optional: it can be entered on the TV instead)
#   CERT_PROFILE=...       Tizen security profile with the Samsung author + distributor certificates
#   DEVICE_PROFILE=...     device-profile.xml returned by Samsung with the distributor certificate
#   TV=192.168.1.175:26101
# The sdb server must have local-network access: start it once from a normal terminal
# (`sdb kill-server; sdb connect $TV`), not from tmux.
set -eu
cd "${0:A:h}"
TIZEN=~/tizen-studio/tools/ide/bin/tizen
SDB=~/tizen-studio/tools/sdb
APP=Yr0ttPlay1.OttClubPlayer
STAGE=/home/owner/share/tmp/sdk_tools
source ./build.local.env

rm -rf .buildResult && mkdir .buildResult
cp -R config.xml index.html css js img .buildResult/
rm -f .buildResult/img/icon.svg
# Build stamp shown in the app: commit (+ if the tree has uncommitted changes) and date.
BUILD="$(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo +) $(date +%d.%m.%Y)"
sed -i '' -e "s#__OTT_KEY__#${OTT_KEY:-__OTT_KEY__}#" -e "s#__PLAYLIST_URL__#${PLAYLIST_URL:-__PLAYLIST_URL__}#" \
  -e "s#__BUILD__#${BUILD}#" .buildResult/js/config.js

$TIZEN package -t wgt -s "$CERT_PROFILE" -- .buildResult
mv .buildResult/*.wgt .buildResult/package.wgt

# Samsung certificates are honoured only with the matching device profile on the TV;
# without it every install fails with a bare "install failed[118]".
$SDB connect "$TV" >/dev/null
$SDB -s "$TV" push "$DEVICE_PROFILE" "$STAGE/device-profile.xml"
$SDB -s "$TV" push .buildResult/package.wgt "$STAGE/package.wgt"
$SDB -s "$TV" shell 0 vd_appinstall "$APP" "$STAGE/package.wgt"
$SDB -s "$TV" shell 0 was_execute "$APP"
