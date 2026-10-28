#!/bin/zsh
# kill + debug launch + forward; prints port
SDB=~/tizen-studio/tools/sdb; T=192.168.1.176:26101; D=${0:A:h}
$SDB -s $T forward --remove-all >/dev/null 2>&1
timeout 20 $SDB -s $T shell 0 kill Yr0ttPlay1 >/dev/null 2>&1; sleep 2
OUT=$(timeout 60 $SDB -s $T shell 0 debug Yr0ttPlay1.OttClubPlayer 300 2>&1 | tail -1)
P=$(echo "$OUT" | grep -o 'port: [0-9]*' | grep -o '[0-9]*')
[ -z "$P" ] && { echo "launch failed: $OUT"; exit 1; }
echo $P > $D/port; $SDB -s $T forward tcp:$P tcp:$P >/dev/null; echo "port $P"
