#!/bin/zsh
# Night 2026-10-28: install the batch-4 tree (items 1–4; logos not yet), smoke, layout probe, logo flicker baseline,
# then the full series: nav x3, watch+zaps x3, streams, archive, groups (Кино, Украина 90; Израиль, Музыкальные all).
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190d; R=/Users/yaroslavr/Developer/Projects/AI/kinozal-anastasia
mkdir -p $O
open -a Terminal $D/sdb-restart.command; sleep 12
(cd $R && ./build.sh) > $O/build.log 2>&1; rc=$?; echo "build rc=$rc" | tee -a $O/build.log
[ $rc -ne 0 ] && { echo "BUILD FAILED, stop"; exit 1; }
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run s-smoke.mjs 2>&1 | tee $O/smoke.log
grep -q '"state":"PLAYING"' $O/smoke.log || { echo "SMOKE FAILED, stop"; exit 2; }
run s-ui.mjs 2>&1 | tee $O/ui-checks.log
run s-logos.mjs 2>&1 | tee $O/logos-b4.log
for i in 1 2 3; do
  run s-fullnav.mjs 2>&1 | tee $O/menu-navigation-$i.log
  run s-baseline2.mjs 2>&1 | tee $O/watch-and-zaps-$i.log
done
run s-stream.mjs 2>&1 | tee $O/streams-six-groups.log
run s-archive.mjs 2>&1 | tee $O/archive-slider.log
run s-group.mjs 20000 90 'Кино' 2>&1 | tee $O/group-kino.log
run s-group.mjs 20000 90 'Украина' 2>&1 | tee $O/group-ukraine.log
run s-group.mjs 20000 90 'Израиль' 2>&1 | tee $O/group-israel.log
run s-group.mjs 20000 90 'Музык' 2>&1 | tee $O/group-music.log
echo QUEUE-DONE
