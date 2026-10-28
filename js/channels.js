// The channel list, its groups and the one visibility rule. Channels are identified by `key`
// (stable across refreshes); a refresh installs a new list and rebuilds the groups.
// Group order: 🔍 Поиск · Все каналы · ★ Избранное · Израиль · Украина · provider groups · 📡 Провайдеры · ⚙ Настройки
// (names in the interface language, I18n).
var Channels = (function () {
  var ADULT = 'Для взрослых';
  var list = [], byKey = Util.dict(), groups = [];
  var showAdult = Util.load('showAdult') === true;     // off by default; switched in «⚙ Настройки»

  // The one rule: hidden channels are never listed, zapped to, numbered, searched or restored. The adult group is
  // the only one hidden, and by default (owner, 2026-10-27: «Для взрослых нужно скрывать по умолчанию всегда»).
  function adultAllowed(ch) { return showAdult || ch.groupId !== ADULT; }
  function isEligible(ch) { return !!ch && adultAllowed(ch); }

  function replace(newList) {
    list = newList;
    byKey = Util.dict();
    for (var i = 0; i < list.length; i++) byKey[list[i].key] = i;
    rebuild();
  }

  function rebuild() {
    var all = [], order = [], byGroup = Util.dict(), names = Util.dict();
    for (var i = 0; i < list.length; i++) {
      if (!isEligible(list[i])) continue;
      var g = list[i].groupId;                              // the id: the same in every interface language
      all.push(i);
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); names[g] = list[i].group; }
      byGroup[g].push(i);
    }
    // key: the group's identity across rebuilds (its kind and name), used to keep the zap group.
    groups = [{ key: 'search', name: I18n.t('g.search'), items: [], search: true }, { key: 'all', name: I18n.t('g.all'), items: all, all: true }];
    var favItems = all.filter(function (i) { return Favs.has(list[i].key); });
    if (favItems.length) groups.push({ key: 'fav', name: I18n.t('g.fav'), items: favItems, fav: true });
    for (var p = 0; p < ORDER.PINNED.length; p++) {
      var pin = ORDER.PINNED[p], items = all.filter(function (i) { return list[i][pin.flag]; });
      if (pin.numbered) items.sort(byNameNumber);
      if (items.length) groups.push({ key: 'pin:' + pin.name, name: I18n.t(pin.label), items: items, pinned: true });
    }
    // A provider group is keyed by its own text; the one for channels with none is ours (key 'none', translated).
    for (var j = 0; j < order.length; j++) groups.push({ key: order[j] ? 'grp:' + order[j] : 'none', name: names[order[j]], items: byGroup[order[j]], own: !!order[j] });
    groups.push({ key: 'sources', name: I18n.t('g.providers'), items: [], sources: true });
    groups.push({ key: 'about', name: I18n.t('g.settings'), items: [], about: true });
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

  // A group remembered by 1.8.4 or earlier, which named iptv-org's categories in Russian («Новостные» for News) and
  // the channels with no group «Без группы»: the key of that group in this list, or '' (keep the key: none here, or
  // not such a key). Where one old name covered two of today's groups (Kids and Animation were both «Детские»;
  // «Undefined» and no group were both «Без группы»): the one holding the channel being watched (chKey), else the first
  // in the menu. A provider group of that very name (OTT Club's «Кино», a playlist's own «Новостные») keeps it, unless
  // the channel being watched is in one of today's groups and not in it (review 4, Codex 4).
  var LEGACY = { 'Новостные': ['news'], 'Детские': ['kids', 'animation'], 'Музыкальные': ['music'], 'Кино': ['movies'], 'Сериалы': ['series'],
    'Спорт': ['sports'], 'Познавательные': ['documentary', 'science', 'education'], 'Развлекательные': ['entertainment', 'comedy'],
    'Общие': ['general'], 'Религиозные': ['religious'], 'Культура': ['culture'], 'Образ жизни': ['lifestyle'], 'Путешествия': ['travel'],
    'Кулинария': ['cooking'], 'Бизнес': ['business'], 'Парламент': ['legislative'], 'Погода': ['weather'], 'Магазины': ['shop'],
    'Природа': ['outdoor'], 'Авто': ['auto'], 'Классика': ['classic'], 'Семейные': ['family'], 'Общественные': ['public'], 'Отдых': ['relax'] };
  LEGACY[M3U.KEY_NO_GROUP] = ['', 'undefined'];
  function upgradedGroupKey(key, chKey) {
    var ids = key && key.indexOf('grp:') === 0 && LEGACY[key.substring(4)], first = '', at = indexOfKey(chKey), same = groups[groupIndex(key)];
    if (same && (at < 0 || same.items.indexOf(at) >= 0)) return '';
    for (var g = 0; ids && g < groups.length; g++) {
      var x = groups[g], id = x.key === 'none' ? '' : x.own ? x.key.substring(4).toLowerCase() : null;
      if (id === null || ids.indexOf(id) < 0) continue;
      if (x.items.indexOf(at) >= 0) return x.key;
      first = first || x.key;
    }
    return same ? '' : first;
  }

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

  // Groups the provider defines (not search, all, favourites, the pinned countries, «📡 Провайдеры» or «⚙ Настройки»).
  function providerGroupCount() {
    var n = 0;
    for (var g = 0; g < groups.length; g++) {
      var x = groups[g];
      if (!x.search && !x.all && !x.fav && !x.pinned && !x.about && !x.sources) n++;
    }
    return n;
  }

  function stats() { return { total: list.length }; }
  // The logo URLs of group gi, from the channel with key `from` on (wrapping round), at most LOGO_GROUP_MAX: what the
  // background trickle loads (the zap group's, the group highlighted in the menu).
  function logos(gi, from) {
    var g = groups[gi], items = g ? g.items : [], at0 = Math.max(0, items.indexOf(indexOfKey(from))), out = [];
    for (var k = 0; k < items.length && k < CONFIG.LOGO_GROUP_MAX; k++) out.push(list[items[(at0 + k) % items.length]].logo);
    return out;
  }

  return {
    replace: replace, rebuild: rebuild, at: at, count: count, indexOfKey: indexOfKey, get: get, byNum: byNum,
    groups: allGroups, groupIndex: groupIndex, allIdx: allIdx, groupOrAll: groupOrAll, upgradedGroupKey: upgradedGroupKey, isEligible: isEligible, adultAllowed: adultAllowed, nextVisible: nextVisible,
    search: search, setShowAdult: setShowAdult, showAdult: adultShown, providerGroupCount: providerGroupCount, stats: stats, logos: logos
  };
}());
