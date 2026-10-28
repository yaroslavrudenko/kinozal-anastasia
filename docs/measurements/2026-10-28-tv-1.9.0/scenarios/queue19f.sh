#!/bin/zsh
# Batch-5 build on the TV: install, smoke, logo probes (P2 after, P5 layout, P4 memory, P3 restart within the hour),
# the owner's flick probe, menu nav x3 (open-menu latency), on-air, channel 177 retest. P3 after-hour runs 65 min later.
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190f; L=$D/../logo-design; R=/Users/yaroslavr/Developer/Projects/AI/kinozal-anastasia
mkdir -p $O
open -a Terminal $D/sdb-restart.command; sleep 12
(cd $R && ./build.sh) > $O/build.log 2>&1; rc=$?; echo "build rc=$rc" | tee -a $O/build.log
[ $rc -ne 0 ] && { echo "BUILD FAILED, stop"; exit 1; }
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run s-smoke.mjs 2>&1 | tee $O/smoke.log
grep -q '"state":"PLAYING"' $O/smoke.log || { echo "SMOKE FAILED, stop"; exit 2; }
run $L/t-logos.mjs after 2>&1 | tee $O/P2-after.log
run s-logos.mjs 2>&1 | tee $O/logos-flick.log
run $L/t-logo-layout.mjs 2>&1 | tee $O/P5-layout.log
run $L/t-logos-mem.mjs 2>&1 | tee $O/P4-mem.log
run $L/t-logos-restart.mjs within-hour 2>&1 | tee $O/P3-within-hour.log
T0=$(date +%s)
for i in 1 2 3; do run s-fullnav.mjs 2>&1 | tee $O/menu-navigation-$i.log; done
run s-ui.mjs 2>&1 | tee $O/ui-checks.log
run s-epg.mjs 600 2>&1 | tee $O/on-air.log
run s-group.mjs 20000 40 'Кино' 2>&1 | tee $O/group-kino-first40.log
while [ $(( $(date +%s) - T0 )) -lt 3900 ]; do sleep 30; done
run $L/t-logos-restart.mjs after-hour 2>&1 | tee $O/P3-after-hour.log
echo QUEUE-DONE
