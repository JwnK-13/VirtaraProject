/* =========================================================================
   VIRTARA ARCADE - CORE
   Shared across all game pages. No build step, plain script.

   BACKEND NOTE
   -------------
   Leaderboards are currently stored in localStorage on ArcadeDB, namespaced
   per-browser (there is no server yet, so a leaderboard only shows scores
   set from this browser). Every read/write to leaderboard data goes through
   the ArcadeDB object below so this can be swapped for Supabase/Firebase
   later WITHOUT touching any game page: just replace the body of the
   functions in ArcadeDB with real API calls (they're all already async).
   ========================================================================= */

const ArcadeCore = (() => {

  const LS_PLAYER = 'virtara_arcade_player';
  const LS_LB_PREFIX = 'virtara_arcade_lb_'; // + gameId
  const LS_COLLECTION_SEEN = 'virtara_arcade_collection';

  /* ---------------------------------------------------------------------
     UUID
  --------------------------------------------------------------------- */
  function uuidv4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* ---------------------------------------------------------------------
     ACHIEVEMENTS
  --------------------------------------------------------------------- */
  const ACHIEVEMENTS = [
    { id: 'first_game', name: 'First Game', desc: 'Mainkan game pertamamu di Virtara Arcade', icon: 'gamepad-2' },
    { id: 'quiz_master', name: 'Quiz Master', desc: 'Selesaikan Virtara Quiz dengan skor sempurna', icon: 'brain' },
    { id: 'lucky_player', name: 'Lucky Player', desc: 'Dapatkan kartu Legendary atau lebih tinggi', icon: 'clover' },
    { id: 'collector', name: 'Collector', desc: 'Kumpulkan 15 kartu berbeda', icon: 'layers' },
    { id: 'founder_hunter', name: 'Founder Hunter', desc: 'Dapatkan kartu Founder', icon: 'crown' },
    { id: 'pull_100', name: '100 Pull', desc: 'Lakukan 100 kali gacha', icon: 'sparkles' },
    { id: 'pull_1000', name: '1000 Pull', desc: 'Lakukan 1000 kali gacha', icon: 'sparkle' },
    { id: 'perfect_quiz', name: 'Perfect Quiz', desc: 'Jawab semua soal quiz dengan benar', icon: 'check-circle-2' },
    { id: 'memory_master', name: 'Memory Master', desc: 'Selesaikan Memory Match tingkat Hard', icon: 'brain-circuit' },
    { id: 'guess_master', name: 'Guess Master', desc: 'Tebak gambar benar di percobaan pertama', icon: 'eye' },
    { id: 'patriot', name: 'Patriot', desc: 'Selesaikan kategori Kemerdekaan Indonesia dengan sempurna', icon: 'flag' },
    { id: 'virtara_fan', name: 'Virtara Fan', desc: 'Mainkan semua 5 mini game Virtara Arcade', icon: 'heart' },
  ];

  /* ---------------------------------------------------------------------
     CARD DATABASE
     Semua kartu diambil langsung dari foto di folder games/imgcard/<Rarity>/.
     Nama kartu = nama file foto (tanpa ekstensi). Rarity kartu ditentukan
     oleh sub-folder tempat fotonya berada.
     Founder = belum ada foto resminya, jadi tetap pakai lencana placeholder
     sampai asetnya tersedia.
  --------------------------------------------------------------------- */
  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'staff', 'founder'];

  const RARITY_META = {
    common:    { label: 'Common',    color: '#9CA3AF', coin: 1,   weight: 45   },
    uncommon:  { label: 'Uncommon',  color: '#4ADE80', coin: 2,   weight: 25   },
    rare:      { label: 'Rare',      color: '#38BDF8', coin: 3,   weight: 15   },
    epic:      { label: 'Epic',      color: '#A78BFA', coin: 10,  weight: 8    },
    legendary: { label: 'Legendary', color: '#F4D03F', coin: 25,  weight: 4    },
    mythic:    { label: 'Mythic',    color: '#C41E3A', coin: 75,  weight: 2.5  },
    staff:     { label: 'Staff',     color: '#22D3EE', coin: 150, weight: 0.4  },
    founder:   { label: 'Founder',   color: '#D4AF37', coin: 500, weight: 0.1  },
  };

  // Nama file foto persis seperti di games/imgcard/<folder>/ (termasuk ekstensi).
  const CARD_ASSETS = {
    common: [
      'Elya Rosabelle.jpg', 'Faraby Nichella.jpg', 'Iana Muffin.jpg', 'Key Oriesa.jpg',
      'Kitsuno Hikuya.jpg', 'Krow Thornes.jpg', 'Marchie Stellar.jpg', 'Sami Maono.jpg',
      'Shin Derra.jpg', 'Solace Amerta.jpg',
    ],
    uncommon: [
      'Ayama Shu.jpg', 'Gin Chibii.jpg', 'Harris Chibii.jpg', 'Kuroki.jpg',
      'Lumi Celestia.jpg', 'Rijii.jpg', 'andi andinata.jpg', 'kakek istmodius.jpg',
      'krow plenger.jpg', 'makoto takuma.jpg', 'mythia chibii.jpg', 'ushimiya.jpg',
      'zen gunawan.jpg',
    ],
    rare: [
      'Amarynn.jpg', 'Isha Kirana.jpg', 'Maura Nilambari.jpg', 'Pia Meraleo.jpg',
      'Pinku Rimu.jpg', 'Selia Aisnith.jpg', 'Shannon.jpg', 'Tana Nona.jpg',
    ],
    epic: [
      'Elaine Celestia.jpg', 'Gingitsu Gehenna.jpg', 'Mikazuki Arion.jpg', 'Vestia Zeta.jpg',
    ],
    legendary: [
      'Harris Caine.jpg', 'Mythia Batford.jpg', 'kobo kanaeru.jpg',
    ],
    mythic: [
      'Awaa.png', 'Chelia.png', 'Kairi.png', 'Lumie.png', 'Nova.png', 'Odel.png',
      'chrisel.jpeg', 'hikari.png', 'model theo.png',
    ],
    staff: [
      'Arche Yuta.jpg', 'Dajiken Aoi.jpg', 'Zarie Astolmave.jpg',
    ],
  };

  // Nama folder di disk (case-sensitive, harus sama persis dengan games/imgcard/*)
  const RARITY_FOLDER = {
    common: 'common', uncommon: 'uncommon', rare: 'rare',
    epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic', staff: 'Staff',
  };

  const EDITION_BY_RARITY = {
    common: 'Sketch Edition', uncommon: 'Standard Edition', rare: 'Special Edition',
    epic: 'Holo Edition', legendary: 'Golden Edition', mythic: 'Official', staff: 'Official',
  };

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function buildCardDatabase() {
    const cards = [];

    Object.keys(CARD_ASSETS).forEach(rarity => {
      const folder = RARITY_FOLDER[rarity];
      CARD_ASSETS[rarity].forEach(file => {
        const name = file.replace(/\.[^.]+$/, '');
        cards.push({
          id: `${rarity}_${slugify(name)}`,
          name,
          rarity,
          image: `imgcard/${folder}/${file}`,
          edition: EDITION_BY_RARITY[rarity],
        });
      });
    });

    cards.push({ id: 'founder_1', name: 'Founder Virtara Project', rarity: 'founder', image: null, edition: 'Placeholder', icon: 'crown' });

    return cards;
  }

  const CARD_DB = buildCardDatabase();
  const CARD_BY_ID = Object.fromEntries(CARD_DB.map(c => [c.id, c]));

  /* ---------------------------------------------------------------------
     PLAYER PROFILE
  --------------------------------------------------------------------- */
  function defaultPlayer(uuid, username) {
    return {
      uuid,
      username,
      level: 1,
      xp: 0,
      coin: 20,
      badges: [],
      achievements: [],
      gamesPlayed: [],
      collection: {},
      pullCount: 0,
      upgrades: { luck: 0, autoSpin: 0, animSpeed: 0, dailyBonus: 0 },
      lastDailyClaim: null,
      favoriteGame: null,
      bestRank: null,
      joinDate: new Date().toISOString(),
    };
  }

  function hasPlayer() {
    return !!localStorage.getItem(LS_PLAYER);
  }

  function getPlayer() {
    const raw = localStorage.getItem(LS_PLAYER);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function savePlayer(player) {
    localStorage.setItem(LS_PLAYER, JSON.stringify(player));
    return player;
  }

  function createPlayer(username) {
    const uuid = uuidv4();
    const player = defaultPlayer(uuid, username.trim().slice(0, 24));
    savePlayer(player);
    return player;
  }

  function renamePlayer(newUsername) {
    const p = getPlayer();
    if (!p) return null;
    p.username = newUsername.trim().slice(0, 24);
    return savePlayer(p);
  }

  /* ---------------------------------------------------------------------
     XP / LEVEL / COIN
  --------------------------------------------------------------------- */
  function xpForLevel(level) { return (level - 1) * 100; }
  function levelFromXp(xp) { return Math.floor(xp / 100) + 1; }

  function addXp(amount) {
    const p = getPlayer();
    if (!p) return null;
    p.xp += amount;
    p.level = levelFromXp(p.xp);
    savePlayer(p);
    return p;
  }

  function addCoin(amount) {
    const p = getPlayer();
    if (!p) return null;
    p.coin = Math.max(0, p.coin + amount);
    savePlayer(p);
    return p;
  }

  function spendCoin(amount) {
    const p = getPlayer();
    if (!p || p.coin < amount) return false;
    p.coin -= amount;
    savePlayer(p);
    return true;
  }

  function markGamePlayed(gameId) {
    const p = getPlayer();
    if (!p) return null;
    if (!p.gamesPlayed.includes(gameId)) p.gamesPlayed.push(gameId);
    savePlayer(p);
    unlockAchievement('first_game');
    if (p.gamesPlayed.length >= 5) unlockAchievement('virtara_fan');
    return p;
  }

  /* ---------------------------------------------------------------------
     ACHIEVEMENTS / BADGES
  --------------------------------------------------------------------- */
  function unlockAchievement(id) {
    const p = getPlayer();
    if (!p) return null;
    if (p.achievements.includes(id)) return p;
    p.achievements.push(id);
    if (!p.badges.includes(id)) p.badges.push(id);
    savePlayer(p);
    return p;
  }

  function getAchievementMeta(id) {
    return ACHIEVEMENTS.find(a => a.id === id);
  }

  /* ---------------------------------------------------------------------
     GACHA
  --------------------------------------------------------------------- */
  function rollRarity(luckLevel) {
    const weights = {};
    let total = 0;
    RARITY_ORDER.forEach(r => {
      let w = RARITY_META[r].weight;
      // Luck upgrade nudges weight away from common/uncommon toward rare+.
      if (luckLevel > 0) {
        const bump = luckLevel * 0.15;
        if (r === 'common') w = Math.max(5, w - bump * 4);
        else if (r === 'uncommon') w = Math.max(5, w - bump * 2);
        else if (r !== 'common') w = w + bump;
      }
      weights[r] = w;
      total += w;
    });
    let roll = Math.random() * total;
    for (const r of RARITY_ORDER) {
      if (roll < weights[r]) return r;
      roll -= weights[r];
    }
    return 'common';
  }

  function pullCard(luckLevel) {
    const rarity = rollRarity(luckLevel || 0);
    const pool = CARD_DB.filter(c => c.rarity === rarity);
    const card = pool[Math.floor(Math.random() * pool.length)];
    return card;
  }

  function grantCard(card) {
    const p = getPlayer();
    if (!p) return null;
    p.collection[card.id] = (p.collection[card.id] || 0) + 1;
    p.pullCount += 1;
    p.coin += RARITY_META[card.rarity].coin;
    savePlayer(p);

    if (card.rarity === 'legendary' || card.rarity === 'mythic' || card.rarity === 'staff' || card.rarity === 'founder') {
      unlockAchievement('lucky_player');
    }
    if (card.rarity === 'founder') unlockAchievement('founder_hunter');
    if (Object.keys(p.collection).length >= 15) unlockAchievement('collector');
    if (p.pullCount >= 100) unlockAchievement('pull_100');
    if (p.pullCount >= 1000) unlockAchievement('pull_1000');

    return getPlayer();
  }

  function collectionStats() {
    const p = getPlayer();
    if (!p) return { owned: 0, total: CARD_DB.length, percent: 0 };
    const owned = Object.keys(p.collection).length;
    return { owned, total: CARD_DB.length, percent: Math.round((owned / CARD_DB.length) * 100) };
  }

  /* ---------------------------------------------------------------------
     UPGRADES (Coin sink)
  --------------------------------------------------------------------- */
  const UPGRADE_META = {
    luck:        { label: 'Upgrade Luck',           desc: 'Sedikit menaikkan peluang kartu rarity tinggi', baseCost: 30, icon: 'clover' },
    autoSpin:    { label: 'Upgrade Auto Spin',      desc: 'Buka slot Auto Spin (spin berturut-turut otomatis)', baseCost: 50, icon: 'refresh-cw' },
    animSpeed:   { label: 'Upgrade Animation Speed',desc: 'Mempercepat animasi buka kartu', baseCost: 20, icon: 'zap' },
    dailyBonus:  { label: 'Upgrade Daily Bonus',    desc: 'Menaikkan hadiah Daily Reward', baseCost: 40, icon: 'gift' },
  };

  function upgradeCost(type) {
    const p = getPlayer();
    const lvl = p ? p.upgrades[type] : 0;
    return Math.round(UPGRADE_META[type].baseCost * Math.pow(1.6, lvl));
  }

  function buyUpgrade(type) {
    const cost = upgradeCost(type);
    if (!spendCoin(cost)) return { ok: false, reason: 'coin' };
    const p = getPlayer();
    p.upgrades[type] += 1;
    savePlayer(p);
    return { ok: true, level: p.upgrades[type] };
  }

  /* ---------------------------------------------------------------------
     DAILY REWARD
  --------------------------------------------------------------------- */
  function canClaimDaily() {
    const p = getPlayer();
    if (!p) return false;
    if (!p.lastDailyClaim) return true;
    const last = new Date(p.lastDailyClaim).getTime();
    return Date.now() - last >= 24 * 60 * 60 * 1000;
  }

  function claimDaily() {
    if (!canClaimDaily()) return null;
    const p = getPlayer();
    const bonusLevel = p.upgrades.dailyBonus;
    const reward = {
      coin: 15 + bonusLevel * 5,
      xp: 10 + bonusLevel * 3,
      freeSpin: 1 + Math.floor(bonusLevel / 2),
    };
    p.coin += reward.coin;
    p.xp += reward.xp;
    p.level = levelFromXp(p.xp);
    p.lastDailyClaim = new Date().toISOString();
    savePlayer(p);
    return reward;
  }

  /* ---------------------------------------------------------------------
     LEADERBOARD (localStorage now, swappable for real backend later)
  --------------------------------------------------------------------- */
  const ArcadeDB = {
    async submitScore(gameId, entry) {
      const key = LS_LB_PREFIX + gameId;
      let list = [];
      try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { list = []; }
      const idx = list.findIndex(e => e.uuid === entry.uuid);
      const record = { ...entry, date: new Date().toISOString() };
      if (idx === -1) {
        list.push(record);
      } else if (entry.score > list[idx].score) {
        list[idx] = record;
      }
      localStorage.setItem(key, JSON.stringify(list));
      return record;
    },
    async getLeaderboard(gameId, limit = 100) {
      const key = LS_LB_PREFIX + gameId;
      let list = [];
      try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { list = []; }
      list.sort((a, b) => b.score - a.score);
      return list.slice(0, limit);
    },
  };

  return {
    ACHIEVEMENTS, RARITY_ORDER, RARITY_META, CARD_DB, CARD_BY_ID,
    hasPlayer, getPlayer, savePlayer, createPlayer, renamePlayer,
    addXp, addCoin, spendCoin, markGamePlayed, xpForLevel, levelFromXp,
    unlockAchievement, getAchievementMeta,
    pullCard, grantCard, collectionStats,
    UPGRADE_META, upgradeCost, buyUpgrade,
    canClaimDaily, claimDaily,
    ArcadeDB,
  };
})();
