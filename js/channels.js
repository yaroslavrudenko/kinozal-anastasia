// The channel list, its groups and the one visibility rule. Channels are identified by `key`
// (stable across refreshes); a refresh installs a new list and rebuilds the groups.
// Group order: 🔍 Поиск · Все каналы · ★ Избранное · Израиль · Украина · provider groups · 📡 Провайдеры · ℹ О программе.
var Channels = (function () {
  var ADULT = 'Для взрослых';
  var list = [], byKey = Util.dict(), groups = [];
  var showAdult = Util.load('showAdult') === true;     // off by default; switched in «О программе»

  // The one rule: hidden channels are never listed, zapped to, numbered, searched or restored.
  function isEligible(ch) { return !!ch && (showAdult || ch.group !== ADULT); }
  function adultAllowed(ch) { return showAdult || ch.group !== ADULT; }

  function replace(newList) {
    list = newList;
    byKey = Util.dict();
    for (var i = 0; i < list.length; i++) byKey[list[i].key] = i;
    rebuild();
  }

  function rebuild() {
    var all = [], order = [], byGroup = Util.dict();
    for (var i = 0; i < list.length; i++) {
      if (!isEligible(list[i])) continue;
      var g = list[i].group;
      all.push(i);
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
      byGroup[g].push(i);
    }
    // key: the group's identity across rebuilds (its kind and name), used to keep the zap group.
    groups = [{ key: 'search', name: '🔍 Поиск', items: [], search: true }, { key: 'all', name: 'Все каналы', items: all, all: true }];
    var favItems = all.filter(function (i) { return Favs.has(list[i].key); });
    if (favItems.length) groups.push({ key: 'fav', name: '★ Избранное', items: favItems, fav: true });
    for (var p = 0; p < ORDER.PINNED.length; p++) {
      var pin = ORDER.PINNED[p], items = all.filter(function (i) { return list[i][pin.flag]; });
      if (pin.numbered) items.sort(byNameNumber);
      if (items.length) groups.push({ key: 'pin:' + pin.name, name: pin.name, items: items, pinned: true });
    }
    for (var j = 0; j < order.length; j++) groups.push({ key: 'grp:' + order[j], name: order[j], items: byGroup[order[j]] });
    groups.push({ key: 'sources', name: '📡 Провайдеры', items: [], sources: true });
    groups.push({ key: 'about', name: 'ℹ О программе', items: [], about: true });
  }
  function byNameNumber(a, b) { return ORDER.nameNumber(list[a].name) - ORDER.nameNumber(list[b].name) || a - b; }

  function at(i) { return list[i] || null; }
  function count() { return list.length; }
  function indexOfKey(key) { var i = key == null ? undefined : byKey[key]; return i === undefined ? -1 : i; }
  function get(key) { return at(indexOfKey(key)); }
  function byNum(n) { var ch = list[n - 1]; return ch && ch.num === n ? ch : null; }
  function allGroups() { return groups; }
  function groupIndex(key) { for (var g = 0; g < groups.length; g++) if (groups[g].key === key) return g; return -1; }
  function allIdx() { for (var g = 0; g < groups.length; g++) if (groups[g].all) return g; return 0; }
  // The group with this key, or «Все каналы» when it is not in the list (any more, or not yet).
  function groupOrAll(key) { var g = groupIndex(key); return g < 0 ? allIdx() : g; }

  // The next eligible channel after `fromKey` in group `groupIdx` (or in «Все каналы» when that group
  // does not hold it). A bounded loop: null when no eligible channel exists at all.
  function nextVisible(fromKey, dir, groupIdx) {
    var from = indexOfKey(fromKey), g = groups[groupIdx];
    var items = g && g.items.indexOf(from) >= 0 ? g.items : groups[allIdx()].items;
    var n = items.length, pos = items.indexOf(from);
    for (var i = 1; i <= n; i++) {
      var cand = list[items[((pos + dir * i) % n + n) % n]];
      if (isEligible(cand)) return cand.key;
    }
    return null;
  }

  // q: lower-case text; digits also match the channel number. { items: [index], total }.
  function search(q) {
    var items = [], total = 0;
    for (var i = 0; i < list.length; i++) {
      var ch = list[i];
      if (!isEligible(ch) || (q && ch.nameLc.indexOf(q) < 0 && String(ch.num) !== q)) continue;
      total++;
      if (items.length < CONFIG.SEARCH_LIMIT) items.push(i);
    }
    return { items: items, total: total };
  }

  function setShowAdult(on) { showAdult = on; Util.save('showAdult', on); rebuild(); }
  function adultShown() { return showAdult; }

  // Groups the provider defines (not search, all, favourites, the pinned countries or «О программе»).
  function providerGroupCount() {
    var n = 0;
    for (var g = 0; g < groups.length; g++) {
      var x = groups[g];
      if (!x.search && !x.all && !x.fav && !x.pinned && !x.about && !x.sources) n++;
    }
    return n;
  }

  function stats() { return { total: list.length }; }

  return {
    replace: replace, rebuild: rebuild, at: at, count: count, indexOfKey: indexOfKey, get: get, byNum: byNum,
    groups: allGroups, groupIndex: groupIndex, allIdx: allIdx, groupOrAll: groupOrAll, isEligible: isEligible, adultAllowed: adultAllowed, nextVisible: nextVisible,
    search: search, setShowAdult: setShowAdult, showAdult: adultShown, providerGroupCount: providerGroupCount, stats: stats
  };
}());
