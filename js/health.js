// Channels the provider removed: a background check of every OTT Club channel (at most once per
// HEALTH_PERIOD_MS per channel, remembered across launches) and a probe of the channel landed on.
// The check waits until playback is settled, pauses while the viewer zaps, and a newer list cancels it.
// An M3U playlist is not swept; its landing probe trusts only the explicit "/system/" placeholder, so a
// valid master from another provider is never hidden.
//   hooks: { onSwept(checked, removed), onBadKey() }
var Health = (function () {
  var verdicts = null;         // key -> [dead 0|1, checkedAt]
  var hooks = {}, token = 0, queue = [], active = [], ready = false, sweepMode = '';
  var probeReq = null, removedInRun = 0, checkedInRun = 0, keyReported = false;

  function setHooks(h) { hooks = h; }
  function all() { if (verdicts === null) { verdicts = Util.load('healthVerdicts') || {}; } return verdicts; }

  // A wrong or expired key: every stream answers with the "no key" clip. Nothing is marked removed; the
  // check stops and the viewer is told once per list (hooks.onBadKey).
  function badKey(text) {
    if (OttClub.classify(text) !== 'nokey') return false;
    if (!keyReported && hooks.onBadKey) hooks.onBadKey();
    keyReported = true;
    return true;
  }

  // Is this answer a removed channel, in this source?
  function isDead(text, mode) {
    var c = OttClub.classify(text);
    return c === 'removed' || (mode === 'ott' && c === 'audioOnly');
  }
  function fresh(key) { var v = all()[key]; return !!v && Date.now() - v[1] < CONFIG.HEALTH_PERIOD_MS; }
  function record(key, dead) { all()[key] = [dead ? 1 : 0, Date.now()]; }

  // What earlier checks found, carried onto a new list (before its groups are built).
  function markDead(list) {
    var v = all();
    for (var i = 0; i < list.length; i++) list[i].dead = !!(v[list[i].key] && v[list[i].key][0]);
  }

  // A new list: the previous check is cancelled; channels without a fresh verdict are queued.
  function schedule(list, mode) {
    cancel();
    sweepMode = mode;
    queue = [];
    keyReported = false;
    if (mode !== 'ott') return;
    for (var i = 0; i < list.length; i++) if (!fresh(list[i].key)) queue.push(list[i]);
    removedInRun = 0; checkedInRun = 0;
    pump();
  }

  function cancel() {
    token++;
    for (var i = 0; i < active.length; i++) active[i].handle.abort();
    active = [];
  }

  // Playback settled (true) or a zap started (false). Requests in flight are aborted and re-queued.
  function setReady(on) {
    ready = on;
    if (on) { pump(); return; }
    for (var i = 0; i < active.length; i++) { active[i].handle.abort(); queue.unshift(active[i].ch); }
    active = [];
  }

  function pump() {
    while (ready && active.length < CONFIG.HEALTH_CONCURRENCY && queue.length) check(queue.shift(), token);
    if (ready && !active.length && !queue.length && checkedInRun) finish();
  }

  function check(ch, my) {
    var item = { ch: ch, handle: null };
    active.push(item);
    item.handle = Net.get({ url: ch.url, timeoutMs: CONFIG.PROBE_TIMEOUT_MS, maxBytes: CONFIG.PROBE_MAX_BYTES }, function (err, text) {
      if (my !== token) return;
      active.splice(active.indexOf(item), 1);
      checkedInRun++;
      if (!err && badKey(text)) { cancel(); queue = []; return; }
      // A network error is not proof of removal: the channel keeps its last verdict.
      if (!err) {
        var dead = isDead(text, sweepMode);
        record(ch.key, dead);
        if (dead && !ch.dead) removedInRun++;
        ch.dead = dead;
      }
      pump();
    });
  }

  function finish() {
    var checked = checkedInRun, removed = removedInRun;
    checkedInRun = 0; removedInRun = 0;
    Util.idle(function () { Util.save('healthVerdicts', all()); });
    if (hooks.onSwept) hooks.onSwept(checked, removed);
  }

  // The channel just landed on: one request alongside its start (none when its verdict is fresh).
  // onRemoved() runs when it turns out to be removed.
  function probe(ch, mode, onRemoved) {
    cancelProbe();
    if (fresh(ch.key)) return;
    probeReq = Net.get({ url: ch.url, timeoutMs: CONFIG.PROBE_TIMEOUT_MS, maxBytes: CONFIG.PROBE_MAX_BYTES }, function (err, text) {
      probeReq = null;
      if (err || badKey(text)) return;
      var dead = isDead(text, mode);
      record(ch.key, dead);
      if (dead) { ch.dead = true; onRemoved(); }
    });
  }
  function cancelProbe() { if (probeReq) { probeReq.abort(); probeReq = null; } }

  return { setHooks: setHooks, markDead: markDead, schedule: schedule, setReady: setReady, probe: probe, cancelProbe: cancelProbe };
}());
