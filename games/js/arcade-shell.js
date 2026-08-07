/* Virtara Arcade — shared shell (navbar + Virtara ID modal + player HUD). */

const ArcadeShell = (() => {

  function navHtml(activePath) {
    const links = [
      { href: 'index.html', label: 'Arcade', icon: 'home' },
      { href: 'quiz.html', label: 'Quiz', icon: 'brain' },
      { href: 'gacha.html', label: 'Brewek VTuber', icon: 'sparkles' },
      { href: 'tebak-gambar.html', label: 'Tebak Gambar', icon: 'image' },
      { href: 'memory.html', label: 'Memory Match', icon: 'grid-3x3' },
      { href: 'tebak-siluet.html', label: 'Tebak Siluet', icon: 'user' },
      { href: 'leaderboard.html', label: 'Leaderboard', icon: 'trophy' },
      { href: 'profile.html', label: 'Profil', icon: 'user-circle' },
    ];
    const items = links.map(l => `
      <a href="${l.href}" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activePath === l.href ? 'bg-virtara-gold/15 text-virtara-gold' : 'text-virtara-cream/70 hover:text-virtara-gold hover:bg-virtara-gold/5'}">
        <i data-lucide="${l.icon}" class="w-4 h-4"></i>${l.label}
      </a>`).join('');
    return `
    <nav class="sticky top-0 z-40 bg-virtara-dark/95 backdrop-blur-md border-b border-virtara-gold/20">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16 gap-4">
          <a href="../index.html" class="flex items-center gap-2 shrink-0">
            <img src="../img/virtara.jpg" class="w-9 h-9 rounded-full object-cover border-2 border-virtara-gold" alt="Virtara">
            <span class="hidden sm:inline font-display font-bold text-virtara-gold">Virtara Arcade</span>
          </a>
          <div class="flex items-center gap-1 overflow-x-auto no-scrollbar">${items}</div>
          <div id="hudMini" class="hidden md:flex items-center gap-3 shrink-0"></div>
        </div>
      </div>
    </nav>`;
  }

  function hudHtml(player) {
    if (!player) return '';
    return `
      <div class="flex items-center gap-1.5 arcade-stat px-3 py-1.5 text-xs">
        <i data-lucide="star" class="w-3.5 h-3.5 text-virtara-gold"></i> Lv.${player.level}
      </div>
      <div class="flex items-center gap-1.5 arcade-stat px-3 py-1.5 text-xs">
        <i data-lucide="coins" class="w-3.5 h-3.5 text-virtara-gold"></i> ${player.coin}
      </div>`;
  }

  function renderNav(activePath) {
    const holder = document.getElementById('arcadeNav');
    if (holder) holder.innerHTML = navHtml(activePath);
    const hud = document.getElementById('hudMini');
    if (hud) hud.innerHTML = hudHtml(ArcadeCore.getPlayer());
    if (window.lucide) lucide.createIcons();
  }

  function showOnboardModal(onDone) {
    const backdrop = document.createElement('div');
    backdrop.className = 'vid-modal-backdrop';
    backdrop.innerHTML = `
      <div class="arcade-card max-w-md w-[90%] p-8 text-center">
        <img src="../img/virtara.jpg" class="w-16 h-16 rounded-full object-cover border-2 border-virtara-gold mx-auto mb-4">
        <h2 class="font-display text-2xl font-bold text-virtara-gold mb-2">Selamat Datang di Virtara Arcade</h2>
        <p class="text-virtara-cream/70 text-sm mb-6">Silakan buat Username Anda. Username hanya digunakan untuk leaderboard dan penyimpanan progres game — tidak perlu email atau password.</p>
        <input id="vidUsernameInput" type="text" maxlength="24" placeholder="Username"
          class="w-full px-4 py-3 rounded-lg bg-virtara-surface border border-virtara-gold/30 text-virtara-cream mb-2 focus:outline-none focus:border-virtara-gold" />
        <p id="vidError" class="text-virtara-bright-red text-xs mb-4 h-4"></p>
        <button id="vidStartBtn" class="w-full py-3 rounded-lg bg-gradient-to-r from-virtara-bright-red to-virtara-deep-red font-semibold gold-glow hover:scale-[1.02] transition-transform">
          Mulai Bermain
        </button>
      </div>`;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#vidUsernameInput');
    const err = backdrop.querySelector('#vidError');
    const btn = backdrop.querySelector('#vidStartBtn');
    input.focus();

    async function submit() {
      const val = input.value.trim();
      if (val.length < 3) { err.textContent = 'Username minimal 3 karakter.'; return; }
      try {
        // Try Firebase first
        if (window.FirebaseDB) {
          const result = await window.FirebaseDB.createAccount(val);
          // Create local player from Firebase result
          const player = ArcadeCore.defaultPlayer ? 
            ArcadeCore.defaultPlayer(result.uuid, result.username) : 
            { uuid: result.uuid, username: result.username, ...result.player };
          // Copy data from result.player
          const localPlayer = ArcadeCore.getPlayer() || {};
          Object.assign(localPlayer, result.player);
          localPlayer.uuid = result.uuid;
          localPlayer.username = result.username;
          ArcadeCore.savePlayer(localPlayer);
          backdrop.remove();
          onDone();
          return;
        }
      } catch (e) {
        if (e.message === 'USERNAME_TAKEN') {
          err.textContent = 'Username sudah digunakan. Silakan pilih username lain.';
          return;
        }
        console.warn('Firebase create account failed, using localStorage:', e);
      }
      // Fallback: localStorage only
      ArcadeCore.createPlayer(val);
      backdrop.remove();
      onDone();
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  function showAchievementToast(id) {
    const meta = ArcadeCore.getAchievementMeta(id);
    if (!meta) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast p-4 flex items-center gap-3 max-w-xs';
    toast.innerHTML = `
      <div class="w-10 h-10 rounded-full bg-virtara-gold/15 flex items-center justify-center shrink-0">
        <i data-lucide="${meta.icon}" class="w-5 h-5 text-virtara-gold"></i>
      </div>
      <div>
        <p class="text-xs text-virtara-gold uppercase tracking-wider">Achievement Unlocked</p>
        <p class="font-semibold text-sm">${meta.name}</p>
      </div>`;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => toast.remove(), 4200);
  }

  /** Unlock an achievement and show a toast only if newly unlocked. */
  function unlockWithToast(id) {
    const before = ArcadeCore.getPlayer();
    const already = before && before.achievements.includes(id);
    ArcadeCore.unlockAchievement(id);
    if (!already) showAchievementToast(id);
  }

  function init(opts) {
    opts = opts || {};
    renderNav(opts.activePath || '');
    if (!ArcadeCore.hasPlayer()) {
      showOnboardModal(() => {
        renderNav(opts.activePath || '');
        if (opts.onReady) opts.onReady();
      });
    } else if (opts.onReady) {
      opts.onReady();
    }
  }

  return { init, renderNav, showAchievementToast, unlockWithToast };
})();