// Which country a channel belongs to, from whatever the provider gives: a tag in the name,
// the playlist group, the guide id (tvg-id "...il" / "...ua"), the script of the name or of the
// show on air, and a list of well-known channel names. Works for OTT Club and for any M3U.
var Country = (function () {
  var IL_NAMES = ['Channel 9', 'Channel 11', 'Channel 12', 'Channel 13', 'Channel 14', 'Channel 24', 'Kan 11', 'Kan', 'KAN11',
    'Keshet 12', 'Reshet 13', 'i24', 'i24 News', 'Knesset Channel', '5Sport', 'Hop!', 'HOP!',
    'Yam Tichoni', 'Good Life', 'Makan 33', 'Девятый канал', '9 канал Израиль'];
  var UA_NAMES = ['ICTV', 'ICTV2', '1+1', '1+1 Україна', '1+1 Marathon', '2+2', 'Інтер', 'Интер', 'К2', 'М1', 'М2', 'ТЕТ', 'НТН', 'СТБ',
    'Новий канал', 'Рада', 'Еспресо', '24 Канал', 'FreeДОМ', 'Уніан', 'Прямий', '5 Канал', 'ПлюсПлюс', 'Бігуді', 'Мега',
    'Піксель', 'Наталі ТВ', 'Армія TV', 'Новини Live', 'Суспільне Спорт', 'Ми - Україна', 'Знаєм 24', 'Про Київ', 'UA Music',
    'Суспільне', 'UA:Перший', 'Апостроф TV', 'Квартал ТВ', 'Оце', 'ОЦЕ'];

  var IL_TAG = /\((Израиль|Israel|ישראל|IL)\)|\[(IL|Israel)\]|^(IL|ISR)\s*[:|-]\s*|\s(IL|ISR)$/i;
  var UA_TAG = /\((Украина|Україна|Ukraine|UA)\)|\[(UA|Ukraine)\]|^(UA|UKR)\s*[:|-]\s*|\s(UA|UKR)$/i;
  var IL_GROUP = /израил|israel|ישראל|^il$|\bil\b/i;
  var UA_GROUP = /украин|україн|ukrain|^ua$|\bua\b/i;
  var OTHER_TAG = /\((?!Израиль|Israel|IL|Украина|Україна|Ukraine|UA)[^)]*\)/i;   // "(Литва)", "(Казахстан)" ...
  var HEBREW = /[֐-׿]/;
  var IL_ID = /\.il(@|$)/, UA_ID = /\.ua(@|$)/;                        // guide ids: "Kan11.il", iptv-org "Kan11.il@SD"
  var NAME_SUFFIX = /\s*\(\d{3,4}[pi]\)|\s*\[[^\]]*\]/g;                 // "(1080p)", "[Not 24/7]"
  var UA_LETTERS = /[іїєґІЇЄҐ]/;
  var NOT_UA_LETTERS = /[ўЎәғқңөұүһӘҒҚҢӨҰҮҺ]/;                                  // Belarusian, Kazakh

  // Lower-cased once at load: a lookup is one dictionary read, not ~60 toLowerCase calls per channel.
  function lowerSet(list) {
    var out = Util.dict();
    for (var i = 0; i < list.length; i++) out[list[i].toLowerCase()] = true;
    return out;
  }
  var IL_SET = lowerSet(IL_NAMES), UA_SET = lowerSet(UA_NAMES);
  function has(set, name) { return set[name.toLowerCase()] === true; }

  // ch: { name, groupId (the provider's own group text), id }; nowTitle: what is on (optional). Returns { il: bool, ua: bool }.
  function detect(ch, nowTitle) {
    var name = (ch.name || '').trim(), group = ch.groupId || '', id = String(ch.id || '').toLowerCase();
    // iptv-org style: "Kan 11 (1080p) [Not 24/7]" is "Kan 11"; its guide id "Kan11.il@SD" ends in the country.
    var base = name.replace(NAME_SUFFIX, '').trim();
    var il = IL_TAG.test(name) || IL_GROUP.test(group) || IL_ID.test(id) || HEBREW.test(name) || has(IL_SET, base);
    var ua = false;
    if (!il) {
      if (UA_TAG.test(name) || UA_GROUP.test(group) || UA_ID.test(id) || has(UA_SET, base)) ua = true;
      else if (!OTHER_TAG.test(name)) {
        var text = name + ' ' + (nowTitle || '');
        ua = UA_LETTERS.test(text) && !NOT_UA_LETTERS.test(text);
      }
    }
    return { il: il, ua: ua };
  }

  return { detect: detect };
}());
