let sb = null;
let lastPdfBlob = null;
let currentUser = null;
let currentApiData = null;

function $(id) {
  return document.getElementById(id);
}

async function initSupabase() {
  try {
    const res = await fetch('/api/v1/config');
    const config = await res.json();
    sb = window.supabase.createClient(config.supabaseUrl, config.anonKey, {
      auth: { flowType: 'pkce' }
    });
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUserData();
        if (event === 'SIGNED_IN') {
          setTimeout(() => showScreen('dashboard'), 100);
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentApiData = null;
        updateUI();
      }
    });
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      fetchUserData();
    } else {
      updateUI();
    }
  } catch (e) {
    console.error('Failed to init Supabase', e);
  }
}

async function fetchUserData() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    currentUser = null;
    currentApiData = null;
    updateUI();
    return;
  }
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer ' + session.access_token }
    });
    const data = await res.json();
    if (data.user) {
      currentUser = data.user;
      currentApiData = {
        api_key: data.api_key,
        used: data.used,
        limit: data.limit,
        remaining: data.remaining,
      };
    } else {
      currentUser = null;
      currentApiData = null;
    }
  } catch (e) {
    console.error('Failed to fetch user data', e);
    currentUser = null;
    currentApiData = null;
  }
  updateUI();
}

function updateUI() {
  const signedIn = !!currentUser;
  $('nav-signin').classList.toggle('hidden', signedIn);
  $('nav-dashboard').classList.toggle('hidden', !signedIn);
  $('nav-user').classList.toggle('hidden', !signedIn);
  if (currentUser) {
    const avatar = $('nav-avatar');
    const initial = (currentUser.name?.[0] || '?').toUpperCase();
    avatar.src = currentUser.avatar ||
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2336363f" width="100" height="100" rx="50"/><text x="50" y="56" text-anchor="middle" fill="%23fff" font-size="36" font-family="sans-serif">' + initial + '</text></svg>';
    avatar.onerror = function() {
      this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2336363f" width="100" height="100" rx="50"/><text x="50" y="56" text-anchor="middle" fill="%23fff" font-size="36" font-family="sans-serif">' + initial + '</text></svg>';
    };
  }
  routeFromHash();
}

function routeFromHash() {
  const hash = window.location.hash.split('?')[0];
  const signedIn = !!currentUser;
  if (hash === '#dashboard') {
    if (!signedIn) { showScreen('login'); return; }
    showScreen('dashboard');
    loadDashboard();
  } else if (hash === '#login') {
    signedIn ? (showScreen('dashboard'), loadDashboard()) : showScreen('login');
  } else if (hash === '#signup') {
    signedIn ? (showScreen('dashboard'), loadDashboard()) : showScreen('signup');
  } else {
    showScreen('home');
  }
}

function showScreen(name) {
  document.querySelectorAll('[id^="screen-"]').forEach(s => s.classList.add('hidden'));
  const el = $('screen-' + name);
  if (el) el.classList.remove('hidden');
  window.location.hash = name === 'home' ? '' : name;
}

function loadDashboard() {
  if (!currentApiData) return;
  $('apikey-display').value = currentApiData.api_key;
  $('used-count').textContent = currentApiData.used;
  $('remaining-display').textContent = currentApiData.remaining;
  $('dashboard-name').textContent = currentUser?.name || '';
  $('dashboard-email').textContent = currentUser?.email || '';
  const da = $('dashboard-avatar');
  if (currentUser?.avatar) {
    da.src = currentUser.avatar;
    da.style.display = 'block';
  } else {
    da.style.display = 'none';
  }
}

function copyApiKey() {
  const key = $('apikey-display').value;
  navigator.clipboard.writeText(key);
  showToast('API key copied', 'success');
}

async function regenerateKey() {
  if (!confirm('Regenerating your API key will break existing integrations. Continue?')) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  try {
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ email: currentUser?.email, regenerate: true })
    });
    const data = await res.json();
    if (res.ok && data.api_key) {
      currentApiData.api_key = data.api_key;
      $('apikey-display').value = data.api_key;
      showToast('API key regenerated', 'success');
    }
  } catch (e) {
    showToast('Failed to regenerate key', 'error');
  }
}

function toggleDropdown() {
  $('nav-dropdown-menu').classList.toggle('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-dropdown')) {
    $('nav-dropdown-menu').classList.remove('open');
  }
});

async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) showToast(error.message, 'error');
}

async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  currentApiData = null;
  showScreen('home');
  updateUI();
  showToast('Signed out', 'success');
}

$('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const btn = $('login-btn');
  const err = $('login-error');
  err.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Sign In';
  if (error) {
    err.textContent = error.message;
    err.classList.add('visible');
  }
});

$('signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const btn = $('signup-btn');
  const err = $('signup-error');
  err.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin }
  });
  btn.disabled = false;
  btn.textContent = 'Create Account';
  if (error) {
    err.textContent = error.message;
    err.classList.add('visible');
  } else {
    showToast('Account created! Check your email for confirmation.', 'success');
    showScreen('login');
  }
});

function switchTab(el, tabId) {
  el.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  el.parentElement.parentElement.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  $(tabId).classList.add('active');
}

function copyCode(btn, text) {
  navigator.clipboard.writeText(text);
  btn.textContent = 'Copied';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }, 2000);
}

async function convertWeb() {
  const btn = $('convert-btn');
  const status = $('convert-status');
  const html = $('html-input').value;
  if (!html.trim()) {
    status.textContent = 'Paste some HTML first';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Converting...';
  status.textContent = '';
  $('download-btn').style.display = 'none';
  try {
    const res = await fetch('/api/v1/convert/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    });
    if (!res.ok) {
      const err = await res.json();
      status.textContent = err.error || 'Conversion failed';
      btn.disabled = false;
      btn.textContent = 'Convert to PDF';
      return;
    }
    lastPdfBlob = await res.blob();
    const url = URL.createObjectURL(lastPdfBlob);
    const placeholder = $('pdf-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    const preview = $('pdf-preview');
    if (preview) {
      preview.style.display = 'block';
      $('pdf-embed').src = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('download-btn').style.display = 'block';
    status.textContent = 'Ready';
  } catch (e) {
    status.textContent = 'Connection error';
  }
  btn.disabled = false;
  btn.textContent = 'Convert to PDF';
}

function downloadPdf() {
  if (!lastPdfBlob) return;
  const url = URL.createObjectURL(lastPdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'output.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(msg, type) {
  const t = $('toast');
  $('toast-message').textContent = msg;
  $('toast-icon').textContent = type === 'success' ? '✓' : '✗';
  t.className = 'toast visible ' + type;
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('visible'), 3000);
}

window.addEventListener('hashchange', updateUI);
initSupabase();
