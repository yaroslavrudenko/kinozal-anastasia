#!/bin/zsh
# 1.9.0 batch-2 build (installed 23:42, build rc=0): disputed rows x3 (nav, watch+zaps), streams and archive x1.
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190b
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
for i in 1 2 3; do
  run s-fullnav.mjs 2>&1 | tee $O/menu-navigation-$i.log
  run s-baseline2.mjs 2>&1 | tee $O/watch-and-zaps-$i.log
done
run s-stream.mjs 2>&1 | tee $O/streams-six-groups.log
run s-archive.mjs 2>&1 | tee $O/archive-slider.log
echo QUEUE-DONE
