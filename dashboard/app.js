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

// Initialize Lucide
if (window.lucide) {
  lucide.createIcons();
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

// --- Notifications ---
function showNotification(message, type = 'success') {
  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i> ${escapeHtml(message)}`;
  
  container.appendChild(notif);
  if (window.lucide) lucide.createIcons({ root: notif });

  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(100%)';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

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
  if (el.overviewNewsList) el.overviewNewsList.innerHTML = '<div class="loading-state"><i data-lucide="loader"></i><h4>Loading Pipeline</h4></div>';
  if (window.lucide) lucide.createIcons({ root: el.overviewNewsList });
  
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
        el.overviewNewsList.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i><h4>Pipeline Empty</h4><p>No news articles currently cached.</p></div>';
      } else {
        (news.items || []).slice(0, 5).forEach(item => {
          const node = document.createElement('div');
          node.className = 'list-item';
          node.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div class="list-item-title">${escapeHtml(item.title)}</div>
              <div class="list-item-meta">${escapeHtml(item.source)} • ${new Date(item.pubDate).toLocaleString()}</div>
            </div>
          `;
          el.overviewNewsList.appendChild(node);
        });
      }
      if (window.lucide) lucide.createIcons({ root: el.overviewNewsList });
    }
  } catch (error) {
    if (el.overviewNewsList) el.overviewNewsList.innerHTML = '<div class="error-state"><i data-lucide="alert-triangle"></i><h4>Failed to Load</h4><p>Could not load overview data.</p></div>';
    if (window.lucide) lucide.createIcons({ root: el.overviewNewsList });
    console.error('Error loading overview', error);
  }
}

async function loadGuilds() {
  if (el.guildGrid) el.guildGrid.innerHTML = '<div class="loading-state" style="grid-column: 1/-1;"><i data-lucide="loader"></i><h4>Loading Guilds</h4></div>';
  if (window.lucide) lucide.createIcons({ root: el.guildGrid });
  
  try {
    const { guilds } = await request('/guilds');
    if (!el.guildGrid) return;
    el.guildGrid.innerHTML = '';

    if (!guilds || guilds.length === 0) {
       el.guildGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i data-lucide="server-off"></i><h4>No Guilds Found</h4><p>You have not authorized the bot in any guilds where you hold management permissions.</p></div>';
       if (window.lucide) lucide.createIcons({ root: el.guildGrid });
       return;
    }

    guilds.forEach(g => {
      const node = document.createElement('div');
      node.className = `card elevated ${g.id === currentGuildId ? 'active' : ''}`;
      if (g.id === currentGuildId) node.style.borderColor = 'var(--accent-color)';
      node.onclick = () => selectGuild(g.id, g.name);
      node.style.cursor = 'pointer';

      node.innerHTML = `
        <div class="card-header">
          <div class="card-title" style="color:var(--text-primary); font-size:0.9rem;">${escapeHtml(g.name)}</div>
          <span class="status-indicator ${g.deliveryEnabled ? 'success' : 'danger'}"><i data-lucide="${g.deliveryEnabled ? 'activity' : 'pause-circle'}" style="width:12px;height:12px;"></i> ${g.deliveryEnabled ? 'Active' : 'Disabled'}</span>
        </div>
        <div style="margin-top:auto; padding-top:16px;">
          <span style="font-size:0.75rem; color:var(--text-secondary); font-family:var(--font-mono);">ID: ${g.id === 'GLOBAL' ? 'Default' : g.id}</span>
        </div>
      `;
      el.guildGrid.appendChild(node);
    });
    if (window.lucide) lucide.createIcons({ root: el.guildGrid });
  } catch (error) {
    if (el.guildGrid) el.guildGrid.innerHTML = '<div class="error-state" style="grid-column: 1/-1;"><i data-lucide="alert-triangle"></i><h4>Failed to Load</h4><p>Could not fetch your guilds.</p></div>';
    if (window.lucide) lucide.createIcons({ root: el.guildGrid });
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
  if (el.feedList) el.feedList.innerHTML = '<div class="loading-state"><i data-lucide="loader"></i><h4>Loading Configuration</h4></div>';
  if (window.lucide) lucide.createIcons({ root: el.feedList });
  
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
        el.feedList.innerHTML = '<div class="empty-state"><i data-lucide="rss"></i><h4>No Sources</h4><p>You have not configured any RSS sources for this guild.</p></div>';
      } else {
        (feeds.items || []).forEach(feed => {
          const node = document.createElement('div');
          node.className = 'list-item';
          node.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:4px; max-width:60%;">
              <div class="list-item-title" style="display:flex; align-items:center; gap:8px;">
                ${escapeHtml(feed.name)}
                ${feed.enabled ? '<span class="status-indicator success" style="padding:2px 4px; font-size:0.6rem;"><i data-lucide="check" style="width:10px;height:10px;"></i></span>' : '<span class="status-indicator danger" style="padding:2px 4px; font-size:0.6rem;"><i data-lucide="x" style="width:10px;height:10px;"></i></span>'}
              </div>
              <div class="list-item-meta" style="word-break: break-all;">${escapeHtml(feed.url)}</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
              <button class="btn-secondary" style="padding:6px 12px; font-size:0.7rem;" data-action="toggle" data-id="${feed.id}"><i data-lucide="${feed.enabled ? 'pause' : 'play'}"></i> ${feed.enabled ? 'Disable' : 'Enable'}</button>
              <button class="btn-danger" style="padding:6px 12px; font-size:0.7rem;" data-action="remove" data-id="${feed.id}"><i data-lucide="trash-2"></i> Delete</button>
            </div>
          `;
          el.feedList.appendChild(node);
        });
      }
      if (window.lucide) lucide.createIcons({ root: el.feedList });
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
      el.deliveryStatusText.innerHTML = deliveryEnabled ? '<span class="status-indicator success"><i data-lucide="activity"></i> Active</span>' : '<span class="status-indicator danger"><i data-lucide="pause-circle"></i> Disabled</span>';
      if (el.btnStartDelivery) el.btnStartDelivery.style.display = deliveryEnabled ? 'none' : 'inline-flex';
      if (el.btnStopDelivery) el.btnStopDelivery.style.display = !deliveryEnabled ? 'none' : 'inline-flex';
      if (window.lucide) lucide.createIcons({ root: el.deliveryStatusText.parentElement });
    }

    // Render Logs (initial payload)
    if (el.terminalLogs) {
      el.terminalLogs.innerHTML = '';
      (logs.items || []).slice().reverse().forEach(appendLog);
    }

  } catch (error) {
    if (el.feedList) el.feedList.innerHTML = '<div class="error-state"><i data-lucide="alert-triangle"></i><h4>Configuration Error</h4><p>Failed to load configuration data.</p></div>';
    if (window.lucide) lucide.createIcons({ root: el.feedList });
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
      showNotification('Source provisioned to pipeline.', 'success');
      refreshGuildData();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });
}

if (el.feedList) {
  el.feedList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    try {
      if (action === 'remove') {
        if (!confirm('Are you sure you want to remove this feed?')) return;
        await request(`/feeds/${id}`, { method: 'DELETE' });
        showNotification('Source removed.', 'success');
      } else if (action === 'toggle') {
        const isDisable = btn.textContent.includes('Disable');
        await request(`/feeds/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !isDisable })
        });
        showNotification(`Source ${!isDisable ? 'disabled' : 'enabled'}.`, 'success');
      }
      refreshGuildData();
    } catch (error) {
      showNotification(error.message, 'error');
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
      showNotification('Settings committed successfully.', 'success');
      refreshGuildData();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });
}

if (el.btnStartDelivery) {
  el.btnStartDelivery.addEventListener('click', async () => {
    try {
      await request('/delivery/start', { method: 'POST' });
      showNotification('Delivery pipeline activated.', 'success');
      refreshGuildData();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });
}

if (el.btnStopDelivery) {
  el.btnStopDelivery.addEventListener('click', async () => {
    try {
      await request('/delivery/stop', { method: 'POST' });
      showNotification('Delivery pipeline locked.', 'warning');
      refreshGuildData();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  });
}

if (el.btnFetchNow) {
  el.btnFetchNow.addEventListener('click', async () => {
    const originalText = el.btnFetchNow.innerHTML;
    el.btnFetchNow.disabled = true;
    el.btnFetchNow.innerHTML = '<i data-lucide="loader" class="spin"></i> Executing...';
    if (window.lucide) lucide.createIcons({ root: el.btnFetchNow });
    try {
      const res = await request('/fetch', { method: 'POST' });
      showNotification(`Fetch cycle initiated. Extracted ${res.result?.fetched || 0} items.`, 'success');
      refreshGuildData();
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      el.btnFetchNow.disabled = false;
      el.btnFetchNow.innerHTML = originalText;
      if (window.lucide) lucide.createIcons({ root: el.btnFetchNow });
    }
  });
}

// --- Boot ---
async function boot() {
  await loadUserSession();
  await loadOverview();
  await loadGuilds();
  updateBadges();
  initSocket();
  await refreshGuildData();
}

boot();
