#!/bin/zsh
# After the night series: logo probes P1 (image semantics, urgent) and P2 «before», then on-air checks x3.
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190d; L=$D/../logo-design; Q=/private/tmp/claude-501/-Users-yaroslavr/40bd8e7a-b591-426c-be3d-f3bef355966b/tasks/besx5uxc3.output
until grep -q 'QUEUE-DONE\|FAILED, stop' $Q 2>/dev/null; do sleep 30; done
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run $L/t-imgsem.mjs 2>&1 | tee $L/tv-P1-imgsem.log
run $L/t-logos.mjs before 2>&1 | tee $L/tv-P2-before.log
for i in 1 2 3; do run s-epg.mjs 900 2>&1 | tee $O/on-air-$i.log; done
echo EPG-DONE
