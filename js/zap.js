// Zapping with ◀ ▶ / CH± and picking a channel. A press after a pause opens the channel at once; inside
// a burst of presses each name is shown at once but only the channel stopped on is opened. Only the
// landing channel gets a guide request (once the zapping has settled and its picture is up) and a probe;
// everything started for the channels passed is aborted, and the background check stops while zapping.
var Zap = (function () {
  var groupKey = '';           // the group last browsed in the menu (by identity): zapping stays inside it
  var pending = null, timer = null, lastStepAt = 0, prevKey = null, saveTimer = null, settleTimer = null;

  function removedToast(c, ms) { UI.toast('Канал «' + c.name + '» отключён провайдером', ms); }

  function step(dir) {
    var from = pending || Playback.current();
    var key = Channels.nextVisible(from ? from.key : null, dir, group());
    if (!key) { UI.toast('Нет других доступных каналов'); return; }
    var c = Channels.get(key), now = Date.now(), burst = now - lastStepAt < CONFIG.ZAP_IDLE_MS;
    lastStepAt = now;
    Playback.quiet();
    Health.cancelProbe();
    EPG.cancelExcept(c.id);
    cancel();
    if (!burst) { land(c, dir); return; }
    pending = c;
    Banner.preview(c);
    var sel = Playback.selection();
    timer = setTimeout(function () {
      timer = null;
      pending = null;
      if (sel === Playback.selection()) land(c, dir);
    }, CONFIG.ZAP_SETTLE_MS);
  }

  // A pending zap is dropped: an overlay opened, the app went to the background, or a new step.
  function cancel() { clearTimeout(timer); timer = null; pending = null; }

  // A direct choice (menu, search, number, PREV, the programme panel).
  function pick(c) {
    cancel();
    if (c.dead) { removedToast(c); return; }
    land(c, 0);
  }

  // dir: +1 / -1 when zapping (a channel found removed is stepped over in that direction), 0 otherwise.
  function land(c, dir) {
    var cur = Playback.current();
    // The channel already on screen (live) is not reopened: OK on it just shows the banner.
    if (cur && cur.key === c.key && Playback.mode() === 'live') { Banner.show(true); return; }
    if (cur && cur.key !== c.key) prevKey = cur.key;
    clearTimeout(saveTimer);
    clearTimeout(settleTimer);
    EPG.cancelExcept(c.id);
    Playback.live(c);
    var sel = Playback.selection();
    // A late answer acts only while this very choice still stands (no archive, pause or zap since).
    Health.probe(c, Sources.mode(), function () {
      if (sel !== Playback.selection()) return;
      Channels.rebuild();
      removedToast(c, 3500);
      Banner.setState('Канал отключён провайдером');
      if (dir) step(dir);
    });
  }

  function previous() {
    var c = Channels.get(prevKey);
    if (c && Channels.isEligible(c)) pick(c);
  }

  // The landing channel's picture is up. Once zapping has settled (ZAP_IDLE_MS after the last press):
  // its guide, the "last channel" record and the offline list.
  function onFirstFrame() {
    if (timer) return;                   // a burst is still choosing
    var c = Playback.current(), sel = Playback.selection();
    if (!c) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      if (sel !== Playback.selection() || timer) return;
      EPG.cancelExcept(c.id);
      EPG.ensure(c.id, Banner.onGuide);
      Sources.onFirstFrame();
    }, Math.max(0, lastStepAt + CONFIG.ZAP_IDLE_MS - Date.now()));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (Playback.current() === c) Sources.rememberLanding(c); }, CONFIG.LANDING_SAVE_MS);
  }

  // The zap group as an index into Channels.groups() (it survives rebuilds that add or remove groups).
  function group() { var g = Channels.groupIndex(groupKey); return g < 0 ? Channels.allIdx() : g; }
  function setGroup(i) { var g = Channels.groups()[i]; groupKey = g ? g.key : ''; }

  // true while a burst of presses is still choosing (the banner shows the channel being passed).
  function choosing() { return !!timer; }

  return { step: step, cancel: cancel, choosing: choosing, pick: pick, previous: previous, onFirstFrame: onFirstFrame, group: group, setGroup: setGroup };
}());
