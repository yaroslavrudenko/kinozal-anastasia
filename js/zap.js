// Zapping with ◀ ▶ / CH± and picking a channel. A press after a pause opens the channel at once; inside
// a burst of presses each name is shown at once but only the channel stopped on is opened. Only the
// landing channel gets a guide request (once the zapping has settled and its picture is up); everything
// started for the channels passed is aborted.
var Zap = (function () {
  var GROUP_STORE = 'zapGroup';
  var groupKey = savedGroup(); // the group the viewer last picked a channel in (by identity): zapping stays inside it
  var pending = null, timer = null, lastStepAt = 0, prevKey = null, saveTimer = null, settleTimer = null;

  function step(dir) {
    var from = pending || Playback.current();
    var key = Channels.nextVisible(from ? from.key : null, dir, group());
    if (!key) { UI.toast('Нет других доступных каналов'); return; }
    var c = Channels.get(key), now = Date.now(), burst = now - lastStepAt < CONFIG.ZAP_IDLE_MS;
    lastStepAt = now;
    NowLines.cancel();
    EPG.cancelExcept(c.id);
    cancel();
    if (!burst) { land(c); return; }
    pending = c;
    Banner.preview(c);
    var sel = Playback.selection();
    timer = setTimeout(function () {
      timer = null;
      pending = null;
      if (sel === Playback.selection()) land(c);
    }, CONFIG.ZAP_SETTLE_MS);
  }

  // A pending zap is dropped: an overlay opened, the app went to the background, or a new step.
  function cancel() { clearTimeout(timer); timer = null; pending = null; }

  // A direct choice (menu, search, number, PREV, the programme panel, the saved channel at start).
  // groupIdx: the menu group it was picked in; omitted elsewhere.
  function pick(c, groupIdx) {
    cancel();
    remember(c, groupIdx);
    land(c);
  }

  // The group a channel is picked in is remembered across restarts. Picked outside the menu, the
  // remembered group stays when the channel is in it, else «Все каналы»; a list not loaded yet (or a
  // remembered group missing from it) changes nothing, and Zap.group() falls back to «Все каналы».
  function remember(c, groupIdx) {
    if (groupIdx === undefined) {
      var g = Channels.groups()[Channels.groupIndex(groupKey)], i = Channels.indexOfKey(c.key);
      if (!g || i < 0 || g.items.indexOf(i) >= 0) return;
      groupIdx = Channels.allIdx();
    }
    var picked = Channels.groups()[groupIdx], key = picked ? picked.key : '';
    if (key === groupKey) return;
    groupKey = key;
    Util.save(GROUP_STORE, key);
  }
  function savedGroup() { var k = Util.load(GROUP_STORE); return typeof k === 'string' ? k : ''; }

  function land(c) {
    var cur = Playback.current();
    // The channel already on screen (live) is not reopened: OK on it just shows the banner.
    if (cur && cur.key === c.key && Playback.mode() === 'live') { Banner.show(true); return; }
    if (cur && cur.key !== c.key) prevKey = cur.key;
    clearTimeout(saveTimer);
    clearTimeout(settleTimer);
    EPG.cancelExcept(c.id);
    NowLines.landed();
    Playback.live(c);
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
  function group() { return Channels.groupOrAll(groupKey); }

  // true while a burst of presses is still choosing (the banner shows the channel being passed).
  function choosing() { return !!timer; }

  return { GROUP_STORE: GROUP_STORE, step: step, cancel: cancel, choosing: choosing, pick: pick, previous: previous, onFirstFrame: onFirstFrame, group: group };
}());
