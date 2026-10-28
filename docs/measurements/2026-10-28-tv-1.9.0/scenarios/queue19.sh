#!/bin/zsh
# 1.9.0 series on the TV, one scenario at a time; same scenarios as the 1.8.4 baseline, fixed (one clock, exact spinner).
D=${0:A:h}; N=/Users/yaroslavr/.nvm/versions/node/v22.22.0/bin/node; O=$D/v190
run() { open -a Terminal $D/sdb-restart.command; sleep 10; (cd $D && zsh launch.sh) || { echo "launch failed for $1"; return; }; (cd $D && $N cdp.mjs $(cat $D/port) "$@") }
run s-baseline2.mjs 2>&1 | tee $O/watch-and-zaps.log
run s-fullnav.mjs 2>&1 | tee $O/menu-navigation.log
run s-stream.mjs 2>&1 | tee $O/streams-six-groups.log
run s-archive.mjs 2>&1 | tee $O/archive-slider.log
run s-group.mjs 20000 90 'Кино' 2>&1 | tee $O/group-kino.log
run s-group.mjs 20000 90 'Украина' 2>&1 | tee $O/group-ukraine.log
run s-group.mjs 20000 90 'Израиль' 2>&1 | tee $O/group-israel.log
run s-group.mjs 20000 90 'Музык' 2>&1 | tee $O/group-music.log
