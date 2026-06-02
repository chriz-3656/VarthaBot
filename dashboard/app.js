let currentGuildId = 'GLOBAL';
let currentGuildName = 'System Defaults';
let settingsDirty = false;
let socket = null;

const el = {
  navItems: document.querySelectorAll('.nav-item'),
  pages: document.querySelectorAll('.page-container'),
  pageTitle: document.getElementById('pageTitle'),
  
  // User Profile
  userName: document.getElementById('userName'),
  userAvatar: document.getElementById('userAvatar'),
  userAvatarFallback: document.getElementById('userAvatarFallback'),

  // Overview
  botStatus: document.getElementById('botStatus'),
  guildCount: document.getElementById('guildCount'),
  systemUptime: document.getElementById('systemUptime'),
  overviewNewsList: document.getElementById('overviewNewsList'),

  // Guilds
  guildGrid: document.getElementById('guildGrid'),

  // Badges
  badges: [
    document.getElementById('currentGuildFeedsBadge'),
    document.getElementById('currentGuildDeliveryBadge'),
    document.getElementById('currentGuildLogsBadge')
  ],

  // Feeds
  feedList: document.getElementById('feedList'),
  addFeedForm: document.getElementById('addFeedForm'),
  feedName: document.getElementById('feedName'),
  feedUrl: document.getElementById('feedUrl'),

  // Delivery
  deliveryStatusText: document.getElementById('deliveryStatusText'),
  btnStartDelivery: document.getElementById('btnStartDelivery'),
  btnStopDelivery: document.getElementById('btnStopDelivery'),
  btnFetchNow: document.getElementById('btnFetchNow'),
  
  // Settings Form
  settingsForm: document.getElementById('settingsForm'),
  discordChannelId: document.getElementById('discordChannelId'),
  webhookUrl: document.getElementById('webhookUrl'),
  fetchIntervalSeconds: document.getElementById('fetchIntervalSeconds'),
  includeKeywords: document.getElementById('includeKeywords'),

  // Logs
  terminalLogs: document.getElementById('terminalLogs'),
  
  // Mobile UI
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  sidebar: document.querySelector('.sidebar')
};

// --- Mobile UI ---
if (el.mobileMenuBtn) {
  el.mobileMenuBtn.addEventListener('click', () => {
    el.sidebar.classList.toggle('open');
  });
}

// --- Navigation ---
el.navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.target;
    
    el.navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    el.pages.forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${target}`);
    if (targetPage) targetPage.classList.remove('hidden');
    
    el.pageTitle.textContent = item.textContent;
    
    // Close sidebar on mobile after clicking
    if (window.innerWidth <= 1024) {
      el.sidebar.classList.remove('open');
    }
  });
});

// --- API Helpers ---
async function request(path, options = {}) {
  const separator = path.includes('?') ? '&' : '?';
  const fullPath = `/api${path}${separator}guildId=${currentGuildId}`;
  
  const res = await fetch(fullPath, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/auth/discord';
      return;
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateBadges() {
  el.badges.forEach(b => {
    if (b) b.textContent = currentGuildName;
  });
}

// --- Socket.IO ---
function initSocket() {
  if (socket) socket.disconnect();
  
  socket = io({ path: '/socket.io' });
  
  socket.on('connect', () => {
    socket.emit('subscribe_logs', currentGuildId);
  });

  socket.on('new_log', (entry) => {
    appendLog(entry);
  });
}

function appendLog(line) {
  if (!el.terminalLogs) return;
  const level = String(line.level || 'info').toLowerCase();
  const text = `[${line.timestamp}] [${String(line.level || '').toUpperCase()}] ${line.message}`;
  
  const div = document.createElement('div');
  div.className = `log-line log-${level}`;
  div.textContent = text;
  
  el.terminalLogs.appendChild(div);
  
  // Auto-scroll
  if (el.terminalLogs.childNodes.length > 300) {
    el.terminalLogs.removeChild(el.terminalLogs.firstChild);
  }
  el.terminalLogs.scrollTop = el.terminalLogs.scrollHeight;
}

// --- Data Fetching & Rendering ---
async function loadUserSession() {
  try {
    const data = await request('/me');
    if (data.user) {
      el.userName.textContent = data.user.username;
      if (data.user.avatar) {
        el.userAvatar.src = `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png`;
        el.userAvatar.style.display = 'block';
        el.userAvatarFallback.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Failed to load user session', error);
  }
}

async function loadOverview() {
  try {
    const status = await request('/status');
    const news = await request('/news');

    el.botStatus.textContent = status.botOnline ? 'Online' : 'Offline';
    el.guildCount.textContent = String(status.guildCount || 0);
    
    if (status.startedAt) {
      const start = new Date(status.startedAt);
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      el.systemUptime.textContent = `${h}h ${m}m`;
    }

    if (el.overviewNewsList) {
      el.overviewNewsList.innerHTML = '';
      if (!news.items || news.items.length === 0) {
        el.overviewNewsList.innerHTML = '<div class="card"><p style="color:var(--text-secondary); text-align:center;">No news articles in pipeline cache.</p></div>';
      } else {
        (news.items || []).slice(0, 5).forEach(item => {
          const node = document.createElement('div');
          node.className = 'list-item';
          node.innerHTML = `
            <div class="list-item-content">
              <h4>${escapeHtml(item.title)}</h4>
              <p>${escapeHtml(item.source)} • ${new Date(item.pubDate).toLocaleString()}</p>
            </div>
          `;
          el.overviewNewsList.appendChild(node);
        });
      }
    }

  } catch (error) {
    console.error('Error loading overview', error);
  }
}

async function loadGuilds() {
  try {
    const { guilds } = await request('/guilds');
    if (!el.guildGrid) return;
    el.guildGrid.innerHTML = '';

    guilds.forEach(g => {
      const node = document.createElement('div');
      node.className = `card guild-card ${g.id === currentGuildId ? 'active' : ''}`;
      node.onclick = () => selectGuild(g.id, g.name);

      node.innerHTML = `
        <div class="guild-header">
          <div class="guild-icon">${g.name.charAt(0)}</div>
          <div class="guild-name">${escapeHtml(g.name)}</div>
        </div>
        <div style="display:flex; justify-content: space-between; align-items:center; gap: 10px; flex-wrap: wrap;">
          <span style="font-size:0.75rem; color:var(--text-secondary)">ID: ${g.id === 'GLOBAL' ? 'Default' : g.id}</span>
          <span class="badge ${g.deliveryEnabled ? 'success' : 'danger'}">${g.deliveryEnabled ? 'Active' : 'Disabled'}</span>
        </div>
      `;
      el.guildGrid.appendChild(node);
    });
  } catch (error) {
    console.error('Error loading guilds', error);
  }
}

function selectGuild(id, name) {
  currentGuildId = id;
  currentGuildName = name;
  updateBadges();
  initSocket(); // Re-subscribe to logs
  refreshGuildData();
  loadGuilds(); // re-render to update active class
}

async function refreshGuildData() {
  try {
    const [feeds, settings, logs, status] = await Promise.all([
      request('/feeds'),
      request('/settings'),
      request('/logs?limit=50'),
      request('/status')
    ]);

    // Render Feeds
    if (el.feedList) {
      el.feedList.innerHTML = '';
      if (!feeds.items || feeds.items.length === 0) {
        el.feedList.innerHTML = '<div class="card"><p style="color:var(--text-secondary); text-align:center;">No feeds configured for this guild.</p></div>';
      } else {
        (feeds.items || []).forEach(feed => {
          const node = document.createElement('div');
          node.className = 'list-item';
          node.innerHTML = `
            <div class="list-item-content">
              <h4>${escapeHtml(feed.name)}</h4>
              <p style="word-break: break-all;">${escapeHtml(feed.url)}</p>
            </div>
            <div class="list-item-actions">
              <button class="btn-secondary" data-action="toggle" data-id="${feed.id}">${feed.enabled ? 'Disable' : 'Enable'}</button>
              <button class="btn-danger" data-action="remove" data-id="${feed.id}">Delete</button>
            </div>
          `;
          el.feedList.appendChild(node);
        });
      }
    }

    // Render Settings
    if (!settingsDirty) {
      const s = settings.item || {};
      if (el.discordChannelId) el.discordChannelId.value = s.discordChannelId || '';
      if (el.webhookUrl) el.webhookUrl.value = s.webhookUrl || '';
      if (el.fetchIntervalSeconds) el.fetchIntervalSeconds.value = s.fetchIntervalSeconds || 1800;
      if (el.includeKeywords) el.includeKeywords.value = Array.isArray(s.includeKeywords) ? s.includeKeywords.join(', ') : '';
    }

    // Render Status
    if (el.deliveryStatusText) {
      const deliveryEnabled = status.deliveryEnabled !== false;
      el.deliveryStatusText.textContent = deliveryEnabled ? 'Delivery is currently ACTIVE.' : 'Delivery is currently DISABLED.';
      if (el.btnStartDelivery) el.btnStartDelivery.disabled = deliveryEnabled;
      if (el.btnStopDelivery) el.btnStopDelivery.disabled = !deliveryEnabled;
    }

    // Render Logs (initial payload)
    if (el.terminalLogs) {
      el.terminalLogs.innerHTML = '';
      (logs.items || []).slice().reverse().forEach(appendLog);
    }

  } catch (error) {
    console.error('Error refreshing guild data', error);
  }
}

// --- Event Listeners ---
if (el.addFeedForm) {
  el.addFeedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await request('/feeds', {
        method: 'POST',
        body: JSON.stringify({ name: el.feedName.value, url: el.feedUrl.value })
      });
      el.addFeedForm.reset();
      refreshGuildData();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (el.feedList) {
  el.feedList.addEventListener('click', async (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const id = e.target.dataset.id;
    const action = e.target.dataset.action;

    try {
      if (action === 'remove') {
        if (!confirm('Are you sure you want to remove this feed?')) return;
        await request(`/feeds/${id}`, { method: 'DELETE' });
      } else if (action === 'toggle') {
        const isDisable = e.target.textContent === 'Disable';
        await request(`/feeds/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !isDisable })
        });
      }
      refreshGuildData();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (el.settingsForm) {
  el.settingsForm.addEventListener('input', () => settingsDirty = true);
  el.settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      discordChannelId: el.discordChannelId.value.trim(),
      webhookUrl: el.webhookUrl.value.trim(),
      fetchIntervalSeconds: Number(el.fetchIntervalSeconds.value || 1800),
      includeKeywords: el.includeKeywords.value
    };

    try {
      await request('/settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      settingsDirty = false;
      alert('Settings saved successfully.');
      refreshGuildData();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (el.btnStartDelivery) {
  el.btnStartDelivery.addEventListener('click', async () => {
    try {
      await request('/delivery/start', { method: 'POST' });
      refreshGuildData();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (el.btnStopDelivery) {
  el.btnStopDelivery.addEventListener('click', async () => {
    try {
      await request('/delivery/stop', { method: 'POST' });
      refreshGuildData();
    } catch (error) {
      alert(error.message);
    }
  });
}

if (el.btnFetchNow) {
  el.btnFetchNow.addEventListener('click', async () => {
    el.btnFetchNow.disabled = true;
    el.btnFetchNow.textContent = 'Fetching...';
    try {
      const res = await request('/fetch', { method: 'POST' });
      alert(`Fetch cycle initiated.\nFetched: ${res.result?.fetched || 0} items.`);
      refreshGuildData();
    } catch (error) {
      alert(error.message);
    } finally {
      el.btnFetchNow.disabled = false;
      el.btnFetchNow.textContent = 'Test Pipeline';
    }
  });
}

// --- Mechanical Interactions (Dark Neo-brutalism) ---
function initMechanicalInteractions() {
  // Buttons: click-down animation
  document.querySelectorAll('.btn-primary, .btn-secondary, .btn-danger').forEach(btn => {
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'translate(2px, 2px)';
    });
    
    btn.addEventListener('mouseup', () => {
      btn.style.transform = '';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // Cards: lift animation on hover (CSS handles most, this ensures mobile works)
  document.querySelectorAll('.card, .list-item').forEach(card => {
    card.addEventListener('touchstart', () => {
      card.style.transform = 'translate(-2px, -2px)';
    });
    
    card.addEventListener('touchend', () => {
      card.style.transform = '';
    });
  });

  // Mobile menu button mechanical feedback
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('mousedown', function() {
      this.style.transform = 'scale(0.95)';
    });
    
    mobileMenuBtn.addEventListener('mouseup', function() {
      this.style.transform = '';
    });
    
    mobileMenuBtn.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  }

  // Nav items: highlight on click
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('mousedown', function() {
      this.style.transform = 'translate(1px, 1px)';
    });
    
    item.addEventListener('mouseup', function() {
      this.style.transform = '';
    });
  });

  // Form controls: focus glow
  document.querySelectorAll('.form-control').forEach(input => {
    input.addEventListener('focus', function() {
      this.style.borderWidth = '4px';
    });
    
    input.addEventListener('blur', function() {
      this.style.borderWidth = '2px';
    });
  });
}

// --- Boot ---
async function boot() {
  await loadUserSession();
  await loadOverview();
  await loadGuilds();
  updateBadges();
  initSocket();
  initMechanicalInteractions();
  await refreshGuildData();
}

boot();
