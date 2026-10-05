/* 日光写作 · 共享数据层
 * 使用 localStorage 持久化作品、章节、角色、词条数据。
 * 首次访问用 seed 数据初始化，之后所有页面读写同一份数据。
 */
(function (global) {
  'use strict';

  var KEY = 'rgyw_data_v1';

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function nowText() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function chapterId(book, idx) {
    var n = 1;
    for (var i = 0; i < book.chapters.length; i++) {
      if (book.chapters[i].no === idx) return book.chapters[i].id;
    }
    return 'c_' + book.id + '_' + idx;
  }

  function makeChapter(bookId, idx, title, paragraphs) {
    return {
      id: uid('ch'),
      bookId: bookId,
      no: idx,
      title: title || ('第' + idx + '章 未命名'),
      body: paragraphs || ['（本章尚未创建，点击「AI 写作」或「AI 续写正文」开始创作。）'],
      words: (paragraphs || []).join('').replace(/\s/g, '').length,
      updatedAt: nowText()
    };
  }

  /* 作品「信息库」：功法/地名/剧情线/金句/设定/章纲（角色沿用 characters 字段） */
  function emptyLibrary() {
    return {
      skills: [],        // 功法/能力库
      places: [],        // 地名库
      storylines: [],    // 剧情故事线
      quotes: [],        // 金句
      settings: [],      // 设定
      chapterOutlines: [] // 章纲
    };
  }

  function ensureLibrary(book) {
    if (!book) return book;
    if (!book.library || typeof book.library !== 'object') book.library = emptyLibrary();
    var lib = book.library;
    ['skills', 'places', 'storylines', 'quotes', 'settings', 'chapterOutlines'].forEach(function (k) {
      if (!Array.isArray(lib[k])) lib[k] = [];
    });
    if (!Array.isArray(book.characters)) book.characters = [];
    if (!Array.isArray(book.terms)) book.terms = [];
    return book;
  }

  function seed() {
    var c486 = [
      '青云宗山门前，三千剑修立于长阶之上，鸦雀无声。半空悬着一柄通体漆黑的长剑，剑身嗡鸣，像是困住了整整一座雷池。',
      '林尘负手而立，青衫猎猎。三年前他在这里被逐出宗门，废去一身修为；三年后他重返此地，只为讨一个说法。',
      '"林尘，你已非青云弟子，擅闯山门，按律当斩。"守山大长老的声音沉如暮鼓，却掩不住一丝颤抖。',
      '"当斩？"林尘笑了笑，抬指轻点虚空，"三年前你们废我丹田时，可曾问过一句为什么？"',
      '刹那间，剑鸣大作。那柄镇宗黑剑仿佛感应到了什么，剑尖缓缓转向林尘，天地间骤然肃杀。所有人的目光都凝聚在他指尖那一点微不可察的金芒上。',
      '"今日，我不借宗门一草一木，不倚旧日一分情分。"林尘的声音不高，却清晰落入每个人耳中，"只凭我这一剑，问一问这青云山的公道。"',
      '话音落，天地静。金光自他指尖暴涨，化作一道万丈剑光，撕裂云海，直贯苍穹——那一瞬，万法皆空。'
    ];
    var c484 = [
      '夜色深重，剑冢深处忽然传来一声低沉嗡鸣。守墓长老面色骤变，这声音，他等了三百年。',
      '没有人知道，那座沉睡了三百年的剑冢里，究竟埋着什么。'
    ];
    var c485 = [
      '山门外，三千剑修列阵而立。林尘站在长阶之下，青衫猎猎，身后空无一人。',
      '这一战，他从未打算借任何人之力。'
    ];
    var c487 = ['（本章尚未创建，点击「AI 写作」或「AI 续写正文」开始创作。）'];

    var jian = {
      id: 'b_jiuxiao', title: '九霄剑帝', kind: '小说', type: '东方玄幻', status: 'active', done: false,
      intro: '废材剑修林尘被逐出宗门，三年后携金手指归来，一剑问鼎青云。',
      grad: 'linear-gradient(135deg,#f97316,#f59e0b)', initial: '剑',
      createdAt: '2025-03-12', updatedAt: '2小时前',
      characters: [{ name: '林尘', role: '主角', desc: '被废修为的天才剑修，隐忍果决' }, { name: '守山大长老', role: '反派', desc: '青云宗掌权者，当年废林尘丹田的主谋' }],
      terms: [{ name: '青云宗', desc: '林尘出身的宗门，三千剑修，镇宗黑剑' }, { name: '剑冢', desc: '青云山深处的禁地，沉睡三百年' }],
      library: {
        skills: [{ name: '青云剑诀', desc: '青云宗镇宗剑法，共九重，重势不重招' }, { name: '万剑归宗诀', desc: '传说级剑诀，可御万剑，林尘金手指核心' }, { name: '不灭剑体', desc: '以剑意淬体，肉身如剑，愈战愈强' }, { name: '惊鸿身法', desc: '短距离爆发身法，进退如电' }],
        places: [{ name: '青云山', desc: '青云宗山门所在，三千剑修，云海剑峰' }, { name: '剑冢', desc: '山后禁地，镇宗黑剑沉眠三百年' }, { name: '陨剑城', desc: '山下最大城池，剑修云集的交易重镇' }, { name: '断魂渊', desc: '青云山外千里绝地，藏有上古剑圣传承' }],
        storylines: [{ name: '主线·剑问青云', desc: '废材剑修林尘被逐出宗门，三年后携金手指归来，一剑问鼎青云，揭开当年丹田被废的真相' }, { name: '支线·黑剑之秘', desc: '镇宗黑剑三百年异动与林尘前世有关，剑冢深处藏着一段被抹去的往事' }, { name: '支线·宗门大比', desc: '重回宗门后参加十年一度剑道大比，连败诸峰天骄，重夺第一' }, { name: '支线·红颜旧约', desc: '当年并肩的师姐苏浅雪身陷宗门内斗，林尘出手相护' }],
        quotes: [{ name: '开篇金句', desc: '剑可以断，心不能断。人可以败，志不能败。' }, { name: '回归宣言', desc: '我这一剑，不问青云旧事，只问一个公道。' }, { name: '高潮金句', desc: '三年前你们废我丹田，是替天行道；今日我一剑问天，谁来替我行道？' }, { name: '尾声金句', desc: '山门还是那座山门，剑已不是当年的剑。' }],
        settings: [{ name: '修炼境界', desc: '炼体→通脉→凝气→筑基→金丹→元婴→化神→渡劫→飞升，九境层层递进' }, { name: '剑意等级', desc: '剑随心走/剑心通明/人剑合一/剑破万法，四重剑意' }, { name: '宗门格局', desc: '青云宗四峰并立：剑峰/丹峰/阵峰/体峰，剑峰为首' }, { name: '灵石体系', desc: '下品/中品/上品/极品灵石，剑修以剑胎温养剑气' }],
        chapterOutlines: [{ name: '第1章 剑冢异动', desc: '镇宗黑剑深夜嗡鸣，林尘体内残破剑胎微震' }, { name: '第2章 回归青云', desc: '三年之期已到，林尘踏上青云山长阶' }, { name: '第3章 山门对峙', desc: '守山大长老率三千剑修阻拦，林尘一步一剑' }, { name: '第4章 一剑问天', desc: '黑剑认主，林尘一剑破万法，全场噤声' }],
      },
      chapters: [
        makeChapter('b_jiuxiao', 484, '第484章 剑冢异动', c484),
        makeChapter('b_jiuxiao', 485, '第485章 十面埋伏', c485),
        makeChapter('b_jiuxiao', 486, '第486章 一剑破万法', c486),
        makeChapter('b_jiuxiao', 487, '第487章 未创建', c487)
      ]
    };

    var b2 = {
      id: 'b_dushi', title: '都市医仙', kind: '小说', type: '现代都市', status: 'active', done: false,
      intro: '落魄中医传人重返都市，凭一手起死回生的医术纵横商海。',
      grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)', initial: '医',
      createdAt: '2025-05-01', updatedAt: '昨天',
      characters: [], terms: [], library: emptyLibrary(),
      chapters: [makeChapter('b_dushi', 312, '第312章 药王谷传人', ['药王谷的传人，终于还是回到了这座城。', '他站在医院门口，闻着消毒水的味道，忽然笑了。'])]
    };
    var b3 = {
      id: 'b_xingqiong', title: '星穹之下', kind: '小说', type: '未来科幻', status: 'active', done: true,
      intro: '联邦舰员韩澈在废弃坐标发现生命信号，揭开八十年前的秘密。',
      grad: 'linear-gradient(135deg,#8b5cf6,#6366f1)', initial: '星',
      createdAt: '2024-11-20', updatedAt: '3天前',
      characters: [], terms: [], library: emptyLibrary(),
      chapters: [makeChapter('b_xingqiong', 120, '第120章 归途', ['航道的尽头，是那颗他以为再也不会回来的星球。', '韩澈关闭引擎，听见自己的心跳声。'])]
    };
    var b4 = {
      id: 'b_wusuo', title: '雾锁长安', kind: '剧本', type: '悬疑推理', status: 'active', done: false,
      intro: '暴雨之夜，长安城连环失踪案背后藏着一座消失的戏班。',
      grad: 'linear-gradient(135deg,#64748b,#334155)', initial: '雾',
      createdAt: '2025-07-08', updatedAt: '5小时前',
      characters: [], terms: [], library: emptyLibrary(),
      chapters: [makeChapter('b_wusuo', 245, '第245场 雨夜画舫', ['雨夜，画舫停靠在无人渡口。', '戏班班主说：\u201c今晚的戏，只演给死人听。\u201d'])]
    };
    var b5 = {
      id: 'b_chunfeng', title: '春风不问归期', kind: '小说', type: '浪漫爱情', status: 'archive', done: false,
      intro: '错过十年的人，在一家旧书店重新相遇。',
      grad: 'linear-gradient(135deg,#ec4899,#f43f5e)', initial: '春',
      createdAt: '2025-01-15', updatedAt: '1周前',
      characters: [], terms: [], library: emptyLibrary(),
      chapters: [makeChapter('b_chunfeng', 98, '第98章 云开见月', ['雨停的时候，她推开了那家旧书店的门。', '风铃响了三声。'])]
    };
    var b6 = {
      id: 'b_qingyun', title: '青云万古', kind: '小说', type: '古风仙侠', status: 'active', done: false,
      intro: '一株青莲证道，少年从边陲小城走向万古第一。',
      grad: 'linear-gradient(135deg,#10b981,#14b8a6)', initial: '青',
      createdAt: '2024-08-03', updatedAt: '刚刚',
      characters: [], terms: [], library: emptyLibrary(),
      chapters: [makeChapter('b_qingyun', 721, '第721章 问天', ['青莲剑意冲霄而起，惊动了半座仙域。', '少年抬头，问了一句：\u201c天，可敢应我一剑？\u201d'])]
    };
    var b7 = {
      id: 'b_feitu', title: '废土拾荒者', kind: '小说', type: '赛博朋克', status: 'trash', done: false,
      intro: '核战后的废土上，拾荒者捡到了一台会做梦的AI。',
      grad: 'linear-gradient(135deg,#f43f5e,#a855f7)', initial: '废',
      createdAt: '2025-09-01', updatedAt: '2周前',
      characters: [], terms: [], library: emptyLibrary(),
      chapters: [makeChapter('b_feitu', 40, '第40章 夜城', ['夜城的霓虹照不进地下三层的贫民窟。', '拾荒者数着今天捡到的零件，听见箱子里传来微弱的电流声。'])]
    };

    return { books: [jian, b2, b3, b4, b5, b6, b7], updatedAt: nowText() };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function data() {
    var d = load();
    if (!d || !d.books) { d = seed(); save(d); }
    else { (d.books || []).forEach(ensureLibrary); }
    return d;
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }

  function bookById(id, src) {
    var d = src || data();
    for (var i = 0; i < d.books.length; i++) if (d.books[i].id === id) return ensureLibrary(d.books[i]);
    return null;
  }

  function chapterById(book, id) {
    if (!book || !book.chapters) return null;
    for (var i = 0; i < book.chapters.length; i++) if (book.chapters[i].id === id) return book.chapters[i];
    return null;
  }

  function wordCount(text) {
    return String(text || '').replace(/\s/g, '').length;
  }

  global.RG = {
    KEY: KEY, uid: uid, nowText: nowText,
    seed: seed, load: load, data: data, save: save, restoreFromServer: restoreFromServer,
    bookById: bookById, chapterById: chapterById,
    ensureLibrary: ensureLibrary, emptyLibrary: emptyLibrary,
    makeChapter: makeChapter, wordCount: wordCount
  };
})(window);
