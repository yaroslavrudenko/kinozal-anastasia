#!/bin/zsh
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190f/open-probe; P=$D/../menu-open-probe
mkdir -p $O
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run s-pickin.mjs 188 'Кино' 2>&1 | tee $O/pick.log
for i in 1 2 3; do run $P/s-openprobe.mjs 2>&1 | tee $O/open-probe-$i.log; done
for i in 1 2 3; do run $P/s-openprobe.mjs nonext 2>&1 | tee $O/open-nonext-$i.log; done
for i in 1 2 3; do run $P/s-openprobe.mjs nologos 2>&1 | tee $O/open-nologos-$i.log; done
for i in 1 2; do run $P/s-openprobe.mjs trace 2>&1 | tee $O/open-trace-$i.log; done
run s-pickin.mjs 3 'Израиль' 2>&1 | tee $O/restore.log
(cd $P && $N sum.mjs $O/open-*.log) > $O/SUMMARY.txt 2>&1
echo QUEUE-DONE
