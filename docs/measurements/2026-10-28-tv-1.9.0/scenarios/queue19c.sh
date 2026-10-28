#!/bin/zsh
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190c; R=/Users/yaroslavr/Developer/Projects/AI/kinozal-anastasia
mkdir -p $O
open -a Terminal $D/sdb-restart.command; sleep 10
(cd $R && ./build.sh) > $O/build.log 2>&1; echo "build rc=$?" | tee -a $O/build.log
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run s-smoke.mjs 2>&1 | tee $O/smoke.log
run s-ui.mjs 2>&1 | tee $O/ui-checks.log
echo QUEUE-DONE
