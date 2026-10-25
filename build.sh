#!/bin/zsh
# Build, sign and install Кинозал Анастасия on a Samsung TV.
# Settings come from build.local.env (git-ignored):
#   OTT_KEY=...            OTT Club subscriber key (or PLAYLIST_URL=... for any M3U)
#   CERT_PROFILE=...       Tizen security profile with the Samsung distributor certificate
#   TV=192.168.1.175:26101
set -eu
cd "${0:A:h}"
TIZEN=~/tizen-studio/tools/ide/bin/tizen
SDB=~/tizen-studio/tools/sdb
source ./build.local.env

rm -rf .buildResult && mkdir .buildResult
cp -R config.xml index.html css js img .buildResult/
sed -i '' -e "s#__OTT_KEY__#${OTT_KEY:-__OTT_KEY__}#" -e "s#__PLAYLIST_URL__#${PLAYLIST_URL:-__PLAYLIST_URL__}#" .buildResult/js/config.js

$TIZEN package -t wgt -s "$CERT_PROFILE" -- .buildResult
WGT=$(ls .buildResult/*.wgt)
echo "package: $WGT"

$SDB connect "$TV" >/dev/null
$TIZEN install -n "${WGT:t}" -s "$TV" -- .buildResult
$SDB -s "$TV" shell 0 was_execute Yr0ttPlay1.OttClubPlayer
