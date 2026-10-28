// The interface language (owner, 2026-10-27: Russian by default, then Ukrainian, Hebrew and English; chosen in
// «Настройки»). Every text of the app's own comes from here; channel names, programmes and a provider's own
// group names are shown as the provider gives them. Hebrew is written right to left (dir="rtl" on <html>).
//   I18n.t(key, a, b, …)  the text with {0}, {1}, … filled in
//   I18n.n(count, key)    "<count> <word>" with the language's plural form
var I18n = (function () {
  var LANGS = ['ru', 'uk', 'he', 'en'];
  var NAMES = { ru: 'Русский', uk: 'Українська', he: 'עברית', en: 'English' };
  var RTL = { he: true };
  var lang = null;

  // [ru, uk, he, en]
  var T = {
    // groups and menu rows of the app's own
    'g.search': ['🔍 Поиск', '🔍 Пошук', '🔍 חיפוש', '🔍 Search'],
    'g.all': ['Все каналы', 'Усі канали', 'כל הערוצים', 'All channels'],
    'g.fav': ['★ Избранное', '★ Обране', '★ מועדפים', '★ Favourites'],
    'g.il': ['Израиль', 'Ізраїль', 'ישראל', 'Israel'],
    'g.ua': ['Украина', 'Україна', 'אוקראינה', 'Ukraine'],
    'g.providers': ['📡 Провайдеры', '📡 Провайдери', '📡 ספקים', '📡 Providers'],
    'g.settings': ['⚙ Настройки', '⚙ Налаштування', '⚙ הגדרות', '⚙ Settings'],
    'g.none': ['Без группы', 'Без групи', 'ללא קבוצה', 'No group'],
    // the free provider and its playlists
    'p.iptvorg': ['iptv-org — бесплатные каналы', 'iptv-org — безкоштовні канали', 'iptv-org — ערוצים בחינם', 'iptv-org — free channels'],
    'pl.all': ['Весь список — каналы со всего мира', 'Увесь список — канали з усього світу', 'הרשימה המלאה — ערוצים מכל העולם', 'The whole list — channels from around the world'],
    'pl.il': ['Израиль', 'Ізраїль', 'ישראל', 'Israel'],
    'pl.ua': ['Украина', 'Україна', 'אוקראינה', 'Ukraine'],
    'pl.rus': ['На русском языке', 'Російською мовою', 'ברוסית', 'In Russian'],
    'pl.eng': ['На английском — CNN, Bloomberg, DW, France 24, Euronews…', 'Англійською — CNN, Bloomberg, DW, France 24, Euronews…', 'באנגלית — CNN, Bloomberg, DW, France 24, Euronews…\u200e', 'In English — CNN, Bloomberg, DW, France 24, Euronews…'],
    'pl.news': ['Новости', 'Новини', 'חדשות', 'News'],
    'pl.kids': ['Детские', 'Дитячі', 'ילדים', 'Kids'],
    'pl.music': ['Музыка', 'Музика', 'מוזיקה', 'Music'],
    'pl.movies': ['Кино', 'Кіно', 'סרטים', 'Movies'],
    'pl.documentary': ['Познавательные', 'Пізнавальні', 'דוקומנטרי', 'Documentary'],
    'pl.sports': ['Спорт', 'Спорт', 'ספורט', 'Sports'],
    // «Провайдеры»
    'src.title': ['Провайдеры', 'Провайдери', 'ספקים', 'Providers'],
    'src.note': ['OTT Club · бесплатный iptv-org · ваши провайдеры', 'OTT Club · безкоштовний iptv-org · ваші провайдери', 'OTT Club\u200f · iptv-org בחינם · הספקים שלך', 'OTT Club · free iptv-org · your providers'],
    'src.hint': ['OK — смотреть · Синяя — ключ OTT Club · Красная ×2 — удалить своего провайдера · Назад — в меню', 'OK — дивитися · Синя — ключ OTT Club · Червона ×2 — видалити свого провайдера · Назад — у меню', 'OK — צפייה · כחול — מפתח OTT Club · אדום ×2 — מחיקת ספק שהוספתם · חזרה — לתפריט', 'OK — watch · Blue — OTT Club key · Red ×2 — remove your provider · Back — to the menu'],
    'src.choose': ['Выберите, что смотреть', 'Виберіть, що дивитися', 'בחרו מה לצפות', 'Choose what to watch'],
    'src.firstHint': ['OK — выбрать · Синяя — ключ OTT Club · Назад — бесплатные каналы iptv-org', 'OK — вибрати · Синя — ключ OTT Club · Назад — безкоштовні канали iptv-org', 'OK — בחירה · כחול — מפתח OTT Club · חזרה — ערוצים בחינם של iptv-org', 'OK — choose · Blue — OTT Club key · Back — free iptv-org channels'],
    'src.add': ['+ Добавить провайдера', '+ Додати провайдера', '+ הוספת ספק', '+ Add a provider'],
    'src.armed': ['нажмите красную ещё раз — удалить', 'натисніть червону ще раз — видалити', 'לחצו שוב על האדום — מחיקה', 'press Red again to remove'],
    'src.now': ['● сейчас', '● зараз', '● עכשיו', '● now'],
    'src.keySaved': ['ключ сохранён · синяя — сменить ключ', 'ключ збережено · синя — змінити ключ', 'המפתח נשמר · כחול — החלפת מפתח', 'key saved · Blue — change the key'],
    'src.keyNeeded': ['нужен ключ: OK или синяя', 'потрібен ключ: OK або синя', 'נדרש מפתח: OK או כחול', 'a key is needed: OK or Blue'],
    'src.free': ['бесплатно · {0} · OK — выбрать', 'безкоштовно · {0} · OK — вибрати', 'בחינם · {0} · OK — בחירה', 'free · {0} · OK — choose'],
    'src.own': ['ваш провайдер · красная — удалить', 'ваш провайдер · червона — видалити', 'ספק שהוספתם · אדום — מחיקה', 'your provider · Red — remove'],
    'src.addSub': ['ссылка на M3U-список каналов провайдера', 'посилання на M3U-список каналів провайдера', 'קישור לרשימת ערוצי M3U של הספק', 'a link to the provider\'s M3U channel list'],
    'src.switching': ['Переключаю на {0}', 'Перемикаю на {0}', 'עוברים אל {0}', 'Switching to {0}'],
    'src.nothing': ['Здесь нечего удалять', 'Тут нічого видаляти', 'אין כאן מה למחוק', 'Nothing to remove here'],
    'src.builtin': ['Это встроенный провайдер, его удалить нельзя', 'Це вбудований провайдер, його не можна видалити', 'זה ספק מובנה, אי אפשר למחוק אותו', 'This provider is built in and cannot be removed'],
    'src.removed': ['Провайдер удалён: {0}', 'Провайдера видалено: {0}', 'הספק נמחק: {0}', 'Provider removed: {0}'],
    // entering a key or a link
    'set.key': ['Ключ OTT Club. Сейчас используется сохранённый ключ, если он был. Введите новый или нажмите «Назад».', 'Ключ OTT Club. Зараз використовується збережений ключ, якщо він був. Введіть новий або натисніть «Назад».', 'מפתח OTT Club. כרגע בשימוש המפתח השמור, אם היה. הזינו מפתח חדש או לחצו "חזרה".', 'OTT Club key. The saved key, if any, is in use now. Type a new one or press Back.'],
    'set.keyFirst': ['Ключ OTT Club. Введите ключ или нажмите «Назад» — вернуться к выбору.', 'Ключ OTT Club. Введіть ключ або натисніть «Назад» — повернутися до вибору.', 'מפתח OTT Club. הזינו את המפתח או לחצו "חזרה" — חזרה לבחירה.', 'OTT Club key. Type the key, or press Back to return to the choice.'],
    'set.playlist': ['Ссылка на M3U-список каналов вашего провайдера (http:// или https://). «Назад» — без изменений.', 'Посилання на M3U-список каналів вашого провайдера (http:// або https://). «Назад» — без змін.', 'קישור לרשימת ערוצי M3U של הספק שלך (http:// או https://). "חזרה" — ללא שינוי.', 'Your provider\'s M3U channel-list link (http:// or https://). Back — no changes.'],
    'set.ok': ['OK — сохранить и запустить', 'OK — зберегти й запустити', 'OK — שמירה והפעלה', 'OK — save and start'],
    'set.needLink': ['Ссылка должна начинаться с http:// или https://', 'Посилання має починатися з http:// або https://', 'הקישור צריך להתחיל ב-http:// או https://', 'The link must start with http:// or https://'],
    'set.isLink': ['Это ссылка на список каналов: добавьте её в «Провайдерах» через «+ Добавить провайдера».', 'Це посилання на список каналів: додайте його в «Провайдерах» через «+ Додати провайдера».', 'זה קישור לרשימת ערוצים: הוסיפו אותו ב"ספקים" דרך "+ הוספת ספק".', 'This is a channel-list link: add it in Providers with "+ Add a provider".'],
    'set.empty': ['Поле пустое.', 'Поле порожнє.', 'השדה ריק.', 'The field is empty.'],
    // «Настройки»
    'st.hint': ['▲▼ — выбрать · OK — открыть или переключить · Назад — закрыть', '▲▼ — вибрати · OK — відкрити або перемкнути · Назад — закрити', '\u200e▲▼\u200e — בחירה · OK — פתיחה או החלפה · חזרה — סגירה', '▲▼ — choose · OK — open or switch · Back — close'],
    'st.dedication': ['Эта программа сделана специально в честь моей супруги Анастасии и для неё —\nчтобы в свободное время она включала телевизор, отдыхала и получала удовольствие от жизни. 💐', 'Цю програму зроблено спеціально на честь моєї дружини Анастасії й для неї —\nщоб у вільний час вона вмикала телевізор, відпочивала й насолоджувалася життям. 💐', 'התוכנה הזאת נעשתה במיוחד לכבוד רעייתי אנסטסיה ובשבילה —\nכדי שבזמנה הפנוי תדליק את הטלוויזיה, תנוח ותיהנה מהחיים. 💐', 'This app was made especially in honour of my wife Anastasia and for her —\nso that in her free time she can switch on the TV, rest and enjoy life. 💐'],
    // 🌐 first: the row is found by its shape in a language the viewer cannot read.
    'st.language': ['🌐 Язык интерфейса', '🌐 Мова інтерфейсу', '🌐 שפת הממשק', '🌐 Interface language'],
    'st.languageState': ['{0} · OK — выбрать', '{0} · OK — вибрати', '{0} · OK — בחירה', '{0} · OK — choose'],
    'lang.hint': ['▲▼ — выбрать · OK — применить · Назад — к настройкам', '▲▼ — вибрати · OK — застосувати · Назад — до налаштувань', '\u200e▲▼\u200e — בחירה · OK — החלה · חזרה — להגדרות', '▲▼ — choose · OK — apply · Back — to the settings'],
    'st.author': ['Автор', 'Автор', 'יוצר', 'Author'],
    'st.authorName': ['Ярослав Руденко', 'Ярослав Руденко', 'ירוסלב רודנקו', 'Yaroslav Rudenko'],
    'st.authorState': ['{0} · {1} · OK — открыть в браузере', '{0} · {1} · OK — відкрити в браузері', '{0} · {1}\u200f · OK — פתיחה בדפדפן', '{0} · {1} · OK — open in the browser'],
    'st.full': ['Картинка во весь экран', 'Картинка на весь екран', 'תמונה במסך מלא', 'Full-screen picture'],
    'st.fullOn': ['да — изображение точно по размеру экрана', 'так — зображення точно за розміром екрана', 'כן — התמונה בדיוק בגודל המסך', 'yes — the picture fits the screen exactly'],
    'st.fullOff': ['нет — в пропорциях потока', 'ні — у пропорціях потоку', 'לא — בפרופורציות של השידור', 'no — the stream\'s own proportions'],
    'st.fullSaidOn': ['Картинка во весь экран', 'Картинка на весь екран', 'תמונה במסך מלא', 'Full-screen picture'],
    'st.fullSaidOff': ['Картинка в пропорциях потока', 'Картинка в пропорціях потоку', 'תמונה בפרופורציות של השידור', 'Picture in the stream\'s proportions'],
    'st.adult': ['Каналы для взрослых', 'Канали для дорослих', 'ערוצים למבוגרים', 'Adult channels'],
    'st.adultOn': ['показываются в меню', 'показуються в меню', 'מוצגים בתפריט', 'shown in the menu'],
    'st.adultOff': ['скрыты', 'приховані', 'מוסתרים', 'hidden'],
    'st.adultSaidOn': ['Группа «Для взрослых» добавлена в меню', 'Канали для дорослих показуються в меню', 'ערוצים למבוגרים מוצגים בתפריט', 'Adult channels are shown in the menu'],
    'st.adultSaidOff': ['Группа «Для взрослых» скрыта', 'Канали для дорослих приховано', 'ערוצים למבוגרים מוסתרים', 'Adult channels are hidden'],
    'st.opening': ['Открываю в браузере: {0}', 'Відкриваю в браузері: {0}', 'פותח בדפדפן: {0}', 'Opening in the browser: {0}'],
    'st.notOpened': ['Браузер не открылся ({0})', 'Браузер не відкрився ({0})', 'הדפדפן לא נפתח ({0})', 'The browser did not open ({0})'],
    'st.version': ['Версия', 'Версія', 'גרסה', 'Version'],
    'st.build': ['Сборка', 'Збірка', 'גרסת בנייה', 'Build'],
    'st.local': ['локальная', 'локальна', 'מקומית', 'local'],
    'st.tv': ['Телевизор', 'Телевізор', 'טלוויזיה', 'TV'],
    'st.engine': ['веб-движок Chromium {0}', 'веб-рушій Chromium {0}', 'מנוע Chromium {0}', 'Chromium {0} web engine'],
    'st.player': ['Плеер', 'Плеєр', 'נגן', 'Player'],
    'st.playerTv': ['аппаратный Samsung AVPlay', 'апаратний Samsung AVPlay', 'Samsung AVPlay בחומרה', 'hardware Samsung AVPlay'],
    'st.playerWeb': ['браузер (hls.js)', 'браузер (hls.js)', 'דפדפן (hls.js)', 'browser (hls.js)'],
    'st.provider': ['Провайдер', 'Провайдер', 'ספק', 'Provider'],
    'st.channels': ['Каналы', 'Канали', 'ערוצים', 'Channels'],
    'st.channelsState': ['{0} · групп: {1}', '{0} · груп: {1}', '{0} · קבוצות: {1}', '{0} · groups: {1}'],
    'st.archive': ['Архив', 'Архів', 'ארכיון', 'Archive'],
    'st.archiveState': ['{0} · перемотка ползунком (▲)', '{0} · перемотування повзунком (▲)', '{0} · חזרה אחורה עם המחוון (▲)', '{0} · rewind with the slider (▲)'],
    'st.now': ['Сейчас', 'Зараз', 'עכשיו', 'Now'],
    'st.noInfo': ['нет данных о потоке', 'немає даних про потік', 'אין נתונים על השידור', 'no stream data'],
    'st.buffer': ['Буфер', 'Буфер', 'מאגר', 'Buffer'],
    'st.bufferState': ['старт {0} с · после подгрузки {1} с · переподключение через {2} с (архив {3} с)', 'старт {0} с · після підвантаження {1} с · перепідключення через {2} с (архів {3} с)', 'התחלה {0} שנ׳ · אחרי טעינה {1} שנ׳ · חיבור מחדש אחרי {2} שנ׳ (ארכיון {3} שנ׳)', 'start {0} s · after loading {1} s · reconnect after {2} s (archive {3} s)'],
    'st.network': ['сеть: {0}', 'мережа: {0}', 'רשת: {0}', 'network: {0}'],
    'st.wired': ['кабель', 'кабель', 'כבל', 'cable'],
    // hints of the screens
    'h.menu': ['OK — смотреть · ◀ ▶ — группы и каналы · CH+/CH− — страница · ⏯ или жёлтая — избранное · Синяя — провайдеры · Назад — закрыть', 'OK — дивитися · ◀ ▶ — групи й канали · CH+/CH− — сторінка · ⏯ або жовта — обране · Синя — провайдери · Назад — закрити', 'OK — צפייה · \u200e◀ ▶\u200e — קבוצות וערוצים · \u200eCH+/CH−\u200e — עמוד · ⏯ או צהוב — מועדפים · כחול — ספקים · חזרה — סגירה', 'OK — watch · ◀ ▶ — groups and channels · CH+/CH− — page · ⏯ or Yellow — add to favourites · Blue — providers · Back — close'],
    'h.prog': ['▲ ▼ — передачи · ◀ ▶ — день · OK — смотреть · Назад — закрыть', '▲ ▼ — передачі · ◀ ▶ — день · OK — дивитися · Назад — закрити', '\u200e▲ ▼\u200e — תוכניות · \u200e◀ ▶\u200e — יום · OK — צפייה · חזרה — סגירה', '▲ ▼ — programmes · ◀ ▶ — day · OK — watch · Back — close'],
    'h.search': ['Введите название → OK · ▲ ▼ — выбор · OK — смотреть · Назад — закрыть', 'Введіть назву → OK · ▲ ▼ — вибір · OK — дивитися · Назад — закрити', 'הקלידו שם ← OK · \u200e▲ ▼\u200e — בחירה · OK — צפייה · חזרה — סגירה', 'Type a name → OK · ▲ ▼ — choose · OK — watch · Back — close'],
    'h.scrub': ['◀ ▶ — перемотка (удерживайте — быстрее) · ▲ ▼ — соседняя передача · OK — смотреть отсюда · Назад — отмена', '◀ ▶ — перемотування (утримуйте — швидше) · ▲ ▼ — сусідня передача · OK — дивитися звідси · Назад — скасувати', '\u200e◀ ▶\u200e — הרצה (החזיקו — מהר יותר) · \u200e▲ ▼\u200e — תוכנית סמוכה · OK — צפייה מכאן · חזרה — ביטול', '◀ ▶ — rewind (hold — faster) · ▲ ▼ — previous / next programme · OK — watch from here · Back — cancel'],
    'h.first': ['◀ ▶ — каналы · ▲ — архив · ▼ — программа · OK — меню и поиск', '◀ ▶ — канали · ▲ — архів · ▼ — програма · OK — меню й пошук', '\u200e◀ ▶\u200e — ערוצים · ▲ — ארכיון · ▼ — לוח שידורים · OK — תפריט וחיפוש', '◀ ▶ — channels · ▲ — archive · ▼ — TV guide · OK — menu and search'],
    'h.firstDesktop': ['← → каналы · ↑ архив · ↓ программа · Enter — меню и поиск', '← → канали · ↑ архів · ↓ програма · Enter — меню й пошук', '\u200e← →\u200e ערוצים · ↑ ארכיון · ↓ לוח שידורים · Enter — תפריט וחיפוש', '← → channels · ↑ archive · ↓ TV guide · Enter — menu and search'],
    'search.title': ['🔍 Поиск канала', '🔍 Пошук каналу', '🔍 חיפוש ערוץ', '🔍 Find a channel'],
    'search.placeholder': ['Название канала или номер', 'Назва каналу або номер', 'שם ערוץ או מספר', 'Channel name or number'],
    'search.capped': ['Показаны первые {0} из {1} — уточните запрос', 'Показано перші {0} з {1} — уточніть запит', 'מוצגים {0} הראשונים מתוך {1} — חדדו את החיפוש', 'The first {0} of {1} are shown — refine the search'],
    // the banner and messages while watching
    'b.connecting': ['Подключение…', 'Підключення…', 'מתחבר…', 'Connecting…'],
    'b.loading': ['Загрузка видео…', 'Завантаження відео…', 'טוען וידאו…', 'Loading video…'],
    'b.retry': ['Нет сигнала — повтор через {0} с (попытка {1})', 'Немає сигналу — повтор через {0} с (спроба {1})', 'אין אות — ניסיון חוזר בעוד {0} שנ׳ (ניסיון {1})', 'No signal — retry in {0} s (attempt {1})'],
    'b.archive': ['Архив · {0}', 'Архів · {0}', 'ארכיון · {0}', 'Archive · {0}'],
    'b.next': ['Далее {0}  {1}', 'Далі {0}  {1}', 'בהמשך {0}  {1}', 'Next {0}  {1}'],
    'b.ended': ['{0} (шла до {1})', '{0} (йшла до {1})', '{0} (שודר עד {1})', '{0} (ended {1})'],
    'm.noSignal': ['Нет сигнала, переподключаюсь… ({0})', 'Немає сигналу, перепідключаюся… ({0})', 'אין אות, מתחבר מחדש… ({0})', 'No signal, reconnecting… ({0})'],
    'm.soundAfterKey': ['Звук включится после любого нажатия или клика', 'Звук увімкнеться після будь-якого натискання чи кліку', 'הקול יופעל אחרי כל לחיצה', 'The sound comes on after any key or click'],
    'm.guideDown': ['Программа передач недоступна, повторю позже', 'Програма передач недоступна, повторю пізніше', 'לוח השידורים אינו זמין, אנסה שוב מאוחר יותר', 'The programme guide is unavailable, will retry later'],
    'm.soundOn': ['Звук включён', 'Звук увімкнено', 'הקול הופעל', 'Sound on'],
    'm.screen': ['Экран: {0}', 'Екран: {0}', 'מסך: {0}', 'Screen: {0}'],
    'm.noStreamInfo': ['Нет данных о потоке', 'Немає даних про потік', 'אין נתונים על השידור', 'No stream data'],
    'm.noArchive': ['У этого канала нет архива', 'У цього каналу немає архіву', 'לערוץ הזה אין ארכיון', 'This channel has no archive'],
    'm.noArchiveHere': ['Для этого канала архив недоступен', 'Для цього каналу архів недоступний', 'הארכיון אינו זמין לערוץ הזה', 'No archive for this channel'],
    'm.favAdded': ['Добавлено в избранное', 'Додано в обране', 'נוסף למועדפים', 'Added to favourites'],
    'm.favRemoved': ['Убрано из избранного', 'Прибрано з обраного', 'הוסר מהמועדפים', 'Removed from favourites'],
    'm.backAgain': ['Нажмите «Назад» ещё раз для выхода', 'Натисніть «Назад» ще раз, щоб вийти', 'לחצו "חזרה" שוב כדי לצאת', 'Press Back again to exit'],
    'm.noPause': ['Пауза недоступна: у канала нет архива', 'Пауза недоступна: у каналу немає архіву', 'לא ניתן להשהות: לערוץ אין ארכיון', 'No pause: the channel has no archive'],
    'm.paused': ['⏸ Пауза', '⏸ Пауза', '⏸ מושהה', '⏸ Paused'],
    'm.live': ['Прямой эфир', 'Прямий ефір', 'שידור חי', 'Live'],
    'm.soundOne': ['Звук: {0} (одна дорожка)', 'Звук: {0} (одна доріжка)', 'קול: {0} (רצועה אחת)', 'Sound: {0} (one track)'],
    'm.soundOnlyOne': ['Звук: одна дорожка', 'Звук: одна доріжка', 'קול: רצועה אחת', 'Sound: one track'],
    'm.soundFail': ['Звук: не удалось переключить дорожку', 'Звук: не вдалося перемкнути доріжку', 'קול: החלפת הרצועה נכשלה', 'Sound: could not switch the track'],
    'm.sound': ['Звук: {0}', 'Звук: {0}', 'קול: {0}', 'Sound: {0}'],
    'm.netBack': ['Сеть восстановлена', 'Мережу відновлено', 'הרשת חזרה', 'Network restored'],
    'm.netDown': ['Нет сети', 'Немає мережі', 'אין רשת', 'No network'],
    'm.noOther': ['Нет других доступных каналов', 'Немає інших доступних каналів', 'אין ערוצים זמינים אחרים', 'No other channels available'],
    'm.noChannel': ['Нет канала {0}', 'Немає каналу {0}', 'אין ערוץ {0}', 'No channel {0}'],
    'm.notStarted': ['Передача ещё не началась', 'Передача ще не почалася', 'התוכנית עוד לא התחילה', 'The programme has not started yet'],
    'm.oldList': ['Сервер не ответил — показан последний список, обновлю автоматически', 'Сервер не відповів — показано останній список, оновлю автоматично', 'השרת לא ענה — מוצגת הרשימה האחרונה, תתעדכן אוטומטית', 'The server did not answer — the last list is shown, it will update by itself'],
    'm.listEmpty': ['Список каналов пуст или недоступен. Повтор через {0} с.', 'Список каналів порожній або недоступний. Повтор через {0} с.', 'רשימת הערוצים ריקה או לא זמינה. ניסיון חוזר בעוד {0} שנ׳.', 'The channel list is empty or unavailable. Retry in {0} s.'],
    'm.listFail': ['Не удалось загрузить список каналов ({0}). Повтор через {1} с.', 'Не вдалося завантажити список каналів ({0}). Повтор через {1} с.', 'טעינת רשימת הערוצים נכשלה ({0}). ניסיון חוזר בעוד {1} שנ׳.', 'Could not load the channel list ({0}). Retry in {1} s.'],
    'm.languageSet': ['Язык интерфейса: {0}', 'Мова інтерфейсу: {0}', 'שפת הממשק: {0}', 'Interface language: {0}'],
    // the programme panel and the archive slider
    'p.today': ['Сегодня', 'Сьогодні', 'היום', 'Today'],
    'p.yesterday': ['Вчера', 'Учора', 'אתמול', 'Yesterday'],
    'p.tomorrow': ['Завтра', 'Завтра', 'מחר', 'Tomorrow'],
    'p.weekdays': [['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']],
    'p.loading': ['Программа загружается…', 'Програма завантажується…', 'לוח השידורים נטען…', 'Loading the programme…'],
    'p.onAir': ['в эфире', 'в ефірі', 'בשידור', 'on air'],
    'p.archived': ['● архив', '● архів', '● ארכיון', '● archive'],
    'sc.live': ['прямой эфир', 'прямий ефір', 'שידור חי', 'live'],
    'sc.behind': ['−{0} от эфира', '−{0} від ефіру', '{0} אחרי השידור החי', '{0} behind live'],
    'sc.hm': ['{0} ч {1} мин', '{0} год {1} хв', '{0} שע׳ {1} דק׳', '{0} h {1} min'],
    'sc.m': ['{0} мин', '{0} хв', '{0} דק׳', '{0} min'],
    // the stream's technical line and the picture modes
    'num.decimal': [',', ',', '.', '.'],
    'tech.mbps': ['{0} Мбит/с', '{0} Мбіт/с', '{0} Mbps', '{0} Mbps'],
    'tech.fps': ['{0} к/с', '{0} к/с', '{0} fps', '{0} fps'],
    'tech.sound': ['звук {0}', 'звук {0}', 'קול {0}', 'sound {0}'],
    'tech.stereo': ['стерео', 'стерео', 'סטריאו', 'stereo'],
    'tech.mono': ['моно', 'моно', 'מונו', 'mono'],
    'tech.ch': ['{0} кан.', '{0} кан.', '{0} ערוצים', '{0} ch.'],
    'tech.track': ['Дорожка {0}', 'Доріжка {0}', 'רצועה {0}', 'Track {0}'],
    'mode.full': ['Во весь экран', 'На весь екран', 'מסך מלא', 'Full screen'],
    'mode.auto': ['Авто (пропорции потока)', 'Авто (пропорції потоку)', 'אוטומטי (פרופורציות השידור)', 'Auto (the stream\'s proportions)'],
    'mode.box': ['С полями', 'З полями', 'עם שוליים', 'Letterbox'],
    'm.channel': ['Канал', 'Канал', 'ערוץ', 'Channel'],
    'list.more': ['▼ ещё {0} · CH− — дальше', '▼ ще {0} · CH− — далі', '▼ עוד {0} · \u200eCH−\u200e — הלאה', '▼ {0} below · CH− — next'],
    'list.end': ['Конец списка', 'Кінець списку', 'סוף הרשימה', 'End of the list']
  };
  // Plural word forms [ru, uk, he, en], each one / few / many.
  var WORDS = {
    channel: [['канал', 'канала', 'каналов'], ['канал', 'канали', 'каналів'], ['ערוץ', 'ערוצים', 'ערוצים'], ['channel', 'channels', 'channels']],
    playlist: [['плейлист', 'плейлиста', 'плейлистов'], ['плейлист', 'плейлисти', 'плейлистів'], ['רשימה', 'רשימות', 'רשימות'], ['playlist', 'playlists', 'playlists']],
    day: [['день', 'дня', 'дней'], ['день', 'дні', 'днів'], ['יום', 'ימים', 'ימים'], ['day', 'days', 'days']]
  };

  function code() {
    if (lang === null) { var s = Util.load('lang'); lang = LANGS.indexOf(s) >= 0 ? s : 'ru'; }
    return lang;
  }
  function idx() { return LANGS.indexOf(code()); }
  // Placeholders are filled in one pass, so a value that itself holds "{1}" (a programme title) stays as it is.
  var PLACEHOLDER = /\{(\d)\}/g;
  function t(key) {
    var row = T[key], s = row ? row[idx()] : key, args = arguments;
    return s.replace(PLACEHOLDER, function (m, d) { return +d + 1 < args.length ? String(args[+d + 1]) : m; });
  }
  function rtl() { return !!RTL[code()]; }
  function list(key) { return T[key][idx()]; }
  // Russian and Ukrainian: one / few / many; Hebrew and English: one / other.
  function form(n) {
    var l = code(), a = Math.abs(n) % 100, b = a % 10;
    if (l === 'ru' || l === 'uk') return b === 1 && a !== 11 ? 0 : b >= 2 && b <= 4 && (a < 12 || a > 14) ? 1 : 2;
    return n === 1 ? 0 : 2;
  }
  function n(count, word) { return count + ' ' + WORDS[word][idx()][form(count)]; }
  function name(l) { return NAMES[l || code()]; }
  // The interface languages, in the order the language list shows them, and the direction each is written in.
  function langs() { return LANGS.slice(); }
  function dirOf(l) { return RTL[l] ? 'rtl' : 'ltr'; }
  function set(l) { lang = l; Util.save('lang', l); }

  // The page's own texts (data-t: text, data-tp: placeholder) and the writing direction.
  function apply() {
    var root = document.documentElement;
    root.setAttribute('lang', code());
    root.setAttribute('dir', RTL[code()] ? 'rtl' : 'ltr');
    var els = document.querySelectorAll('[data-t]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-t'));
    els = document.querySelectorAll('[data-tp]');
    for (var j = 0; j < els.length; j++) els[j].setAttribute('placeholder', t(els[j].getAttribute('data-tp')));
  }

  // A provider text (a channel, group or programme name) as it is meant to read, whatever the interface direction
  // (owner, 2026-10-27: mixed texts «не создают проблем и правильно отображаются»). Its direction is the one of its
  // first strong letter: emoji and flags (surrogate pairs), digits (Arabic-Indic too), punctuation and symbols are
  // not letters and are skipped; a text with no letter at all reads left to right. Tizen 3's engine (Chromium 47)
  // knows the embeddings LRE/RLE … PDF and the marks LRM/RLM, not the newer isolates, so only those are used.
  var RTL_LETTER = /[\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06EE\u06EF\u06FA-\u06FC\u06FF\u0700-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
  var LTR_LETTER = /[A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0370-\u0373\u0376-\u037D\u037F\u0386\u0388-\u03FF\u0400-\u0482\u048A-\u058F\u0900-\u1FFF\u2C00-\u2DFF\u3040-\u9FFF\uA000-\uD7FF\uF900-\uFB1C]/;
  // Non-spacing marks (Unicode Mn and Me) inside those ranges are no letters: a mark takes the direction of the letter
  // before it, so one a text starts with decides nothing (review 4, Codex 6: «ँ כאן», «ࣣ Channel»). Generated from
  // Unicode 16 \p{Mn}\p{Me} over the two classes above; tests/i18n.test.js keeps it in step with them.
  var MARK = /[\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u09FE\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B55\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3C\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D00\u0D01\u0D3B\u0D3C\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0D81\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732\u1733\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DFF\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA82C\uA8C4\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9BD\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E]/;
  function firstStrong(s) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), d = RTL_LETTER.test(c) ? 'rtl' : LTR_LETTER.test(c) ? 'ltr' : '';
      if (d && !MARK.test(c)) return d;
    }
    return '';
  }
  // The direction a provider text is laid out in when it is not the interface's: 'rtl' | 'ltr' | '' (the same).
  function otherDir(s) {
    var d = firstStrong(s === undefined || s === null ? '' : String(s)) || 'ltr';
    return d === (rtl() ? 'rtl' : 'ltr') ? '' : d;
  }
  // The text for a sentence of ours: a provider text in the other direction is embedded in its own (LRE/RLE … PDF),
  // and interface-direction marks around it keep our ★ ▶ · — on our side of it. Same-direction text is as given.
  function iso(s) {
    s = s === undefined || s === null ? '' : String(s);
    var d = otherDir(s);
    return d ? wrap(s, d) : s;
  }
  // A technical text (a host name, a picture size) always reads left to right.
  function ltr(s) { return rtl() ? wrap(String(s), 'ltr') : String(s); }
  function wrap(s, d) {
    var mark = rtl() ? '\u200f' : '\u200e';
    return mark + (d === 'rtl' ? '\u202b' : '\u202a') + s + '\u202c' + mark;
  }

  // A channel group's name. The provider's groups (OTT Club's, iptv-org's «News», any playlist's) are shown as the
  // provider gives them, «Undefined» or «Без группы» included; only the groups our own logic forms are translated —
  // here the one for channels the provider gives no group (owner, 2026-10-27: «Если группы возвращает провайдер — то
  // мы их показываем как есть, если мы сами их формируем нашей логикой — то нужно переводить»). Its id is '' (no
  // provider text is empty), and the id is what keys, the remembered group and the offline copy keep.
  function group(id) { return id || t('g.none'); }

  // Every key and its four texts: a test seam only (tests/i18n.test.js checks none is missing); the app reads T through t().
  function table() { return T; }

  return { t: t, list: list, n: n, rtl: rtl, name: name, code: code, langs: langs, dirOf: dirOf, set: set, apply: apply, table: table, group: group,
    iso: iso, ltr: ltr, otherDir: otherDir };
}());
