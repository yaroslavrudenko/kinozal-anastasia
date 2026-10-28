#!/bin/zsh
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190f
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; sleep 6; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run s-pickin.mjs 188 'Кино' 2>&1 | tee $O/pick-188-kino.log
for i in 1 2 3; do run s-fullnav.mjs 2>&1 | tee $O/menu-navigation-kino-$i.log; done
run s-pickin.mjs 3 'Израиль' 2>&1 | tee $O/restore-3-israel.log
echo QUEUE-DONE
