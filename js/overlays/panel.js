// The programme panel over the video (▼): ▲▼ shows, ◀ ▶ / CH± days, OK watches (archive, or live when
// on air without an archive), BACK closes.
(function () {
  var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var day = 0, cursor = -1, c = null, unavailable = false, moved = false;   // moved: ▲▼ used on this day

  function open() {
    c = Playback.current();
    ListView.reset('programmes');
    day = 0; cursor = -1; unavailable = false; moved = false;
    UI.show('prog', true);
    // The full guide arriving re-places a cursor the viewer has not moved yet (on air today, first row otherwise).
    EPG.ensure(c.id, function (err) { unavailable = !!err; if (!moved) cursor = -1; if (Overlay.mode() === 'panel') render(); });
    render();
  }
  function close() { UI.show('prog', false); }

  function list() { return EPG.day(c.id, day); }

  function render() {
    // On air: the programme at now, or the one the channel list names when the guide ends it earlier.
    var l = list(), now = Date.now(), archive = Catchup.supported(c), cur = day === 0 ? EPG.onAir(c.id, now) : null;
    var isCur = function (p) { return p.start <= now && p.stop > now || !!cur && p.start === cur.start && p.title === cur.title; };
    if (cursor < 0 || cursor >= l.length) cursor = day === 0 ? Math.min(onAirIndex(l, now, isCur), Math.max(0, l.length - 1)) : 0;
    UI.panelTitle(c.name + ' — ' + dayName(day));
    var rows = l.length ? l : [{ start: now, stop: now, title: unavailable ? 'Программа передач недоступна, повторю позже' : 'Программа загружается…' }];
    ListView.column('programmes', { total: rows.length, cursor: cursor, active: true, row: function (i) {
      var p = rows[i], onAir = isCur(p), past = p.stop <= now && !onAir;
      return { num: Util.hhmm(new Date(p.start)), logo: '', title: p.title, past: past,
        sub: onAir ? 'в эфире' : (past && archive ? '● архив' : '') };
    } });
  }

  function onAirIndex(l, now, isCur) {
    for (var i = 0; i < l.length; i++) if (isCur(l[i])) return i;
    return EPG.indexAt(l, now);
  }

  function dayName(off) {
    if (off === 0) return 'Сегодня';
    if (off === -1) return 'Вчера';
    if (off === 1) return 'Завтра';
    var d = new Date(Util.addDays(Date.now(), off));
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1);
  }

  function onKey(k, e) {
    e.preventDefault();
    var l = list();
    if ((k === K.UP || k === K.DOWN) && ListView.scrollWithin('programmes', k === K.UP ? -1 : 1)) return;
    var was = cursor;
    if (k === K.UP) cursor = Math.max(0, cursor - 1);
    else if (k === K.DOWN) cursor = Math.min(l.length - 1, cursor + 1);
    // CH± / PG± here change the day (frozen behaviour), so the panel has no paging; a new day starts afresh.
    else if (k === K.LEFT || k === K.CH_DOWN || k === K.PG_DOWN) { day = Math.max(-Catchup.days(c), day - 1); cursor = -1; moved = false; ListView.reset('programmes'); }
    else if (k === K.RIGHT || k === K.CH_UP || k === K.PG_UP) { day = Math.min(1, day + 1); cursor = -1; moved = false; ListView.reset('programmes'); }
    else if (k === K.ENTER) { watch(l[cursor]); return; }
    else if (Keys.isBack(k)) { Overlay.close(); return; }
    else return;
    if ((k === K.UP || k === K.DOWN) && cursor !== was) moved = true;   // a press clamped at an end is not a choice
    render();
  }

  function watch(p) {
    var now = Date.now();
    if (!p) return;
    if (p.start > now) { UI.toast('Передача ещё не началась'); return; }
    Overlay.close();
    if (p.stop > now && !Catchup.supported(c)) { Zap.pick(c); return; }
    Playback.archive(c, p.start);
  }

  // New guide data (a retry, an XMLTV file): the same re-placing as on arrival.
  function refresh() { if (!moved) cursor = -1; render(); }

  Overlay.register('panel', { open: open, close: close, onKey: onKey, render: refresh });
}());
