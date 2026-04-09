const el = {
  botStatus: document.getElementById('botStatus'),
  uptime: document.getElementById('uptime'),
  lastFetch: document.getElementById('lastFetch'),
  activeFeedsCount: document.getElementById('activeFeedsCount'),
  newsCount: document.getElementById('newsCount'),
  feedList: document.getElementById('feedList'),
  newsList: document.getElementById('newsList'),
  logPanel: document.getElementById('logPanel'),
  fetchNowBtn: document.getElementById('fetchNowBtn'),
  sendLatestBtn: document.getElementById('sendLatestBtn'),
  themeToggle: document.getElementById('themeToggle'),
  addFeedForm: document.getElementById('addFeedForm'),
  feedName: document.getElementById('feedName'),
  feedUrl: document.getElementById('feedUrl'),
  settingsForm: document.getElementById('settingsForm'),
  postMode: document.getElementById('postMode'),
  discordChannelId: document.getElementById('discordChannelId'),
  fetchIntervalSeconds: document.getElementById('fetchIntervalSeconds'),
  maxNewsPerCycle: document.getElementById('maxNewsPerCycle'),
  rateLimitMs: document.getElementById('rateLimitMs'),
  includeKeywords: document.getElementById('includeKeywords'),
  excludeKeywords: document.getElementById('excludeKeywords'),
  botEnabled: document.getElementById('botEnabled'),
  embedStyle: document.getElementById('embedStyle'),
  accentColor: document.getElementById('accentColor'),
  enableImages: document.getElementById('enableImages'),
  descriptionLength: document.getElementById('descriptionLength'),
  enableCategoryTags: document.getElementById('enableCategoryTags'),
  enableButtons: document.getElementById('enableButtons'),
  footerBrandingText: document.getElementById('footerBrandingText'),
  fallbackImageUrl: document.getElementById('fallbackImageUrl')
};

const THEME_KEY = 'vartha_dashboard_theme';
let settingsDirty = false;
let settingsSaving = false;

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.body.removeAttribute('data-theme');
  }
  if (el.themeToggle) {
    el.themeToggle.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
}

function initTheme() {
  applyTheme(getPreferredTheme());

  if (!el.themeToggle) {
    return;
  }

  el.themeToggle.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

function toInputValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value || '');
}

function renderFeeds(items) {
  el.feedList.innerHTML = '';

  for (const feed of items) {
    const node = document.createElement('div');
    node.className = 'feed-item';
    node.innerHTML = `
      <strong>${feed.name}</strong>
      <div>${feed.url}</div>
      <div class="feed-actions">
        <button data-action="toggle" data-id="${feed.id}">${feed.enabled ? 'Disable' : 'Enable'}</button>
        <button data-action="remove" data-id="${feed.id}">Remove</button>
      </div>
    `;
    el.feedList.appendChild(node);
  }
}

function renderNews(items) {
  el.newsList.innerHTML = '';

  for (const item of items.slice(0, 20)) {
    const node = document.createElement('div');
    node.className = 'news-item';
    node.dataset.link = item.link || '';
    const category = deriveCategory(item);
    node.innerHTML = `
      <strong>${item.title}</strong>
      <div>${item.summary || ''}</div>
      <div class="news-meta">
        <span class="badge">${category}</span>
        <span>${item.source || 'Unknown'}</span>
        <span>${new Date(item.pubDate).toLocaleString()}</span>
      </div>
    `;
    el.newsList.appendChild(node);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deriveCategory(item) {
  const hay = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  if (hay.includes('breaking') || hay.includes('ബ്രേക്കിംഗ്') || hay.includes('latest')) {
    return 'Breaking';
  }
  if (hay.includes('election') || hay.includes('assembly') || hay.includes('poll') || hay.includes('തിരഞ്ഞെടുപ്പ്')) {
    return 'Politics';
  }
  if (hay.includes('tech') || hay.includes('technology') || hay.includes('ai')) {
    return 'Tech';
  }
  if (hay.includes('kerala') || hay.includes('കേരള')) {
    return 'Kerala';
  }
  return 'General';
}

function renderLogs(items) {
  el.logPanel.innerHTML = items
    .slice()
    .reverse()
    .map((line) => {
      const level = String(line.level || 'info').toLowerCase();
      const text = `[${line.timestamp}] [${String(line.level || '').toUpperCase()}] ${line.message}`;
      return `<div class="log-line ${level}">${escapeHtml(text)}</div>`;
    })
    .join('');

  el.logPanel.scrollTop = el.logPanel.scrollHeight;
}

function renderStatus(status, stats = {}) {
  el.botStatus.textContent = status.botOnline ? 'Online' : 'Offline';
  el.botStatus.classList.toggle('online', status.botOnline);
  el.botStatus.classList.toggle('offline', !status.botOnline);
  const started = status.startedAt ? new Date(status.startedAt).toLocaleString() : '-';
  el.uptime.textContent = `Started: ${started}`;
  const lastFetch = status.lastFetchAt ? new Date(status.lastFetchAt).toLocaleString() : '-';
  el.lastFetch.textContent = lastFetch;
  el.activeFeedsCount.textContent = String(stats.activeFeeds || 0);
  el.newsCount.textContent = String(stats.newsCount || 0);
}

function renderSettings(settings) {
  if (settingsDirty || settingsSaving) {
    return;
  }

  el.postMode.value = settings.postMode || 'hybrid';
  el.discordChannelId.value = settings.discordChannelId || '';
  el.fetchIntervalSeconds.value = settings.fetchIntervalSeconds || 1800;
  el.maxNewsPerCycle.value = settings.maxNewsPerCycle || 5;
  el.rateLimitMs.value = settings.rateLimitMs || 1200;
  el.includeKeywords.value = toInputValue(settings.includeKeywords);
  el.excludeKeywords.value = toInputValue(settings.excludeKeywords);
  el.botEnabled.checked = Boolean(settings.botEnabled);
  el.embedStyle.value = settings.embedStyle || 'card';
  el.accentColor.value = settings.accentColor || '#7C3AED';
  el.enableImages.checked = settings.enableImages !== false;
  el.descriptionLength.value = settings.descriptionLength || 200;
  el.enableCategoryTags.checked = settings.enableCategoryTags !== false;
  el.enableButtons.checked = settings.enableButtons !== false;
  el.footerBrandingText.value = settings.footerBrandingText || 'Powered by വാർത്ത ബോട്ട്';
  el.fallbackImageUrl.value = settings.fallbackImageUrl || '';
}

async function refreshAll() {
  const [feeds, news, logs, settings, status] = await Promise.all([
    request('/feeds'),
    request('/news'),
    request('/logs?limit=120'),
    request('/settings'),
    request('/status')
  ]);

  renderFeeds(feeds.items || []);
  renderNews(news.items || []);
  renderLogs(logs.items || []);
  renderSettings(settings.item || {});
  renderStatus(status || {}, {
    activeFeeds: (feeds.items || []).filter((feed) => feed.enabled).length,
    newsCount: (news.items || []).length
  });
}

function initSettingsDirtyTracking() {
  const fields = el.settingsForm.querySelectorAll('input, select, textarea');
  fields.forEach((field) => {
    field.addEventListener('input', () => {
      settingsDirty = true;
    });
    field.addEventListener('change', () => {
      settingsDirty = true;
    });
  });
}

el.fetchNowBtn.addEventListener('click', async () => {
  el.fetchNowBtn.disabled = true;
  el.fetchNowBtn.textContent = 'Fetching...';

  try {
    const response = await request('/fetch', { method: 'POST' });
    if (Number(response?.result?.sent || 0) === 0) {
      await request('/send-latest', {
        method: 'POST',
        body: JSON.stringify({ count: 1 })
      });
    }
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    el.fetchNowBtn.disabled = false;
    el.fetchNowBtn.textContent = 'Fetch Now';
  }
});

el.sendLatestBtn.addEventListener('click', async () => {
  el.sendLatestBtn.disabled = true;
  el.sendLatestBtn.textContent = 'Sending...';

  try {
    await request('/send-latest', {
      method: 'POST',
      body: JSON.stringify({ count: 1 })
    });
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    el.sendLatestBtn.disabled = false;
    el.sendLatestBtn.textContent = 'Send Latest News';
  }
});

el.newsList.addEventListener('click', (event) => {
  const item = event.target.closest('.news-item');
  if (!item || !item.dataset.link) {
    return;
  }
  window.open(item.dataset.link, '_blank', 'noopener,noreferrer');
});

el.feedList.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) {
    return;
  }

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  try {
    if (action === 'toggle') {
      const feeds = await request('/feeds');
      const current = (feeds.items || []).find((f) => f.id === id);
      if (!current) {
        return;
      }

      await request(`/feeds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !current.enabled })
      });
    }

    if (action === 'remove') {
      await request(`/feeds/${id}`, {
        method: 'DELETE'
      });
    }

    await refreshAll();
  } catch (error) {
    alert(error.message);
  }
});

el.addFeedForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await request('/feeds', {
      method: 'POST',
      body: JSON.stringify({
        name: el.feedName.value,
        url: el.feedUrl.value,
        enabled: true
      })
    });

    el.addFeedForm.reset();
    await refreshAll();
  } catch (error) {
    alert(error.message);
  }
});

el.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  settingsSaving = true;

  const payload = {
    postMode: el.postMode.value,
    discordChannelId: el.discordChannelId.value.trim(),
    fetchIntervalSeconds: Number(el.fetchIntervalSeconds.value || 1800),
    maxNewsPerCycle: Number(el.maxNewsPerCycle.value || 5),
    rateLimitMs: Number(el.rateLimitMs.value || 1200),
    includeKeywords: el.includeKeywords.value,
    excludeKeywords: el.excludeKeywords.value,
    botEnabled: el.botEnabled.checked,
    embedStyle: el.embedStyle.value,
    accentColor: el.accentColor.value,
    enableImages: el.enableImages.checked,
    descriptionLength: Number(el.descriptionLength.value || 200),
    enableCategoryTags: el.enableCategoryTags.checked,
    enableButtons: el.enableButtons.checked,
    footerBrandingText: el.footerBrandingText.value.trim(),
    fallbackImageUrl: el.fallbackImageUrl.value.trim()
  };

  try {
    await request('/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    settingsDirty = false;
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    settingsSaving = false;
  }
});

initTheme();
initSettingsDirtyTracking();

refreshAll().catch((error) => {
  console.error(error);
});

setInterval(() => {
  refreshAll().catch(() => {});
}, 10000);
