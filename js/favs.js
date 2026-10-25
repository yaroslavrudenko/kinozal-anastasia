// Favourites, keyed by the channel's stable key (older versions keyed them by stream URL, which embeds
// the subscriber key and changes with it).
var Favs = (function () {
  var favs = null;

  function all() {
    if (favs === null) {
      favs = Util.dict();
      var saved = Util.load('favs');
      if (saved && typeof saved === 'object') for (var k in saved) if (saved[k]) favs[k] = true;
    }
    return favs;
  }

  function has(key) { return all()[key] === true; }

  // Returns the new state.
  function toggle(key) {
    var f = all();
    if (f[key]) delete f[key]; else f[key] = true;
    Util.save('favs', f);
    return !!f[key];
  }

  // URL-keyed entries of the list's channels become key-keyed; entries matching no channel are kept,
  // so a channel that comes back later is still a favourite. Written only when something changed.
  function migrate(channels) {
    var f = all(), changed = false, byUrl = null;
    for (var k in f) {
      if (k.indexOf('://') < 0) continue;
      if (!byUrl) { byUrl = Util.dict(); for (var i = 0; i < channels.length; i++) byUrl[channels[i].url] = channels[i].key; }
      if (byUrl[k]) { f[byUrl[k]] = true; delete f[k]; changed = true; }
    }
    if (changed) Util.save('favs', f);
  }

  return { has: has, toggle: toggle, migrate: migrate };
}());
