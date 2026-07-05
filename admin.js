const API_BASE = '/api/foxpay/admin';
const adminSessionStorageKey = 'foxpay_admin_session_v1';

const state = {
  authKey: '',
  authToken: '',
  admin: null,
  admins: [],
  overview: null,
  activePanel: 'overview',
  adminUnilevelUserId: '',
  supportTicketId: '',
  usersPage: 1,
  push: {
    initialized: false,
    subscriptionId: '',
    permission: '',
    diagnostics: null,
  },
};

const seasonUploadTimers = new Map();

function saveAdminSession() {
  localStorage.setItem(adminSessionStorageKey, JSON.stringify({
    authKey: state.authKey || '',
    authToken: state.authToken || '',
    admin: state.admin || null,
  }));
}

function clearAdminSession() {
  localStorage.removeItem(adminSessionStorageKey);
}

function restoreAdminSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(adminSessionStorageKey) || '{}');
    state.authKey = saved.authKey || '';
    state.authToken = saved.authToken || '';
    state.admin = saved.admin || null;
    return Boolean(state.authToken || state.authKey);
  } catch {
    clearAdminSession();
    return false;
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const fmt = (value, digits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(value || 0));
const money = (value) => `$${fmt(value, 2)}`;
const withdrawalFeeRate = 0.2;
const isEnabled = (value) => value === true || value === 'true' || value === 1 || value === '1';
const canAdmin = (permission) => {
  if (!permission) return true;
  if (isRealSuperAdmin()) return true;
  if (permission === 'maintenance_edit') return false;
  if (String(permission).endsWith('_view') || permission === 'view' || permission === 'admins_view') return true;
  return Boolean(state.admin?.can_edit);
};
const isRealSuperAdmin = () => state.admin?.role === 'super_admin' && ['env', 'legacy'].includes(state.admin?.source);
const isLocalAdminHost = () => ['127.0.0.1', 'localhost'].includes(window.location.hostname);
const adminPanelTitles = {
  overview: 'Resumen',
  users: 'Usuarios',
  support: 'Soporte',
  packages: 'Paquetes',
  ranks: 'Rangos',
  avatars: 'Avatares',
  skins: 'Skins',
  roulette: 'Ruleta',
  unilevel: 'Unilevel',
  season: 'Temporada',
  purchases: 'Compras',
  withdrawals: 'Retiros',
  hotwallet: 'Hot wallet',
  admins: 'Admins',
  maintenance: 'Mantenimiento',
};
const countryFlag = (code) => {
  const safe = String(code || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(safe)
    ? `<span class="fi fi-${safe}" title="${safe.toUpperCase()}"></span>`
    : '<span class="flag-fallback">?</span>';
};
const shortText = (value, max = 38) => {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};
const userRankVolumeUsd = (user = {}) => Number(user.rank?.network_volume_usd ?? user.rank?.lifetime_earned_usd ?? 0);
const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const fromDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};
const formatDateTime = (value) => {
  if (!value) return 'Sin definir';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin definir'
    : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const explorerUrl = (network, hash) => {
  const tx = String(hash || '').trim();
  if (/^https:\/\/(www\.)?(bscscan\.com|polygonscan\.com)\/tx\/0x[a-fA-F0-9]{64}(?:[/?#].*)?$/.test(tx)) return tx;
  if (/^https:\/\/(www\.)?tronscan\.org\/#\/transaction\/[a-fA-F0-9]{64}(?:[/?#].*)?$/.test(tx)) return tx;
  if (network === 'tron' && /^[a-fA-F0-9]{64}$/.test(tx)) return `https://tronscan.org/#/transaction/${tx}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) return '';
  if (network === 'polygon') return `https://polygonscan.com/tx/${tx}`;
  if (network === 'bep20') return `https://bscscan.com/tx/${tx}`;
  return '';
};
const tokenPriceUsd = () => Math.max(0, Number(state.overview?.settings?.token_price_usd || 0.0001));
let skinPriceSource = 'usdt';
let rouletteAmountSource = 'fox';
const compactNumberInput = (value, digits = 6) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toFixed(digits).replace(/\.?0+$/, '') || '0';
};
const syncAvatarPrice = (source) => {
  const form = $('#avatarForm');
  if (!form) return;
  const tokenPrice = tokenPriceUsd();
  const tokensInput = form.elements.priceTokens;
  const usdtInput = form.elements.priceUsdt;
  if (!tokenPrice) return;
  if (source === 'tokens') {
    const tokens = Math.max(0, Number(tokensInput.value || 0));
    usdtInput.value = (tokens * tokenPrice).toFixed(4).replace(/\.?0+$/, '');
  }
  if (source === 'usdt') {
    const usdt = Math.max(0, Number(usdtInput.value || 0));
    tokensInput.value = String(Math.round(usdt / tokenPrice));
  }
  const hint = $('#avatarPriceHint');
  if (hint) {
    hint.textContent = `Conversion actual: 1 FOX = ${tokenPrice} USDT`;
    hint.dataset.type = '';
  }
};
const syncSkinPrice = (source) => {
  const form = $('#skinForm');
  if (!form) return;
  const tokenPrice = tokenPriceUsd();
  const foxInput = form.elements.priceFox;
  const usdtInput = form.elements.priceUsdt;
  if (!foxInput || !usdtInput || !tokenPrice) return;
  skinPriceSource = source;
  if (source === 'fox') {
    const fox = Math.max(0, Number(foxInput.value || 0));
    usdtInput.value = (fox * tokenPrice).toFixed(4).replace(/\.?0+$/, '');
  }
  if (source === 'usdt') {
    const usdt = Math.max(0, Number(usdtInput.value || 0));
    foxInput.value = String(Math.round(usdt / tokenPrice));
  }
  const hint = $('#skinPriceHint');
  if (hint) {
    hint.textContent = `Conversion actual: 1 FOX = ${tokenPrice} USDT. FOX por dia es la produccion diaria de la skin.`;
    hint.dataset.type = '';
  }
};
const syncRouletteAmount = (source = rouletteAmountSource) => {
  const form = $('#rouletteRewardForm');
  if (!form) return;
  const tokenPrice = tokenPriceUsd();
  const type = form.elements.rewardType.value;
  const foxInput = form.elements.amount;
  const usdtInput = form.elements.amountUsdt;
  if (!foxInput || !usdtInput || !tokenPrice) return;
  rouletteAmountSource = source;
  if (type !== 'tokens') {
    if (type !== 'tickets') usdtInput.value = '0';
    return;
  }
  if (source === 'usdt') {
    const usdt = Math.max(0, Number(usdtInput.value || 0));
    foxInput.value = String(Math.round(usdt / tokenPrice));
  } else {
    const fox = Math.max(0, Number(foxInput.value || 0));
    usdtInput.value = compactNumberInput(fox * tokenPrice);
  }
  const hint = $('#rouletteAmountUsdtHint');
  if (hint) {
    hint.textContent = `Visual: 1 FOX = ${tokenPrice} USDT. El premio se entrega en FOX.`;
  }
};
const unilevelPackIds = ['free', 'p30', 'p60', 'p120', 'p480', 'p960'];
const usersPageSize = 15;
const defaultUnilevelConfig = {
  free: [10],
  p30: [20, 3],
  p60: [20, 3, 3, 3],
  p120: [20, 3, 3, 3, 1.5, 1.5],
  p480: [20, 3, 3, 3, 1.5, 1.5, 1, 1],
  p960: [20, 3, 3, 3, 1.5, 1.5, 1, 1, 0.6, 0.6],
};
const defaultReferralTicketRewards = {
  free: 0,
  p30: 3,
  p60: 6,
  p120: 9,
  p480: 12,
  p960: 24,
};
const defaultPackageIconBase = './images/UX/package-icons/';

function defaultPackageIconAsset(pack = {}) {
  if (pack.id === 'free') return 'gift-pack.png';
  if (Number(pack.price_usdt || 0) >= 960) return 'fox-crown-wreath.png';
  if (Number(pack.price_usdt || 0) >= 480) return 'fox-gold-wreath.png';
  if (Number(pack.price_usdt || 0) >= 120) return 'fox-crown-wreath.png';
  if (Number(pack.price_usdt || 0) >= 60) return 'fox-diamond-badge.png';
  return 'paw-badge.png';
}

function packageIconSrc(pack = {}) {
  return pack.icon_url || `${defaultPackageIconBase}${defaultPackageIconAsset(pack)}`;
}

async function readApiJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    const looksHtml = /^\s*</.test(text);
    throw new Error(looksHtml
      ? 'El servidor devolvio HTML en vez de JSON. Revisa deploy, cache o ruta del API.'
      : 'Respuesta invalida del servidor.');
  }
}

async function api(path, body = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      'x-admin-key': state.authKey,
      'x-admin-session': state.authToken,
      authorization: `Bearer ${state.authKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readApiJson(response);
  if (!response.ok || data.ok === false) {
    const detail = formatApiError(data);
    const error = new Error(detail || data.error || 'Admin request failed');
    error.data = data;
    throw error;
  }
  return data;
}

function formatApiError(data = {}) {
  const friendlyErrors = {
    invalid_transaction_hash: 'Hash, URL o ID de transaccion invalida. Pega un hash correcto, una URL valida de BscScan/PolygonScan/TronScan, o una referencia de Binance como "Transferencia fuera de la cadena 377243486801".',
  };
  const parts = [];
  if (data.message) parts.push(String(data.message));
  if (data.error && data.error !== data.message) parts.push(friendlyErrors[data.error] || String(data.error));
  const nested = data.data || data.response || {};
  const nestedErrors = nested.errors || nested.error;
  if (Array.isArray(nestedErrors)) {
    parts.push(nestedErrors.map((item) => String(item)).join(', '));
  } else if (nestedErrors) {
    parts.push(typeof nestedErrors === 'string' ? nestedErrors : JSON.stringify(nestedErrors));
  }
  return parts.filter(Boolean).join(' - ');
}

function showAlert(message, type = 'warn') {
  const box = $('#alertBox');
  box.textContent = message;
  box.dataset.type = type;
  box.classList.remove('is-hidden');
}

function clearAlert() {
  $('#alertBox').classList.add('is-hidden');
}

async function copyTextToClipboard(text, label = 'Texto') {
  const value = String(text || '').trim();
  if (!value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    showAlert(`${label} copiada al portapapeles.`, 'success');
  } catch (error) {
    showAlert(`No se pudo copiar ${label.toLowerCase()}: ${error.message}`, 'warn');
  }
}

let fieldHelpPopover = null;

function hideFieldHelp() {
  fieldHelpPopover?.remove();
  fieldHelpPopover = null;
  $$('.field-info-button[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function showFieldHelp(button) {
  const message = button?.getAttribute('data-help') || button?.getAttribute('title') || button?.getAttribute('aria-label') || '';
  if (!button || !message) return;
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  hideFieldHelp();
  if (wasOpen) return;
  const popover = document.createElement('div');
  popover.className = 'field-help-popover';
  popover.setAttribute('role', 'status');
  popover.textContent = message;
  const host = button.closest('dialog[open]') || document.body;
  host.appendChild(popover);
  const rect = button.getBoundingClientRect();
  const margin = 12;
  const maxLeft = window.innerWidth - popover.offsetWidth - margin;
  const left = Math.max(margin, Math.min(rect.left, maxLeft));
  const top = Math.min(window.innerHeight - popover.offsetHeight - margin, rect.bottom + 8);
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.max(margin, top)}px`;
  button.setAttribute('aria-expanded', 'true');
  fieldHelpPopover = popover;
}

function updateAdminPushButton(label = '') {
  const button = $('#adminPushButton');
  if (!button) return;
  const permission = state.push.permission || window.Notification?.permission || '';
  if (label) {
    button.innerHTML = `<iconify-icon icon="ph:bell-ringing-bold"></iconify-icon> ${label}`;
    return;
  }
  if (permission === 'granted' && state.push.subscriptionId) {
    button.innerHTML = '<iconify-icon icon="ph:bell-ringing-bold"></iconify-icon> Notificaciones activas';
    return;
  }
  if (permission === 'denied') {
    button.innerHTML = '<iconify-icon icon="ph:bell-slash-bold"></iconify-icon> Notificaciones bloqueadas';
    return;
  }
  button.innerHTML = '<iconify-icon icon="ph:bell-ringing-bold"></iconify-icon> Activar notificaciones';
}

function readOneSignalSubscriptionId(OneSignal) {
  return String(
    OneSignal?.User?.PushSubscription?.id
      || OneSignal?.User?.PushSubscription?.token
      || '',
  ).trim();
}

async function registerAdminPushSubscription(subscriptionId) {
  if (!subscriptionId || !state.authToken) return;
  await api('/push-subscription', {
    action: 'subscribe',
    subscription_id: subscriptionId,
  });
  state.push.subscriptionId = subscriptionId;
  updateAdminPushButton();
}

async function unregisterAdminPushSubscription() {
  const subscriptionId = state.push.subscriptionId;
  if (!subscriptionId || !state.authToken) return;
  try {
    await api('/push-subscription', {
      action: 'unsubscribe',
      subscription_id: subscriptionId,
    });
  } catch {}
}

async function ensureAdminPushNotifications(requestPermission = false) {
  if (!state.admin || !state.authToken) return;
  if (isLocalAdminHost()) {
    state.push.permission = 'local';
    updateAdminPushButton('No local');
    return;
  }
  if (!window.FOXPAY_ONESIGNAL_APP_ID || !window.OneSignalDeferred) {
    updateAdminPushButton('No disponible');
    return;
  }
  updateAdminPushButton('Preparando...');
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      if (!state.push.initialized) {
        await OneSignal.init({
          appId: window.FOXPAY_ONESIGNAL_APP_ID,
          serviceWorkerPath: `${window.FOXPAY_ADMIN_BASE || ''}/OneSignalSDKWorker.js`,
          serviceWorkerParam: { scope: `${window.FOXPAY_ADMIN_BASE || ''}/` },
        });
        state.push.initialized = true;
        OneSignal.User?.PushSubscription?.addEventListener?.('change', async () => {
          const nextId = readOneSignalSubscriptionId(OneSignal);
          if (nextId) await registerAdminPushSubscription(nextId);
        });
      }
      if (state.admin?.username && OneSignal.login) {
        await OneSignal.login(`foxpay-admin:${state.admin.username}`);
      }
      state.push.permission = OneSignal.Notifications?.permissionNative || window.Notification?.permission || '';
      if (requestPermission && state.push.permission !== 'granted') {
        const granted = await OneSignal.Notifications?.requestPermission?.();
        state.push.permission = granted ? 'granted' : (window.Notification?.permission || state.push.permission);
      }
      if (state.push.permission === 'granted') {
        await OneSignal.User?.PushSubscription?.optIn?.();
        let subscriptionId = readOneSignalSubscriptionId(OneSignal);
        if (!subscriptionId) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          subscriptionId = readOneSignalSubscriptionId(OneSignal);
        }
        if (subscriptionId) {
          await registerAdminPushSubscription(subscriptionId);
          showAlert('Notificaciones admin activadas en este dispositivo.', 'ok');
        } else if (requestPermission) {
          showAlert('Permiso concedido, pero OneSignal aun no devolvio subscription id. Intenta de nuevo en unos segundos.', 'warn');
        }
      }
      updateAdminPushButton();
    } catch (error) {
      updateAdminPushButton('Error notificaciones');
      showAlert(`No se pudo activar OneSignal: ${error.message}`, 'warn');
    }
  });
}

function renderAdminPushDiagnostics() {
  const box = $('#adminPushDiagnostics');
  if (!box) return;
  const data = state.push.diagnostics;
  if (!data) {
    box.innerHTML = '<div class="empty-state">Sin diagnostico todavia.</div>';
    return;
  }
  const logs = data.logs || [];
  const logDetail = (log) => {
    const response = log.response || {};
    const errors = response.errors || response.error;
    if (Array.isArray(errors)) return errors.map((item) => String(item)).join(', ');
    if (errors) return typeof errors === 'string' ? errors : JSON.stringify(errors);
    if (response.id) return `id: ${response.id}`;
    return '';
  };
  box.innerHTML = `
    <div class="push-status-grid">
      <article><span>App ID</span><strong>${data.app_id_configured ? 'OK' : 'Falta'}</strong></article>
      <article><span>API key</span><strong>${data.api_key_configured ? 'OK' : 'Falta'}</strong></article>
      <article><span>Subs activas</span><strong>${fmt(data.active_subscriptions || 0, 0)}</strong></article>
      <article><span>Permiso navegador</span><strong>${state.push.permission || window.Notification?.permission || 'n/a'}</strong></article>
    </div>
    <div class="push-log-list">
      ${logs.length ? logs.map((log) => `
        <article class="push-log-row push-log-row--${escapeAttr(log.status || 'unknown')}">
          <div>
            <strong>${escapeAttr(log.event_type || 'push')} · ${escapeAttr(log.status || 'unknown')}</strong>
            <small>${escapeAttr(new Date(log.created_at || Date.now()).toLocaleString())}</small>
            ${log.error ? `<em>${escapeAttr(log.error)}</em>` : ''}
            ${logDetail(log) ? `<em>${escapeAttr(logDetail(log))}</em>` : ''}
          </div>
          <span>${fmt(log.subscription_count || 0, 0)} subs</span>
        </article>
      `).join('') : '<div class="empty-state">Aun no hay intentos registrados.</div>'}
    </div>
  `;
}

async function loadAdminPushDiagnostics() {
  try {
    state.push.diagnostics = await api('/push-diagnostics');
    renderAdminPushDiagnostics();
  } catch (error) {
    showAlert(`No se pudo cargar diagnostico push: ${error.message}`, 'warn');
  }
}

async function sendAdminPushTest() {
  const button = $('#adminPushTestButton');
  const previous = button?.innerHTML || '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<iconify-icon icon="ph:spinner-gap-bold"></iconify-icon> Enviando...';
  }
  try {
    const result = await api('/push-test', {});
    showAlert(`Prueba push: ${result.status} · ${fmt(result.subscription_count || 0, 0)} suscripciones.`, result.status === 'sent' ? 'ok' : 'warn');
    await loadAdminPushDiagnostics();
  } catch (error) {
    showAlert(`Fallo prueba push: ${error.message}`, 'warn');
    await loadAdminPushDiagnostics();
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = previous;
    }
  }
}

function statusPill(status) {
  const normalized = String(status || 'pending').toLowerCase();
  return `<span class="status-pill ${normalized}">${normalized}</span>`;
}

function metricCard(label, value, footer, iconName) {
  return `
    <article class="metric-card">
      <span class="metric-icon"><iconify-icon icon="${iconName}"></iconify-icon></span>
      <div>
        <span class="metric-label">${label}</span>
        <strong>${value}</strong>
        <small>${footer}</small>
      </div>
    </article>
  `;
}

function renderMetrics() {
  const data = state.overview;
  const tokenSupply = data.players.reduce((sum, user) => sum + Number(user.token_balance || 0), 0);
  const revenue = data.purchases
    .filter((purchase) => purchase.status === 'approved')
    .reduce((sum, purchase) => sum + Number(purchase.amount_usdt || 0), 0);

  $('#metricsGrid').innerHTML = [
    metricCard('Usuarios', fmt(data.metrics.users, 0), 'Cuentas FoxPay', 'ph:users-three'),
    metricCard('Ingresos', money(revenue), 'Compras aprobadas', 'ph:currency-dollar'),
    metricCard('Retiros pendientes', fmt(data.metrics.pending_withdrawals, 0), 'Requieren revision', 'ph:hourglass-medium'),
    metricCard('Soporte', fmt(data.metrics.support_open || 0, 0), 'Tickets abiertos', 'ph:headset'),
    metricCard('Tokens', fmt(tokenSupply, 0), `Precio ${data.settings.token_price_usd} USD`, 'ph:coins'),
  ].join('');

  $('#tokenPriceForm').priceUsd.value = data.settings.token_price_usd;
  $('#tokenPriceForm').symbol.value = 'FOX';
  $('#withdrawalSettingsForm').minUsdt.value = data.settings.withdrawal_min_usdt || 10;
  $('#securityForm').blockSameIp.checked = Boolean(data.settings.block_same_ip);
  $('#securityForm').blockSameDevice.checked = Boolean(data.settings.block_same_device);
  $('#securityForm').dailyCycleMinutes.value = data.settings.daily_cycle_minutes || 1440;
  $('#seasonForm').seasonName.value = data.settings.season_name || 'Monthly Season';
  $('#seasonForm').seasonStart.value = toDateTimeLocal(data.settings.season_start_at);
  $('#seasonForm').seasonEnd.value = toDateTimeLocal(data.settings.season_end_at);
  $('#seasonForm').winnerLimit.value = data.settings.season_winner_limit || 20;
  $('#seasonForm').rewardTokens.value = data.settings.season_reward_tokens || 0;
  $('#seasonForm').rewardMode.value = data.settings.season_reward_mode || 'competitive';
  renderHotWalletSettings();
}

function renderHotWalletSettings() {
  const settings = state.overview?.settings || {};
  const form = $('#hotWalletForm');
  if (!form) return;
  form.elements.network.value = settings.hot_wallet_network || 'BEP20';
  form.elements.address.value = settings.hot_wallet_address || '';
  form.elements.note.value = settings.hot_wallet_note || '';
  form.elements.adminPassword.value = '';
  $('#hotWalletPreviewNetwork').textContent = settings.hot_wallet_network || 'Sin red';
  $('#hotWalletPreviewAddress').textContent = settings.hot_wallet_address || 'Sin direccion';
  $('#hotWalletPreviewNote').textContent = settings.hot_wallet_note || '';
}

function renderAdminUsers() {
  const list = $('#adminUserList');
  $('#adminRolePill').textContent = state.admin?.role || 'Admin';
  $('#adminProfileName').textContent = state.admin?.username || 'Admin';
  $('#adminProfileRole').textContent = state.admin?.source === 'db'
    ? `${state.admin.role} - contrasena editable`
    : `${state.admin?.role || 'admin'} - se guardara en Postgres al cambiarla`;
  $('#adminProfileCreator').textContent = state.admin?.created_by
    ? `Creado por: ${state.admin.created_by}`
    : 'Creado por: origen del sistema';
  if (!list) return;
  if (!canAdmin('admins_view')) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = state.admins.length
    ? state.admins.map((admin) => `
      <article class="admin-user-card">
        <div>
          <strong>${admin.username}</strong>
          <small>${admin.role} - ${admin.active ? 'activo' : 'pausado'}</small>
          <small>Creado por: ${admin.created_by || 'origen del sistema'}</small>
          <small>${admin.approved ? 'Aprobado' : 'Pendiente'} - ${admin.can_edit ? 'Puede editar' : 'Solo visualiza'}</small>
          <small>Push: ${admin.push_enabled === false ? 'No recibe' : 'Recibe'}</small>
          <small>${adminPermissionSummary(admin)}</small>
        </div>
        <span class="status-pill ${admin.active ? 'active' : 'paused'}">${admin.active ? 'active' : 'paused'}</span>
        <small>Ultimo login: ${admin.last_login_at || 'Nunca'}</small>
        ${canAdmin('admins_edit') ? `
        <button class="ghost-button compact-button" type="button" data-edit-admin="${admin.username}">
          <iconify-icon icon="ph:pencil-simple-bold"></iconify-icon>Editar
        </button>
        <button class="danger-button compact-button" type="button" data-delete-admin="${admin.username}">
          <iconify-icon icon="ph:trash-bold"></iconify-icon>Eliminar
        </button>
        ` : ''}
      </article>
    `).join('')
    : '<div class="empty-state">Aun no hay admins creados.</div>';
}

function adminPermissionSummary(admin) {
  if (admin?.role === 'super_admin' && ['env', 'legacy'].includes(admin?.source)) return 'Acceso total';
  return admin?.can_edit ? 'Visualiza y edita todo' : 'Visualiza sin modificar';
}

function editAdminUser(username) {
  const admin = state.admins.find((item) => item.username === username);
  const form = $('#adminUserForm');
  if (!admin || !form) return;
  form.elements.username.value = admin.username;
  form.elements.password.value = '';
  form.elements.active.value = String(admin.active !== false);
  if (form.elements.approved) form.elements.approved.value = String(admin.approved === true);
  if (form.elements.canEdit) form.elements.canEdit.value = String(admin.can_edit === true);
  if (form.elements.pushEnabled) form.elements.pushEnabled.value = String(admin.push_enabled !== false);
  $('#adminUserFeedback').textContent = 'Editando permisos. Deja la contrasena vacia para mantenerla.';
  $('#adminUserFeedback').dataset.type = 'success';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderUnilevelConfig() {
  const config = state.overview.settings.unilevel_config || {};
  $('#unilevelConfigGrid').innerHTML = unilevelPackIds.map((packId) => {
    const pack = state.overview.packages.find((item) => item.id === packId);
    const values = Array.from({ length: 10 }, (_, index) => config[packId]?.[index] ?? defaultUnilevelConfig[packId]?.[index] ?? '');
    const activeLevels = values.filter((value) => Number(value) > 0).length;
    return `
      <article class="unilevel-pack-config">
        <div class="unilevel-pack-head">
          <div>
            <strong>${pack?.name || packId}</strong>
            <small>${packId === 'free' ? 'Free: solo primer nivel' : `${activeLevels} niveles activos`}</small>
          </div>
          <button class="ghost-button compact-button" type="button" data-unilevel-default="${packId}">Patron</button>
        </div>
        <div class="unilevel-rate-grid">
          ${values.map((value, index) => `
            <label>
              <span>Nivel ${index + 1}</span>
              <input data-unilevel-pack="${packId}" data-unilevel-level="${index}" type="number" min="0" max="100" step="0.01" value="${value}" placeholder="0" />
              <small>${Number(value) > 0 ? `${fmt((30 * Number(value)) / 100, 2)} USDT / base 30` : 'Inactivo'}</small>
            </label>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function applyDefaultUnilevelPattern(packId) {
  const values = defaultUnilevelConfig[packId] || [];
  state.overview.settings.unilevel_config = {
    ...(state.overview.settings.unilevel_config || {}),
    [packId]: [...values],
  };
  $$(`[data-unilevel-pack="${packId}"]`).forEach((input) => {
    const level = Number(input.dataset.unilevelLevel || 0);
    input.value = values[level] ?? '';
  });
}

function collectUnilevelConfig() {
  const config = {};
  unilevelPackIds.forEach((packId) => {
    config[packId] = $$(`[data-unilevel-pack="${packId}"]`)
      .map((input) => Number(input.value || 0))
      .filter((value) => value > 0);
  });
  return config;
}

function renderActivity() {
  const items = [
    ...state.overview.withdrawals.map((item) => ({ type: 'Retiro', title: item.player_id, status: item.status, amount: item.usdt_amount, date: item.created_at })),
    ...state.overview.purchases.map((item) => ({ type: 'Compra', title: item.player_id, status: item.status, amount: item.amount_usdt, date: item.created_at })),
  ].slice(0, 8);

  $('#activityList').innerHTML = items.length
    ? items.map((item) => `
      <div class="activity-item">
        <div><strong>${item.type}: ${item.title}</strong><br><small>${item.date || ''}</small></div>
        <div>${statusPill(item.status)}<br><small>${money(item.amount)}</small></div>
      </div>
    `).join('')
    : '<div class="empty-state">Sin actividad.</div>';
}

function getAdminPackForUser(user = {}) {
  const packId = user.active_package_id || 'free';
  const directPack = user.package && typeof user.package === 'object' ? user.package : null;
  const overviewPack = (state.overview?.packages || []).find((pack) => pack.id === packId);
  return overviewPack || directPack || {
    id: packId,
    daily_energy: user.max_energy || 0,
    tap_reward_tokens: 1,
  };
}

function getAdminUserDailyProduction(user = {}) {
  const pack = getAdminPackForUser(user);
  const tokenPrice = Number(state.overview?.settings?.token_price_usd || 0);
  const todayStats = user.today_stats && typeof user.today_stats === 'object' ? user.today_stats : null;
  const dailyTasks = user.daily_tasks && typeof user.daily_tasks === 'object' ? user.daily_tasks : {};
  const taskProgress = user.task_progress && typeof user.task_progress === 'object' ? user.task_progress : {};
  const maxEnergy = Math.max(0, Math.floor(Number(user.max_energy ?? pack.daily_energy ?? 0)));
  const currentEnergy = Math.max(0, Math.min(maxEnergy, Math.floor(Number(todayStats?.energy_remaining ?? user.energy ?? maxEnergy))));
  const energyUsed = Math.max(0, maxEnergy - currentEnergy);
  const progressTaps = Math.max(0, Math.floor(Number(taskProgress.taps || 0)));
  const tapsToday = Math.max(progressTaps, energyUsed, Math.floor(Number(todayStats?.taps || 0)));
  const tapReward = Math.max(0, Number(pack.tap_reward_tokens || 1));
  const earnedFoxToday = Math.max(0, Number(todayStats?.earned_tokens ?? (tapsToday * tapReward)));
  const remainingFox = currentEnergy * tapReward;
  const cycleUsd = Math.max(0, Number(user.total_earned_usd || 0));
  const lifetimeUsd = Math.max(cycleUsd, Number(user.lifetime_earned_usd || 0));
  const videoGoal = Math.max(0, Math.floor(Number(user.required_video_count || 0)));
  const videosDone = Array.from({ length: videoGoal }).reduce((sum, _, index) => (
    sum + (dailyTasks[`youtube_${index + 1}`] ? 1 : 0)
  ), 0);
  const checkDone = Boolean(dailyTasks.daily_check);
  const tapGoalDone = Boolean(dailyTasks.tap_goal);
  const tapGoalReady = tapsToday >= 100;
  const taskItems = [
    { label: 'Check-in', done: checkDone },
    ...(videoGoal > 0 ? [{ label: `Videos ${videosDone}/${videoGoal}`, done: videosDone >= videoGoal }] : []),
    { label: `Tap ${Math.min(tapsToday, 100)}/100`, done: tapGoalDone, ready: !tapGoalDone && tapGoalReady },
  ];
  const missing = taskItems.filter((item) => !item.done).map((item) => item.label);
  const tasksComplete = missing.length === 0;
  const progressPct = maxEnergy > 0 ? Math.min(100, Math.round((tapsToday / maxEnergy) * 100)) : 0;
  const status = earnedFoxToday <= 0
    ? 'Sin produccion hoy'
    : (currentEnergy <= 0 ? 'Energia agotada' : (tasksComplete ? 'Puede producir mas' : 'Tareas pendientes'));

  return {
    pack,
    tokenPrice,
    maxEnergy,
    currentEnergy,
    energyUsed,
    tapsToday,
    tapReward,
    earnedFoxToday,
    earnedUsdToday: earnedFoxToday * tokenPrice,
    remainingFox,
    remainingUsd: remainingFox * tokenPrice,
    cycleUsd,
    lifetimeUsd,
    taskItems,
    missing,
    tasksComplete,
    progressPct,
    status,
    statsSaved: Boolean(todayStats),
    historyCount: Array.isArray(user.daily_stats) ? user.daily_stats.length : 0,
  };
}

function renderDailyTaskChips(production = {}) {
  return (production.taskItems || []).map((item) => {
    const stateClass = item.done ? 'is-done' : (item.ready ? 'is-ready' : 'is-missing');
    const icon = item.done ? 'ph:check-bold' : (item.ready ? 'ph:clock-countdown-bold' : 'ph:x-bold');
    return `<span class="daily-task-chip ${stateClass}"><iconify-icon icon="${icon}"></iconify-icon>${item.label}</span>`;
  }).join('');
}

function renderDailyProduction(user = {}, variant = 'table') {
  const production = getAdminUserDailyProduction(user);
  const missingText = production.missing.length
    ? production.missing.map((item) => shortText(item, 24)).join(', ')
    : 'Completo';
  const compactClass = variant === 'mobile' ? ' daily-production-card-mobile' : '';
  return `
    <div class="daily-production-card${compactClass}">
      <div class="daily-production-head">
        <strong>${fmt(production.earnedFoxToday, 0)} FOX</strong>
        <span>${money(production.earnedUsdToday)} hoy est.</span>
      </div>
      <div class="daily-production-bar" aria-label="Energia trabajada">
        <span style="width:${production.progressPct}%"></span>
      </div>
      <div class="daily-production-stats">
        <span><b>${fmt(production.tapsToday, 0)}</b> usados</span>
        <span><b>${fmt(production.currentEnergy, 0)}</b> faltan</span>
      </div>
      <div class="daily-production-potential">
        Pendiente: <strong>${fmt(production.remainingFox, 0)} FOX</strong> ${money(production.remainingUsd)}
        <br>Acum. ciclo: <strong>${money(production.cycleUsd)}</strong>
        <br>Registro: <strong>${production.statsSaved ? 'guardado' : 'en vivo'}</strong>${production.historyCount ? ` · ${production.historyCount} dias` : ''}
      </div>
      <div class="daily-task-chips">${renderDailyTaskChips(production)}</div>
      <div class="daily-production-foot">
        <span>${production.status}</span>
        <small>Falta: ${missingText}</small>
      </div>
      ${variant === 'mobile' ? `
        <div class="daily-production-cycle">
          <span>Acumulado ciclo</span><strong>${money(production.cycleUsd)}</strong>
          <span>Ganado vida</span><strong>${money(production.lifetimeUsd)}</strong>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAdminUserCard(user = {}, sponsorText, open = false) {
  const balanceUsd = Number(user.token_balance || 0) * Number(state.overview.settings.token_price_usd);
  const production = getAdminUserDailyProduction(user);
  const accountStatus = user.account_status === 'disabled' ? 'paused' : 'active';
  const actionLabel = user.account_status === 'disabled' ? 'Reactivar' : 'Desactivar';
  const actionIcon = user.account_status === 'disabled' ? 'ph:play-bold' : 'ph:trash-bold';
  const actionClass = user.account_status === 'disabled' ? 'approve-button' : 'danger-button';

  return `
    <details class="user-mobile-card user-admin-card" ${open ? 'open' : ''}>
      <summary class="user-admin-summary">
        <span class="user-admin-avatar">${countryFlag(user.country_code)}</span>
        <span class="user-admin-identity">
          <strong>${user.username || user.player_id}</strong>
          <small>${user.country_name || user.country_code || 'Unknown'} - ${fmt(user.token_balance, 0)} FOX</small>
        </span>
        <span class="user-admin-summary-stat">
          <iconify-icon icon="ph:users-three-bold"></iconify-icon>
          <span><small>Patrocinador</small><strong>${shortText(sponsorText(user), 28)}</strong></span>
        </span>
        <span class="user-admin-summary-stat">
          <iconify-icon icon="ph:cube-bold"></iconify-icon>
          <span><small>Pack</small><strong>${user.active_package_id || 'free'}</strong></span>
        </span>
        <span class="user-admin-summary-stat">
          <iconify-icon icon="ph:medal-bold"></iconify-icon>
          <span><small>Rango</small><strong>${shortText(user.rank?.name || 'Free', 18)}</strong></span>
        </span>
        <span class="user-admin-summary-stat user-admin-summary-balance">
          <iconify-icon icon="ph:wallet-bold"></iconify-icon>
          <span><small>Balance</small><strong>${fmt(user.token_balance, 0)} FOX</strong></span>
        </span>
        <span class="user-admin-summary-status">${statusPill(accountStatus)}</span>
        <span class="user-mobile-chevron"><iconify-icon icon="ph:caret-down-bold"></iconify-icon></span>
      </summary>
      <div class="user-admin-details">
        <section class="user-admin-info-panel">
          <h4><iconify-icon icon="ph:identification-card-bold"></iconify-icon>Informacion</h4>
          <div class="user-admin-info-list">
            <div><span><iconify-icon icon="ph:envelope-simple-bold"></iconify-icon>Correo</span><strong>${user.email || 'Sin correo'}</strong></div>
            <div><span><iconify-icon icon="ph:at-bold"></iconify-icon>IP</span><strong>${user.signup_ip || 'Sin IP'}</strong></div>
            <div><span><iconify-icon icon="ph:monitor-bold"></iconify-icon>Dispositivo</span><strong>${shortText(user.device_label || 'Unknown / Browser', 56)}</strong></div>
            <div><span><iconify-icon icon="ph:fingerprint-bold"></iconify-icon>Huella</span><strong>${shortText(user.user_agent || user.device_key || 'Sin huella', 84)}</strong></div>
            <div><span><iconify-icon icon="ph:users-three-bold"></iconify-icon>Patrocinador</span><strong>${user.sponsor_label || user.referrer_id || 'Sin patrocinador'}</strong></div>
            ${user.sponsor_registered && user.sponsor_id ? `<div><span><iconify-icon icon="ph:user-plus-bold"></iconify-icon>ID patrocinador</span><strong>${user.sponsor_id}</strong></div>` : ''}
            <div><span><iconify-icon icon="ph:medal-bold"></iconify-icon>Rango</span><strong>${user.rank?.name || 'Free'} - ${money(userRankVolumeUsd(user))} org.</strong></div>
            <div><span><iconify-icon icon="ph:cube-bold"></iconify-icon>Paquete</span><strong>${user.active_package_id || 'free'}</strong></div>
            <div><span><iconify-icon icon="ph:currency-dollar-bold"></iconify-icon>Balance USD</span><strong>${money(balanceUsd)}</strong></div>
            <div><span><iconify-icon icon="ph:chart-line-up-bold"></iconify-icon>Produccion diaria</span><strong>${fmt(production.earnedFoxToday, 0)} FOX</strong></div>
          </div>
          <div class="user-admin-register">
            <span><iconify-icon icon="ph:calendar-blank-bold"></iconify-icon>Registro</span>
            <strong>${user.created_at || 'Sin fecha'}</strong>
            ${statusPill(accountStatus)}
          </div>
        </section>
        <section class="user-admin-balance-panel">
          <h4><iconify-icon icon="ph:coins-bold"></iconify-icon>Balance</h4>
          <div class="user-admin-balance-card">
            <div class="user-admin-balance-total">
              <span><iconify-icon icon="ph:currency-circle-dollar-bold"></iconify-icon></span>
              <strong>${fmt(user.token_balance, 0)} FOX</strong>
              <small>${money(balanceUsd)} USD eq.</small>
            </div>
            <div class="user-admin-balance-lines">
              <div><span><iconify-icon icon="ph:floppy-disk-back-bold"></iconify-icon>Guardado</span><strong>${money(production.cycleUsd)} (${fmt(production.earnedFoxToday, 0)} fox)</strong></div>
              <div><span><iconify-icon icon="ph:gift-bold"></iconify-icon>Pendiente</span><strong>${fmt(production.remainingFox, 0)} FOX ${money(production.remainingUsd)}</strong></div>
              <div><span><iconify-icon icon="ph:user-plus-bold"></iconify-icon>Acum. diario</span><strong>${money(production.earnedUsdToday)}</strong></div>
              <div><span><iconify-icon icon="ph:lock-key-bold"></iconify-icon>Historial guardado</span><strong>${production.historyCount ? `${production.historyCount} dias` : '-'}</strong></div>
            </div>
            ${renderDailyProduction(user, 'mobile')}
            ${canAdmin('users_edit') ? `
            <div class="user-admin-actions">
              <button class="primary-button compact-button" type="button" data-user-add-coins="${user.player_id}">
                <iconify-icon icon="ph:coin-bold"></iconify-icon>Test +1M GFOX
              </button>
              <button class="${actionClass} compact-button" type="button" data-user-status="${user.player_id}" data-status="${user.account_status === 'disabled' ? 'active' : 'disabled'}">
                <iconify-icon icon="${actionIcon}"></iconify-icon>${actionLabel}
              </button>
            </div>
            ` : ''}
          </div>
        </section>
        
        <section class="user-admin-balance-panel" style="grid-column: span 2; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px;" id="history-section-${user.player_id}">
          <div style="text-align: center; padding: 15px;">
            <button class="primary-button" type="button" onclick="loadPlayerHistoryOnDemand('${user.player_id}')" id="load-history-btn-${user.player_id}" style="padding: 10px 20px; font-size: 0.9rem; cursor: pointer; border-radius: 8px;">
              <iconify-icon icon="ph:clock-counter-clockwise-bold" style="vertical-align: middle; margin-right: 6px; font-size: 1.2rem;"></iconify-icon>
              Cargar Historial Completo (Apuestas, Producción y Transacciones)
            </button>
          </div>
          <div id="player-history-container-${user.player_id}" style="display: none; margin-top: 15px;"></div>
        </section>
      </div>
    </details>
  `;
}

window.loadPlayerHistoryOnDemand = async function(playerId) {
  const btn = $(`#load-history-btn-${playerId}`);
  const container = $(`#player-history-container-${playerId}`);
  if (!btn || !container) return;

  btn.disabled = true;
  btn.innerHTML = `<iconify-icon icon="ph:circle-notch-bold" class="spin" style="vertical-align: middle; margin-right: 6px;"></iconify-icon> Cargando historial...`;

  try {
    const data = await api(`/user/history?player_id=${playerId}`);
    if (!data.ok) throw new Error(data.error || 'Failed to load history');

    const user = state.overview.players.find(p => p.player_id === playerId);
    if (!user) throw new Error('Player not found in state');

    // 1. Generate bets HTML
    const userBetsList = [];
    if (state.overview && Array.isArray(state.overview.matches)) {
      state.overview.matches.forEach(match => {
        const myBet = match.userBets?.find(b => b.player_id === playerId);
        if (myBet) {
          userBetsList.push({
            match,
            bet: myBet
          });
        }
      });
    }
    userBetsList.sort((a, b) => new Date(a.bet.created_at) - new Date(b.bet.created_at));

    let betsHtml = '';
    let totalBetAmount = 0;
    let totalReturnAmount = 0;

    if (userBetsList.length === 0) {
      betsHtml = `<p style="color: var(--muted); font-size: 0.85rem; margin: 10px 0;">No ha realizado apuestas en el Mundial.</p>`;
    } else {
      let tableRows = '';
      userBetsList.forEach(({ match, bet }) => {
        const matchName = `${match.flag_a || ''} ${match.team_a} vs ${match.team_b} ${match.flag_b || ''}`;
        
        let choiceLabel = 'Empate';
        if (bet.bet_type === 'team_a') choiceLabel = match.team_a;
        if (bet.bet_type === 'team_b') choiceLabel = match.team_b;
        
        let oddValue = 1.00;
        if (bet.bet_type === 'team_a') oddValue = Number(match.odds_team_a || 1.00);
        if (bet.bet_type === 'team_b') oddValue = Number(match.odds_team_b || 1.00);
        if (bet.bet_type === 'draw') oddValue = Number(match.odds_draw || 1.00);

        let statusLabel = 'Pendiente';
        let statusColor = 'var(--muted)';
        let returnAmount = 0;
        let netAmount = -Number(bet.amount);

        if (match.status === 'resolved') {
          if (match.result === bet.bet_type) {
            statusLabel = 'Ganó 🟢';
            statusColor = '#46d39e';
            returnAmount = Math.floor(Number(bet.amount) * oddValue);
            netAmount = returnAmount - Number(bet.amount);
            totalReturnAmount += returnAmount;
          } else {
            statusLabel = 'Perdió 🔴';
            statusColor = '#ff6b6b';
            returnAmount = 0;
            netAmount = -Number(bet.amount);
          }
        }
        totalBetAmount += Number(bet.amount);

        tableRows += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td data-label="Partido" style="padding: 10px 8px; font-size: 0.85rem; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${matchName}">${matchName}</td>
            <td data-label="Fecha" style="padding: 10px 8px; font-size: 0.85rem;">${new Date(bet.created_at).toLocaleDateString()}</td>
            <td data-label="Apuesta" style="padding: 10px 8px; font-size: 0.85rem;"><strong>${choiceLabel}</strong> <span style="color: var(--muted); font-size: 0.75rem;">(${oddValue.toFixed(2)})</span></td>
            <td data-label="Monto" style="padding: 10px 8px; font-size: 0.85rem; color: #ff6b6b;">-${fmt(bet.amount, 0)}</td>
            <td data-label="Estado" style="padding: 10px 8px; font-size: 0.85rem; color: ${statusColor}; font-weight: 600;">${statusLabel}</td>
            <td data-label="Retorno" style="padding: 10px 8px; font-size: 0.85rem; color: ${returnAmount > 0 ? '#46d39e' : 'var(--muted)'}; font-weight: 500;">${returnAmount > 0 ? `+${fmt(returnAmount, 0)}` : '0'}</td>
            <td data-label="Neto" style="padding: 10px 8px; font-size: 0.85rem; color: ${netAmount >= 0 ? '#46d39e' : '#ff6b6b'}; font-weight: 600;">${netAmount >= 0 ? `+${fmt(netAmount, 0)}` : `-${fmt(Math.abs(netAmount), 0)}`}</td>
          </tr>
        `;
      });

      betsHtml = `
        <div class="bets-table-wrap" style="display: block !important; max-height: 250px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; width: 100%;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Partido</th>
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Fecha</th>
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Apuesta</th>
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Monto</th>
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Estado</th>
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Retorno</th>
                <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Neto</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    }

    // 2. Generate daily stats HTML & calculate total fox mined
    let dailyStatsHtml = '';
    let totalFoxMined = 0;
    if (data.daily_stats && data.daily_stats.length > 0) {
      let rows = '';
      data.daily_stats.forEach(stat => {
        totalFoxMined += Number(stat.earned_tokens || 0);
        rows += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td data-label="Día" style="padding: 8px; font-size: 0.85rem;"><strong>${stat.daily_key}</strong></td>
            <td data-label="Tokens" style="padding: 8px; font-size: 0.85rem; color: var(--accent); font-weight: 600;">+${fmt(stat.earned_tokens, 0)} FOX</td>
            <td data-label="USD" style="padding: 8px; font-size: 0.85rem; color: #46d39e; font-weight: 500;">${money(stat.earned_usd)}</td>
            <td data-label="Taps" style="padding: 8px; font-size: 0.85rem; color: var(--muted);">${fmt(stat.taps, 0)} taps</td>
          </tr>
        `;
      });
      dailyStatsHtml = `
        <div class="bets-table-wrap" style="display: block !important; max-height: 200px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; width: 100%;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Día</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Tokens</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Equiv. USD</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Taps</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    } else {
      dailyStatsHtml = `<p style="color: var(--muted); font-size: 0.85rem; margin: 10px 0;">Sin historial diario registrado.</p>`;
    }

    let totalCommissionsFox = 0;
    if (Array.isArray(data.commissions)) {
      data.commissions.forEach(c => {
        totalCommissionsFox += Number(c.credited_tokens || 0);
      });
    }

    let totalRouletteFox = 0;
    if (Array.isArray(data.roulette_spins)) {
      data.roulette_spins.forEach(s => {
        totalRouletteFox += Number(s.credited_tokens || 0);
      });
    }

    let totalPurchasesFox = 0;
    if (Array.isArray(data.purchases)) {
      data.purchases.forEach(p => {
        if (p.status === 'approved') {
          totalPurchasesFox += Number(p.fox_tokens_paid || p.tokens_rewarded || 0);
        }
      });
    }

    const netBets = totalReturnAmount - totalBetAmount;
    const documentedInflows = totalFoxMined + totalCommissionsFox + totalRouletteFox + totalPurchasesFox;
    const currentActualBalance = Number(user.token_balance || 0);
    
    // Difference between real balance and estimated balance represents manual admin adjustments / migration initial balances
    const estimatedBalance = documentedInflows + netBets;
    const adminAdjustments = currentActualBalance - estimatedBalance;

    // 3. Build chronological ledger
    const ledger = [];

    // Minado
    if (data.daily_stats && data.daily_stats.length > 0) {
      data.daily_stats.forEach(stat => {
        ledger.push({
          date: new Date(stat.daily_key + 'T12:00:00Z'),
          dateStr: stat.daily_key,
          type: 'Minería ⛏️',
          desc: `Minería diaria (${fmt(stat.taps, 0)} taps)`,
          amount: Number(stat.earned_tokens || 0),
          color: 'var(--accent)'
        });
      });
    }

    // Comisiones
    if (Array.isArray(data.commissions)) {
      data.commissions.forEach(c => {
        ledger.push({
          date: new Date(c.created_at),
          dateStr: new Date(c.created_at).toLocaleDateString() + ' ' + new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          type: 'Comisión Red 👥',
          desc: `Unilevel Nivel ${c.level || 1} (Compra: ${c.buyer_username || c.buyer_player_id || 'Usuario'} | $${Number(c.amount_usdt || 0).toFixed(0)} USDT)`,
          amount: Number(c.credited_tokens || 0),
          color: '#46d39e'
        });
      });
    }

    // Ruleta
    if (Array.isArray(data.roulette_spins)) {
      data.roulette_spins.forEach(s => {
        ledger.push({
          date: new Date(s.created_at),
          dateStr: new Date(s.created_at).toLocaleDateString() + ' ' + new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          type: 'Ruleta 🎡',
          desc: `Premio: ${s.reward_label || 'Tokens'}`,
          amount: Number(s.credited_tokens || 0),
          color: '#46d39e'
        });
      });
    }

    // Compras
    if (Array.isArray(data.purchases)) {
      data.purchases.forEach(p => {
        if (p.status === 'approved') {
          ledger.push({
            date: new Date(p.created_at),
            dateStr: new Date(p.created_at).toLocaleDateString() + ' ' + new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            type: 'Compra 📦',
            desc: `Adquisición Paquete ${p.package_id || ''}`,
            amount: Number(p.fox_tokens_paid || p.tokens_rewarded || 0),
            color: '#46d39e'
          });
        }
      });
    }

    // Retiros
    if (Array.isArray(data.withdrawals)) {
      data.withdrawals.forEach(w => {
        if (w.status !== 'rejected') {
          ledger.push({
            date: new Date(w.created_at),
            dateStr: new Date(w.created_at).toLocaleDateString() + ' ' + new Date(w.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            type: 'Retiro 📤',
            desc: `Solicitud de retiro ${w.status === 'approved' ? '(Aprobado)' : '(Pendiente)'}`,
            amount: -Number(w.tokens || 0),
            color: '#ff6b6b'
          });
        } else {
          ledger.push({
            date: new Date(w.created_at),
            dateStr: new Date(w.created_at).toLocaleDateString() + ' ' + new Date(w.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            type: 'Retiro Solicitado 📤',
            desc: `Solicitud de retiro de ${fmt(w.tokens, 0)} FOX`,
            amount: -Number(w.tokens || 0),
            color: 'var(--muted)'
          });
          ledger.push({
            date: new Date(w.reviewed_at || w.created_at),
            dateStr: new Date(w.reviewed_at || w.created_at).toLocaleDateString() + ' ' + new Date(w.reviewed_at || w.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            type: 'Retiro Rechazado 🟢',
            desc: `Retiro rechazado (Saldo devuelto)`,
            amount: Number(w.tokens || 0),
            color: '#46d39e'
          });
        }
      });
    }

    // Apuestas de Mundial
    if (Array.isArray(data.bets)) {
      data.bets.forEach(b => {
        const matchName = `${b.team_a} vs ${b.team_b}`;
        let choiceLabel = 'Empate';
        if (b.bet_type === 'team_a') choiceLabel = b.team_a;
        if (b.bet_type === 'team_b') choiceLabel = b.team_b;
        
        let oddValue = 1.00;
        if (b.bet_type === 'team_a') oddValue = Number(b.odds_team_a || 1.00);
        if (b.bet_type === 'team_b') oddValue = Number(b.odds_team_b || 1.00);
        if (b.bet_type === 'draw') oddValue = Number(b.odds_draw || 1.00);

        ledger.push({
          date: new Date(b.created_at),
          dateStr: new Date(b.created_at).toLocaleDateString() + ' ' + new Date(b.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          type: 'Apuesta ⚽',
          desc: `Apuesta a ${choiceLabel} (${oddValue.toFixed(2)}) en ${matchName}`,
          amount: -Number(b.amount || 0),
          color: '#ff6b6b'
        });

        if (b.match_status === 'resolved') {
          if (b.match_result === b.bet_type) {
            const returnVal = Math.floor(Number(b.amount) * oddValue);
            ledger.push({
              date: new Date(b.updated_at || b.created_at),
              dateStr: new Date(b.updated_at || b.created_at).toLocaleDateString() + ' ' + new Date(b.updated_at || b.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
              type: 'Premio Apuesta 🏆',
              desc: `Ganancia apuesta acertada en ${matchName}`,
              amount: returnVal,
              color: '#46d39e'
            });
          }
        }
      });
    }

    // Sort chronologically
    ledger.sort((a, b) => a.date - b.date);

    // Sum verification
    let tempSum = 0;
    ledger.forEach(item => {
      tempSum += item.amount;
    });

    const diff = currentActualBalance - tempSum;
    if (Math.abs(diff) > 1) {
      ledger.unshift({
        date: new Date(user.created_at || '2026-05-29'),
        dateStr: new Date(user.created_at || '2026-05-29').toLocaleDateString(),
        type: 'Saldo Inicial / Migración 📦',
        desc: 'Saldo inicial en wallet (Migrado o ajustado previamente)',
        amount: diff,
        color: '#46d39e'
      });
    }

    // Recalculate balances
    let running = 0;
    let ledgerRows = '';
    ledger.forEach(item => {
      running += item.amount;
      const isPositive = item.amount >= 0;
      ledgerRows += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td data-label="Fecha" style="padding: 10px 8px; font-size: 0.85rem; color: var(--muted);">${item.dateStr}</td>
          <td data-label="Operación" style="padding: 10px 8px; font-size: 0.85rem;"><strong>${item.type}</strong></td>
          <td data-label="Detalle" style="padding: 10px 8px; font-size: 0.85rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.desc}">${item.desc}</td>
          <td data-label="Monto" style="padding: 10px 8px; font-size: 0.85rem; font-weight: 600; color: ${item.color};">${isPositive ? '+' : ''}${fmt(item.amount, 0)} FOX</td>
          <td data-label="Saldo Acumulado" style="padding: 10px 8px; font-size: 0.85rem; font-weight: 700; color: var(--accent);">${fmt(running, 0)} FOX</td>
        </tr>
      `;
    });

    const ledgerHtml = `
      <div class="bets-table-wrap" style="display: block !important; max-height: 350px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
              <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Fecha</th>
              <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Operación</th>
              <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Detalle</th>
              <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Monto</th>
              <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows}
          </tbody>
        </table>
      </div>
    `;

    // 4. Generate referrals HTML
    let referralsHtml = '';
    if (data.referrals && data.referrals.length > 0) {
      let rows = '';
      data.referrals.forEach(ref => {
        rows += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td data-label="Usuario" style="padding: 8px; font-size: 0.85rem;"><strong>${ref.username || ref.player_id}</strong></td>
            <td data-label="Paquete" style="padding: 8px; font-size: 0.85rem; font-weight: 600; color: var(--accent);">${ref.active_package_id || 'free'}</td>
            <td data-label="Saldo" style="padding: 8px; font-size: 0.85rem; color: #46d39e; font-weight: 500;">${fmt(ref.token_balance, 0)} FOX</td>
            <td data-label="Registro" style="padding: 8px; font-size: 0.85rem; color: var(--muted);">${ref.created_at ? new Date(ref.created_at).toLocaleDateString() : 'Sin fecha'}</td>
          </tr>
        `;
      });
      referralsHtml = `
        <div class="bets-table-wrap" style="display: block !important; max-height: 200px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; width: 100%;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Usuario</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Paquete Activo</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Saldo FOX</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Fecha Registro</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    } else {
      referralsHtml = `<p style="color: var(--muted); font-size: 0.85rem; margin: 10px 0;">No posee referidos directos en su red.</p>`;
    }

    // 5. Generate referral purchases HTML
    let refPurchasesHtml = '';
    if (data.referral_purchases && data.referral_purchases.length > 0) {
      let rows = '';
      data.referral_purchases.forEach(p => {
        rows += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td data-label="Usuario" style="padding: 8px; font-size: 0.85rem;"><strong>${p.buyer_username || p.player_id}</strong></td>
            <td data-label="Paquete" style="padding: 8px; font-size: 0.85rem;">${p.package_id || 'N/A'}</td>
            <td data-label="Monto" style="padding: 8px; font-size: 0.85rem; font-weight: 600; color: #46d39e;">$${Number(p.amount_usdt).toFixed(0)} USDT</td>
            <td data-label="Estado" style="padding: 8px; font-size: 0.85rem;">${statusPill(p.status)}</td>
            <td data-label="Fecha" style="padding: 8px; font-size: 0.85rem; color: var(--muted);">${new Date(p.created_at).toLocaleDateString()}</td>
          </tr>
        `;
      });
      refPurchasesHtml = `
        <div class="bets-table-wrap" style="display: block !important; max-height: 200px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; width: 100%;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Referido</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Paquete</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Monto USD</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Estado</th>
                <th style="padding: 8px; font-size: 0.8rem; color: var(--muted);">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    } else {
      refPurchasesHtml = `<p style="color: var(--muted); font-size: 0.85rem; margin: 10px 0;">Sin compras de paquetes en su red.</p>`;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
        <div class="user-admin-balance-panel" style="border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; background: rgba(0,0,0,0.15);">
          <h4 style="margin-bottom: 12px;"><iconify-icon icon="ph:list-dashes-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon>Libro Contable Completo (Extracto de Wallet FOX)</h4>
          ${ledgerHtml}
        </div>

        <div class="user-admin-balance-panel" style="border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; background: rgba(0,0,0,0.15);">
          <h4 style="margin-bottom: 12px;"><iconify-icon icon="ph:soccer-ball-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon>Historial de Apuestas (Mundial)</h4>
          ${betsHtml}
        </div>
        
        <div class="user-admin-balance-panel" style="border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; background: rgba(0,0,0,0.15);">
          <h4 style="margin-bottom: 12px;"><iconify-icon icon="ph:chart-bar-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon>Producción Diaria Completa (FOX Minado)</h4>
          ${dailyStatsHtml}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          <div class="user-admin-balance-panel" style="border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; background: rgba(0,0,0,0.15);">
            <h4 style="margin-bottom: 12px;"><iconify-icon icon="ph:users-three-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon>Miembros de su Red (Referidos Directos)</h4>
            ${referralsHtml}
          </div>
          
          <div class="user-admin-balance-panel" style="border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; background: rgba(0,0,0,0.15);">
            <h4 style="margin-bottom: 12px;"><iconify-icon icon="ph:shopping-cart-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon>Compras de Paquetes en su Red (USDT)</h4>
            ${refPurchasesHtml}
          </div>
        </div>

        <div style="padding: 15px; background: rgba(255,255,255,0.02); border-radius: 8px; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px;">
          <h4 style="margin-bottom: 4px; color: var(--accent);"><iconify-icon icon="ph:calculator-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon>Auditoría de Balance y Flujo de FOX</h4>
          
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
            <span>1. Total FOX Producido (Minería):</span>
            <strong style="color: #46d39e;">+${fmt(totalFoxMined, 0)} FOX</strong>
          </div>
          
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
            <span>2. Comisiones Unilevel (Referidos):</span>
            <strong style="color: #46d39e;">+${fmt(totalCommissionsFox, 0)} FOX</strong>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
            <span>3. Premios de la Ruleta:</span>
            <strong style="color: #46d39e;">+${fmt(totalRouletteFox, 0)} FOX</strong>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
            <span>4. Recompensas por Compras/Packs:</span>
            <strong style="color: #46d39e;">+${fmt(totalPurchasesFox, 0)} FOX</strong>
          </div>

          ${Math.abs(adminAdjustments) > 1 ? `
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;">
            <span>5. Ajustes manuales / Saldo inicial de migración:</span>
            <strong style="color: ${adminAdjustments >= 0 ? '#46d39e' : '#ff6b6b'};">${adminAdjustments >= 0 ? '+' : ''}${fmt(adminAdjustments, 0)} FOX</strong>
          </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px; margin-top: 4px;">
            <span>Total Ingresos Documentados:</span>
            <strong style="color: #fff;">+${fmt(documentedInflows + (Math.abs(adminAdjustments) > 1 ? adminAdjustments : 0), 0)} FOX</strong>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px; color: #ff6b6b;">
            <span>Resultado de Apuestas (Neto):</span>
            <strong>${netBets >= 0 ? `+${fmt(netBets, 0)}` : `-${fmt(Math.abs(netBets), 0)}`} FOX</strong>
          </div>
          
          <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); color: var(--accent);">
            <span>Balance Actual en Cuenta:</span>
            <span>${fmt(currentActualBalance, 0)} FOX</span>
          </div>
        </div>
      </div>
    `;

    btn.style.display = 'none';
    container.style.display = 'block';
  } catch (error) {
    showAlert(`Error cargando historial: ${error.message}`, 'warn');
    btn.disabled = false;
    btn.innerHTML = `<iconify-icon icon="ph:clock-counter-clockwise-bold" style="vertical-align: middle; margin-right: 6px;"></iconify-icon> Reintentar Cargar Historial`;
  }
};

function renderUsersLegacy() {
  const query = $('#userSearch').value.toLowerCase();
  const users = state.overview.players.filter((user) => JSON.stringify(user).toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(users.length / usersPageSize));
  state.usersPage = Math.max(1, Math.min(totalPages, state.usersPage || 1));
  const start = (state.usersPage - 1) * usersPageSize;
  const pageUsers = users.slice(start, start + usersPageSize);
  const sponsorDisplay = (user = {}) => {
    const label = user.sponsor_label || user.referrer_id || '';
    if (!label) return '<span class="muted">Sin patrocinador</span>';
    const secondary = user.sponsor_registered && user.sponsor_id && user.sponsor_id !== label
      ? `<br><span class="muted">${user.sponsor_id}</span>`
      : '';
    return `<strong>${shortText(label, 28)}</strong>${secondary}`;
  };
  const sponsorText = (user = {}) => user.sponsor_label || user.referrer_id || 'Sin patrocinador';
  $('#usersBody').innerHTML = pageUsers.length
    ? pageUsers.map((user) => `
      <tr>
        <td><strong>${user.username || user.player_id}</strong><br><span class="muted">${user.player_id}</span></td>
        <td><strong>${user.email || 'Sin correo'}</strong></td>
        <td>
          <span class="country-cell">${countryFlag(user.country_code)} <strong>${user.country_name || user.country_code || 'Unknown'}</strong></span>
          <br><span class="muted">${user.signup_ip || 'Sin IP'}</span>
        </td>
        <td><strong>${shortText(user.device_label || 'Unknown device')}</strong><br><span class="muted">${shortText(user.user_agent || user.device_key || 'Sin huella', 52)}</span></td>
        <td>${sponsorDisplay(user)}</td>
        <td><strong>${user.rank?.name || 'Free'}</strong><br><span class="muted">${money(userRankVolumeUsd(user))} org.</span></td>
        <td><strong>${user.active_package_id || 'free'}</strong></td>
        <td><strong>${fmt(user.token_balance, 0)}</strong><br><span class="muted">${money(Number(user.token_balance || 0) * Number(state.overview.settings.token_price_usd))}</span></td>
        <td>${renderDailyProduction(user)}</td>
        <td>${statusPill(user.account_status === 'disabled' ? 'paused' : 'active')}</td>
        <td>${user.created_at || ''}</td>
        <td>${canAdmin('users_edit') ? `
          <button class="${user.account_status === 'disabled' ? 'approve-button' : 'danger-button'} compact-button" type="button" data-user-status="${user.player_id}" data-status="${user.account_status === 'disabled' ? 'active' : 'disabled'}">
            <iconify-icon icon="${user.account_status === 'disabled' ? 'ph:play-bold' : 'ph:pause-bold'}"></iconify-icon>${user.account_status === 'disabled' ? 'Reactivar' : 'Desactivar'}
          </button>
        ` : ''}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="12" class="empty-state">Sin usuarios.</td></tr>';
  $('#usersMobileList').innerHTML = pageUsers.length
    ? pageUsers.map((user) => `
      <details class="user-mobile-card">
        <summary>
          <span class="user-mobile-avatar">${countryFlag(user.country_code)}</span>
          <span class="user-mobile-main">
            <strong>${user.username || user.player_id}</strong>
            <small>${user.country_name || user.country_code || 'Unknown'} · ${fmt(user.token_balance, 0)} FOX</small>
          </span>
          <span class="user-mobile-summary-meta user-mobile-summary-sponsor">
            <small>Patrocinador</small>
            <strong>${shortText(sponsorText(user), 26)}</strong>
          </span>
          <span class="user-mobile-summary-meta">
            <small>Pack</small>
            <strong>${user.active_package_id || 'free'}</strong>
          </span>
          <span class="user-mobile-summary-meta">
            <small>Rango</small>
            <strong>${shortText(user.rank?.name || 'Free', 18)}</strong>
          </span>
          <span class="user-mobile-summary-meta user-mobile-summary-balance">
            <small>Balance</small>
            <strong>${fmt(user.token_balance, 0)} FOX</strong>
          </span>
          <span class="user-mobile-summary-status">${statusPill(user.account_status === 'disabled' ? 'paused' : 'active')}</span>
          <span class="user-mobile-chevron"><iconify-icon icon="ph:caret-down-bold"></iconify-icon></span>
        </summary>
        <div class="user-mobile-details">
          <div><span>ID</span><strong>${user.player_id}</strong></div>
          <div><span>Correo</span><strong>${user.email || 'Sin correo'}</strong></div>
          <div><span>IP</span><strong>${user.signup_ip || 'Sin IP'}</strong></div>
          <div><span>Dispositivo</span><strong>${shortText(user.device_label || 'Unknown device', 44)}</strong></div>
          <div><span>Huella</span><strong>${shortText(user.user_agent || user.device_key || 'Sin huella', 72)}</strong></div>
          <div><span>Patrocinador</span><strong>${user.sponsor_label || user.referrer_id || 'Sin patrocinador'}</strong></div>
          ${user.sponsor_registered && user.sponsor_id ? `<div><span>ID patrocinador</span><strong>${user.sponsor_id}</strong></div>` : ''}
          <div><span>Rango</span><strong>${user.rank?.name || 'Free'} · ${money(userRankVolumeUsd(user))} org.</strong></div>
          <div><span>Paquete</span><strong>${user.active_package_id || 'free'}</strong></div>
          <div><span>Balance USD</span><strong>${money(Number(user.token_balance || 0) * Number(state.overview.settings.token_price_usd))}</strong></div>
          <div class="user-mobile-daily-production">
            <span>Produccion diaria</span>
            ${renderDailyProduction(user, 'mobile')}
          </div>
          <div><span>Registro</span><strong>${user.created_at || ''}</strong></div>
          <div class="user-mobile-actions">
            ${statusPill(user.account_status === 'disabled' ? 'paused' : 'active')}
            ${canAdmin('users_edit') ? `
            <button class="${user.account_status === 'disabled' ? 'approve-button' : 'danger-button'} compact-button" type="button" data-user-status="${user.player_id}" data-status="${user.account_status === 'disabled' ? 'active' : 'disabled'}">
              <iconify-icon icon="${user.account_status === 'disabled' ? 'ph:play-bold' : 'ph:pause-bold'}"></iconify-icon>${user.account_status === 'disabled' ? 'Reactivar' : 'Desactivar'}
            </button>
            ` : ''}
          </div>
        </div>
      </details>
    `).join('')
    : '<div class="empty-state">Sin usuarios.</div>';
  $('#usersPageInfo').textContent = users.length
    ? `Pagina ${state.usersPage} / ${totalPages} - ${fmt(users.length, 0)} usuarios`
    : 'Sin usuarios';
  $('[data-users-page="prev"]').disabled = state.usersPage <= 1;
  $('[data-users-page="next"]').disabled = state.usersPage >= totalPages;
}

function renderUsers() {
  const query = $('#userSearch').value.toLowerCase();
  const users = state.overview.players.filter((user) => JSON.stringify(user).toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(users.length / usersPageSize));
  state.usersPage = Math.max(1, Math.min(totalPages, state.usersPage || 1));
  const start = (state.usersPage - 1) * usersPageSize;
  const pageUsers = users.slice(start, start + usersPageSize);
  const sponsorDisplay = (user = {}) => {
    const label = user.sponsor_label || user.referrer_id || '';
    if (!label) return '<span class="muted">Sin patrocinador</span>';
    const secondary = user.sponsor_registered && user.sponsor_id && user.sponsor_id !== label
      ? `<br><span class="muted">${user.sponsor_id}</span>`
      : '';
    return `<strong>${shortText(label, 28)}</strong>${secondary}`;
  };
  const sponsorText = (user = {}) => user.sponsor_label || user.referrer_id || 'Sin patrocinador';
  $('#usersBody').innerHTML = pageUsers.length
    ? pageUsers.map((user) => `
      <tr>
        <td><strong>${user.username || user.player_id}</strong><br><span class="muted">${user.player_id}</span></td>
        <td><strong>${user.email || 'Sin correo'}</strong></td>
        <td>
          <span class="country-cell">${countryFlag(user.country_code)} <strong>${user.country_name || user.country_code || 'Unknown'}</strong></span>
          <br><span class="muted">${user.signup_ip || 'Sin IP'}</span>
        </td>
        <td><strong>${shortText(user.device_label || 'Unknown device')}</strong><br><span class="muted">${shortText(user.user_agent || user.device_key || 'Sin huella', 52)}</span></td>
        <td>${sponsorDisplay(user)}</td>
        <td><strong>${user.rank?.name || 'Free'}</strong><br><span class="muted">${money(userRankVolumeUsd(user))} org.</span></td>
        <td><strong>${user.active_package_id || 'free'}</strong></td>
        <td><strong>${fmt(user.token_balance, 0)}</strong><br><span class="muted">${money(Number(user.token_balance || 0) * Number(state.overview.settings.token_price_usd))}</span></td>
        <td>${renderDailyProduction(user)}</td>
        <td>${statusPill(user.account_status === 'disabled' ? 'paused' : 'active')}</td>
        <td>${user.created_at || ''}</td>
        <td>${canAdmin('users_edit') ? `
          <button class="primary-button compact-button" type="button" data-user-add-coins="${user.player_id}">
            +1M GFOX
          </button>
          <button class="${user.account_status === 'disabled' ? 'approve-button' : 'danger-button'} compact-button" type="button" data-user-status="${user.player_id}" data-status="${user.account_status === 'disabled' ? 'active' : 'disabled'}">
            <iconify-icon icon="${user.account_status === 'disabled' ? 'ph:play-bold' : 'ph:pause-bold'}"></iconify-icon>${user.account_status === 'disabled' ? 'Reactivar' : 'Desactivar'}
          </button>
        ` : ''}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="12" class="empty-state">Sin usuarios.</td></tr>';
  $('#usersMobileList').innerHTML = pageUsers.length
    ? pageUsers.map((user, index) => renderAdminUserCard(user, sponsorText, index === 0)).join('')
    : '<div class="empty-state">Sin usuarios.</div>';
  $('#usersPageInfo').textContent = users.length
    ? `Pagina ${state.usersPage} / ${totalPages} - ${fmt(users.length, 0)} usuarios`
    : 'Sin usuarios';
  $('[data-users-page="prev"]').disabled = state.usersPage <= 1;
  $('[data-users-page="next"]').disabled = state.usersPage >= totalPages;
}

function supportStatusLabel(status = '') {
  return ({
    open: 'Abierto',
    waiting_admin: 'Esperando admin',
    waiting_user: 'Respondido',
    closed: 'Cerrado',
  }[status] || 'Abierto');
}

function supportCategoryLabel(category = '') {
  return ({
    account: 'Cuenta',
    blocked: 'Bloqueo',
    purchase: 'Compra',
    withdrawal: 'Retiro',
    tasks: 'Tareas',
    other: 'Otro',
  }[category] || 'Otro');
}

function supportRatingEmoji(rating = 0) {
  return ({
    1: '😠',
    2: '🙁',
    3: '😐',
    4: '🙂',
    5: '😄',
  }[Number(rating)] || '');
}

function supportRatingLabel(rating = 0) {
  return ({
    1: 'Muy mal',
    2: 'Mal',
    3: 'Regular',
    4: 'Bien',
    5: 'Excelente',
  }[Number(rating)] || '');
}

function supportRatingEmojiDisplay(rating = 0) {
  return ({
    1: '😠',
    2: '🙁',
    3: '😐',
    4: '🙂',
    5: '😄',
  }[Number(rating)] || '');
}

function renderSupportTickets() {
  const tickets = state.overview?.support_tickets || [];
  const filter = $('#supportFilter')?.value || 'open';
  const unreadCount = tickets.reduce((sum, ticket) => sum + Number(ticket.admin_unread_count || 0), 0);
  const badge = $('#supportNavBadge');
  if (badge) {
    badge.textContent = unreadCount > 0 ? fmt(unreadCount, 0) : '';
    badge.classList.toggle('is-visible', unreadCount > 0);
  }
  const visible = tickets.filter((ticket) => {
    if (filter === 'all') return true;
    if (filter === 'closed') return ticket.status === 'closed';
    if (filter === 'unread') return Number(ticket.admin_unread_count || 0) > 0;
    return ticket.status !== 'closed';
  });
  if (!state.supportTicketId || !tickets.some((ticket) => ticket.id === state.supportTicketId)) {
    state.supportTicketId = visible[0]?.id || tickets[0]?.id || '';
  }
  const list = $('#supportTicketList');
  const detail = $('#supportTicketDetail');
  if (!list || !detail) return;
  list.innerHTML = visible.length ? visible.map((ticket) => `
    <button class="support-admin-item ${ticket.id === state.supportTicketId ? 'is-active' : ''} ${Number(ticket.admin_unread_count || 0) > 0 ? 'has-unread' : ''}" type="button" data-support-ticket="${ticket.id}">
      <span>${supportCategoryLabel(ticket.category)}</span>
      <strong>${shortText(ticket.username || ticket.player_id, 30)}</strong>
      <small>${supportStatusLabel(ticket.status)} - ${formatDateTime(ticket.last_message_at)}</small>
      ${Number(ticket.admin_unread_count || 0) > 0 ? `<b>${fmt(ticket.admin_unread_count, 0)}</b>` : ''}
    </button>
  `).join('') : '<div class="empty-state">Sin tickets en este filtro.</div>';
  const ticket = tickets.find((item) => item.id === state.supportTicketId);
  if (!ticket) {
    detail.innerHTML = '<div class="empty-state">Selecciona un ticket.</div>';
    return;
  }
  const player = (state.overview.players || []).find((item) => item.player_id === ticket.player_id);
  detail.innerHTML = `
    <div class="support-detail-head">
      <div>
        <p class="eyebrow">${supportCategoryLabel(ticket.category)}</p>
        <h3>${shortText(ticket.username || ticket.player_id, 42)}</h3>
        <small>${ticket.player_id}</small>
      </div>
      <div class="support-detail-badges">
        ${statusPill(ticket.status === 'waiting_user' ? 'active' : (ticket.status === 'closed' ? 'paused' : 'pending'))}
        ${ticket.rating ? `<span class="support-rating-pill" title="Calificación del usuario">${supportRatingEmojiDisplay(ticket.rating)} <strong>${ticket.rating}/5</strong><small>${supportRatingLabel(ticket.rating)}</small></span>` : ''}
      </div>
    </div>
    <div class="support-context-grid">
      <span><b>Pack</b>${player?.active_package_id || 'n/a'}</span>
      <span><b>Pais/IP</b>${player?.country_name || player?.country_code || 'n/a'} - ${ticket.signup_ip || player?.signup_ip || 'sin IP'}</span>
      <span><b>Dispositivo</b>${shortText(player?.device_label || ticket.device_key || 'n/a', 34)}</span>
    </div>
    <div class="support-admin-thread">
      ${(ticket.messages || []).map((message) => `
        <article class="support-admin-message support-admin-message--${message.sender_type}">
          ${message.message ? `<p>${escapeAttr(message.message)}</p>` : ''}
          ${message.image_url ? `<img class="support-admin-message-image" src="${escapeAttr(message.image_url)}" alt="Imagen adjunta" loading="lazy" decoding="async" />` : ''}
          <small>${message.sender_type === 'admin' ? 'Admin' : 'Usuario'} - ${formatDateTime(message.created_at)}</small>
        </article>
      `).join('') || '<div class="empty-state">Sin mensajes.</div>'}
    </div>
    ${ticket.status === 'closed' ? '' : `
      <label class="support-reply-box">
        <span>Respuesta al usuario</span>
        <textarea id="supportReplyText" maxlength="1200" placeholder="Escribe una respuesta clara y corta."></textarea>
      </label>
      <div class="support-admin-actions">
        ${canAdmin('support_edit') ? `
        <button class="primary-button" type="button" data-support-reply="${ticket.id}"><iconify-icon icon="ph:paper-plane-tilt-bold"></iconify-icon>Responder</button>
        <button class="ghost-button" type="button" data-support-close="${ticket.id}"><iconify-icon icon="ph:check-circle-bold"></iconify-icon>Cerrar</button>
        ` : ''}
        ${player ? `<button class="ghost-button" type="button" data-panel="users"><iconify-icon icon="ph:user-focus-bold"></iconify-icon>Usuarios</button>` : ''}
      </div>
    `}
  `;
}

function renderPackages() {
  $('#packagesGrid').innerHTML = state.overview.packages.map((pack) => `
    <article class="package-card">
      <div class="section-head">
        <div class="package-title-row">
          <span class="package-thumb"><img src="${packageIconSrc(pack)}" alt="" /></span>
          <div><h3>${pack.name}</h3><p class="muted">${pack.id}</p></div>
        </div>
        ${statusPill(pack.active ? 'active' : 'paused')}
      </div>
      <div class="package-price">
        <div><strong>${fmt(pack.price_usdt, 0)} USDT</strong><br><span class="muted">Cap ${fmt(pack.monthly_cap_usd, 2)} USDT</span></div>
        <span class="sync-pill">${fmt(pack.daily_energy, 0)} energy</span>
      </div>
      <p class="muted">${fmt(pack.task_config?.videos?.length || 0, 0)} videos en biblioteca · ${fmt(pack.task_config?.daily_video_min || 0, 0)}-${fmt(pack.task_config?.daily_video_max || 0, 0)} diarios</p>
      <div class="card-actions">
        ${canAdmin('content_edit') ? `<button class="ghost-button" type="button" data-edit-package="${pack.id}"><iconify-icon icon="ph:pencil-simple-bold"></iconify-icon>Editar</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderRanks() {
  const ranks = state.overview.ranks || [];
  const rankNetworkDepth = (rank = {}) => {
    const order = Math.max(0, Math.floor(Number(rank.sort_order || 0)));
    return order <= 0 ? 0 : 10 + ((order - 1) * 5);
  };
  $('#ranksGrid').innerHTML = ranks.length
    ? ranks.map((rank) => `
      <article class="package-card rank-card">
        <div class="section-head">
          <div class="package-title-row">
            <span class="package-thumb rank-thumb">${rank.image_url ? `<img src="${escapeAttr(rank.image_url)}" alt="" />` : '<iconify-icon icon="ph:medal-bold"></iconify-icon>'}</span>
            <div><h3>${rank.name}</h3><p class="muted">${rank.id}</p></div>
          </div>
          ${statusPill(rank.active ? 'active' : 'paused')}
        </div>
        <div class="rank-requirements-grid">
          <span><small>Directos</small><strong>${fmt(rank.required_directs, 0)}</strong></span>
          <span><small>Volumen org.</small><strong>${money(rank.required_lifetime_usd)}</strong></span>
          <span><small>Profundidad</small><strong>${rankNetworkDepth(rank) ? `${fmt(rankNetworkDepth(rank), 0)} niveles` : '-'}</strong></span>
        </div>
        <p class="muted">Equipo: ${rankRequirementsLabel(rank.team_requirements)}</p>
        <div class="card-actions">
          ${canAdmin('content_edit') ? `<button class="ghost-button" type="button" data-edit-rank="${rank.id}"><iconify-icon icon="ph:pencil-simple-bold"></iconify-icon>Editar</button>` : ''}
        </div>
      </article>
    `).join('')
    : '<article class="surface empty-state"><strong>Sin rangos</strong><span>Crea el rango Free y los niveles visuales.</span></article>';
}

function renderAvatars() {
  $('#avatarsGrid').innerHTML = (state.overview.avatars || []).map((avatar) => `
    <article class="package-card">
      <div class="section-head">
        <div class="package-title-row">
          <span class="package-thumb"><img src="${avatar.image_url}" alt="" /></span>
          <div><h3>${avatar.name}</h3><p class="muted">${avatar.id}</p></div>
        </div>
        ${statusPill(avatar.active ? 'active' : 'paused')}
      </div>
      <div class="package-price">
        <div><strong>${isEnabled(avatar.is_free) ? 'Gratis' : `${fmt(avatar.price_tokens, 0)} FOX`}</strong><br><span class="muted">${fmt(avatar.price_usdt, 2)} USDT</span></div>
      </div>
      <div class="card-actions">
        ${canAdmin('content_edit') ? `<button class="ghost-button" type="button" data-edit-avatar="${avatar.id}"><iconify-icon icon="ph:pencil-simple-bold"></iconify-icon>Editar</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderSkins() {
  const packages = state.overview.packages || [];
  $('#skinsGrid').innerHTML = (state.overview.skins || []).map((skin) => {
    const packNames = (skin.roulette_package_ids || [])
      .map((packId) => packages.find((pack) => pack.id === packId)?.name || packId)
      .join(', ') || 'Todos los packs';
    return `
      <article class="package-card">
        <div class="section-head">
          <div class="package-title-row">
            <span class="package-thumb"><img src="${skin.image_url}" alt="" /></span>
            <div><h3>${skin.name}</h3><p class="muted">${skin.id}</p></div>
          </div>
          ${statusPill(skin.active ? 'active' : 'paused')}
        </div>
        <div class="package-price">
          <div><strong>+${fmt(skin.tap_bonus_per_day, 0)} FOX/dia</strong><br><span class="muted">${fmt(skin.price_usdt, 2)} USDT</span></div>
          <span class="sync-pill">Orden ${fmt(skin.sort_order, 0)}</span>
        </div>
        <p class="muted">${packNames}</p>
        <div class="card-actions">
          ${canAdmin('content_edit') ? `<button class="ghost-button" type="button" data-edit-skin="${skin.id}"><iconify-icon icon="ph:pencil-simple-bold"></iconify-icon>Editar</button>` : ''}
          <button class="danger-button" type="button" data-remove-skin="${skin.id}"><iconify-icon icon="ph:eye-slash-bold"></iconify-icon>Ocultar y remover</button>
        </div>
      </article>
    `;
  }).join('') || '<article class="surface empty-state"><strong>Sin skins</strong><span>Agrega skins para premios de ruleta y auto tap.</span></article>';
}

function rewardTypeLabel(type) {
  return {
    tokens: 'FOX',
    tickets: 'Tickets',
    skin: 'Skin',
    avatar: 'Avatar',
    none: 'Nada',
  }[type] || type;
}

function rewardCardMedia(reward = {}) {
  if (reward.reward_type === 'skin' && reward.item_id) {
    const skin = (state.overview.skins || []).find((item) => item.id === reward.item_id);
    if (skin?.image_url) return `<img src="${escapeAttr(skin.image_url)}" alt="" />`;
  }
  if (reward.reward_type === 'avatar' && reward.item_id) {
    const avatar = (state.overview.avatars || []).find((item) => item.id === reward.item_id);
    if (avatar?.image_url) return `<img src="${escapeAttr(avatar.image_url)}" alt="" />`;
  }
  return `<iconify-icon icon="${reward.reward_type === 'none' ? 'ph:x-circle-bold' : 'ph:circle-notch-bold'}"></iconify-icon>`;
}

function rewardItemOptions(type) {
  if (type === 'skin') {
    return (state.overview.skins || [])
      .filter((skin) => skin.active !== false && skin.active !== 'false')
      .map((skin) => ({
        id: skin.id,
        name: skin.name,
        detail: `${fmt(skin.tap_bonus_per_day, 0)} FOX por dia`,
        meta: `${fmt(skin.price_usdt, 2)} USDT`,
        image: skin.image_url,
      }));
  }
  if (type === 'avatar') {
    return (state.overview.avatars || [])
      .filter((avatar) => avatar.active !== false && avatar.active !== 'false')
      .map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        detail: avatar.is_free ? 'Gratis' : `${fmt(avatar.price_tokens || 0, 0)} FOX / ${fmt(avatar.price_usdt || 0, 2)} USDT`,
        meta: avatar.id,
        image: avatar.image_url,
      }));
  }
  return [];
}

function renderRouletteItemPicker() {
  const form = $('#rouletteRewardForm');
  const type = form.elements.rewardType.value;
  const options = rewardItemOptions(type);
  const selectedId = form.elements.itemId.value;
  const amountHints = {
    tokens: 'Cantidad de FOX que se suma al usuario si gana este premio.',
    tickets: 'Cantidad de tickets extra para volver a tirar la ruleta.',
    skin: 'La skin ya trae su FOX por dia. Este campo no se usa para skin.',
    avatar: 'El avatar se entrega como item. Este campo no se usa para avatar.',
    none: 'Nada no entrega premio. Este campo no se usa.',
  };
  $('#rouletteAmountHint').textContent = amountHints[type] || amountHints.tokens;
  const usesAmount = type === 'tokens' || type === 'tickets';
  const usesUsdt = type === 'tokens';
  $('#rouletteAmountField').firstChild.textContent = type === 'tickets' ? 'Cantidad tickets' : 'Cantidad FOX';
  $('#rouletteAmountField').classList.toggle('is-hidden', !usesAmount);
  $('#rouletteAmountUsdtField').classList.toggle('is-hidden', !usesUsdt);
  form.elements.amount.disabled = !usesAmount;
  form.elements.amountUsdt.disabled = !usesUsdt;
  if (!usesAmount) form.elements.amount.value = 0;
  syncRouletteAmount(rouletteAmountSource);
  $('#rouletteItemPicker').classList.toggle('is-hidden', !options.length);
  $('#rouletteItemPickerTitle').textContent = type === 'skin' ? 'Elige la skin que puede ganar' : 'Elige el avatar que puede ganar';
  $('#rouletteItemPickerValue').textContent = selectedId || 'Sin item';
  $('#rouletteItemList').innerHTML = options.map((item) => `
    <button class="reward-item-option ${item.id === selectedId ? 'is-selected' : ''}" type="button" data-reward-item="${escapeAttr(item.id)}">
      <span><img src="${escapeAttr(item.image)}" alt="" /></span>
      <div>
        <strong>${escapeAttr(item.name)}</strong>
        <small>${escapeAttr(item.detail)}</small>
        ${item.meta ? `<em>${escapeAttr(item.meta)}</em>` : ''}
      </div>
      <b>${item.id === selectedId ? 'Elegido' : 'Elegir'}</b>
    </button>
  `).join('');
  if (options.length && !selectedId) {
    form.elements.itemId.value = options[0].id;
    renderRouletteItemPicker();
    return;
  }
  if (!options.length) form.elements.itemId.value = '';
  renderRouletteSelectedInfo();
}

function selectedRouletteItemOption() {
  const form = $('#rouletteRewardForm');
  const type = form.elements.rewardType.value;
  const selectedId = form.elements.itemId.value;
  return rewardItemOptions(type).find((item) => item.id === selectedId) || null;
}

function renderRouletteSelectedInfo() {
  const form = $('#rouletteRewardForm');
  const type = form.elements.rewardType.value;
  const info = $('#rouletteSelectedInfo');
  const item = selectedRouletteItemOption();
  if (type === 'skin' && item) {
    info.innerHTML = `
      <strong>Skin seleccionada: ${escapeAttr(item.name)}</strong>
      <span>Si el usuario gana esta opcion, recibe la skin. Su valor diario real es ${escapeAttr(item.detail)}${item.meta ? ` y su precio es ${escapeAttr(item.meta)}.` : '.'}</span>
    `;
    info.classList.remove('is-hidden');
    return;
  }
  if (type === 'avatar' && item) {
    info.innerHTML = `
      <strong>Avatar seleccionado: ${escapeAttr(item.name)}</strong>
      <span>Si el usuario gana esta opcion, recibe este avatar. No usa el campo Cantidad.</span>
    `;
    info.classList.remove('is-hidden');
    return;
  }
  info.innerHTML = '';
  info.classList.add('is-hidden');
}

function syncRouletteLabelFromItem(force = false) {
  const form = $('#rouletteRewardForm');
  const item = selectedRouletteItemOption();
  if (!item) return;
  const current = form.elements.label.value.trim();
  if (force || !current || current === '5 FOX' || current === '2 FOX') {
    form.elements.label.value = item.name;
  }
}

function renderRouletteRewards() {
  const allRewards = state.overview.roulette_rewards || [];
  const rouletteSettings = state.overview.roulette_settings || [];
  const packageSelect = $('#rouletteSettingForm').elements.packageId;
  const selected = packageSelect.value || state.overview.packages?.[0]?.id || 'free';
  packageSelect.innerHTML = (state.overview.packages || []).map((pack) => `<option value="${pack.id}">${pack.name}</option>`).join('');
  packageSelect.value = selected;
  const setting = rouletteSettings.find((item) => item.package_id === packageSelect.value) || { ticket_cost: 1 };
  $('#rouletteSettingForm').elements.ticketCost.value = setting.ticket_cost || 1;
  const rewards = allRewards.filter((reward) => reward.package_id === packageSelect.value);
  $('#rouletteRewardsGrid').innerHTML = rewards.length ? rewards.map((reward) => {
    const pack = state.overview.packages.find((item) => item.id === reward.package_id);
    return `
      <article class="package-card">
        <div class="package-card-head">
          <div class="package-title-row">
            <span class="package-thumb">${rewardCardMedia(reward)}</span>
            <div><h3>${reward.label}</h3><p class="muted">${pack?.name || reward.package_id}</p></div>
          </div>
          ${statusPill(reward.active ? 'active' : 'paused')}
        </div>
        <div class="package-price">
          <div><strong>${rewardTypeLabel(reward.reward_type)}</strong><br><span class="muted">${rouletteRewardValueLabel(reward)} · Probabilidad ${fmt(reward.weight, 0)}</span></div>
          <span class="sync-pill">Posicion ${fmt(reward.sort_order, 0)}</span>
        </div>
        <div class="package-actions">
          ${canAdmin('content_edit') ? `<button class="ghost-button" type="button" data-edit-roulette="${reward.id}"><iconify-icon icon="ph:pencil-simple-bold"></iconify-icon>Editar</button>` : ''}
        </div>
      </article>
    `;
  }).join('') : '<article class="surface empty-state"><strong>Sin premios</strong><span>Agrega premios para la ruleta por paquete.</span></article>';
}

function referralTicketRewardConfig() {
  return {
    ...defaultReferralTicketRewards,
    ...(state.overview?.settings?.referral_ticket_rewards || {}),
  };
}

function packageNameById(packId) {
  const pack = (state.overview?.packages || []).find((item) => item.id === packId);
  return pack?.name || (packId === 'free' ? 'Free Tap' : packId);
}

function renderReferralTicketRewards() {
  const form = $('#referralTicketRewardsForm');
  if (!form) return;
  const config = referralTicketRewardConfig();
  form.innerHTML = unilevelPackIds.map((packId) => {
    const value = Math.max(0, Math.floor(Number(config[packId] || 0)));
    return `
      <label>
        <span>${packageNameById(packId)}</span>
        <input data-referral-ticket-pack="${packId}" name="${packId}" type="number" min="0" max="999" step="1" value="${value}" />
      </label>
    `;
  }).join('') + '<button class="primary-button" id="referralTicketRewardsButton" type="submit">Guardar tickets</button>';
}

function rouletteRewardValueLabel(reward) {
  if (reward.reward_type === 'tokens') return `Cantidad ${fmt(reward.amount, 0)} FOX / ${compactNumberInput(Number(reward.amount || 0) * tokenPriceUsd())} USDT visual`;
  if (reward.reward_type === 'tickets') return `Cantidad ${fmt(reward.amount, 0)} tickets`;
  if (reward.reward_type === 'skin') {
    const skin = (state.overview.skins || []).find((item) => item.id === reward.item_id);
    return skin ? `Skin ${fmt(skin.tap_bonus_per_day, 0)} FOX por dia` : 'Skin seleccionada';
  }
  if (reward.reward_type === 'avatar') return 'Avatar seleccionado';
  return 'Sin premio';
}

function renderPurchases() {
  const manualForm = $('#manualPurchaseForm');
  if (manualForm) {
    const current = manualForm.elements.packageId.value || 'p30';
    manualForm.elements.packageId.innerHTML = (state.overview.packages || [])
      .filter((pack) => Number(pack.price_usdt || 0) > 0 && pack.active !== false)
      .map((pack) => `<option value="${pack.id}" ${pack.id === current ? 'selected' : ''}>${pack.name} - ${fmt(pack.price_usdt, 2)} USDT</option>`)
      .join('');
  }

  const playersList = $('#playersList');
  if (playersList && state.overview.players) {
    playersList.innerHTML = state.overview.players.map(p => `<option value="${p.player_id}">${p.username || ''} ${p.email ? `(${p.email})` : ''}</option>`).join('');
  }
  if (state.overview.players) {
    window._adminPlayersList = state.overview.players;
  }

  const filter = $('#purchaseFilter').value;
  const startDateVal = $('#purchaseStartDate')?.value || '';
  const endDateVal = $('#purchaseEndDate')?.value || '';

  // Filter purchases
  const filteredPurchases = (state.overview.purchases || []).filter((item) => {
    // Status filter
    if (filter !== 'all' && item.status !== filter) return false;

    // Date range filter
    if (item.created_at) {
      const createdDate = new Date(item.created_at);
      if (startDateVal) {
        const start = new Date(startDateVal + 'T00:00:00');
        if (createdDate < start) return false;
      }
      if (endDateVal) {
        const end = new Date(endDateVal + 'T23:59:59');
        if (createdDate > end) return false;
      }
    }
    return true;
  });

  console.log('Purchases list for rendering:', filteredPurchases);

  // Calculate metrics (using ALL purchases matching the date range, regardless of status filter, but only status === 'approved' for sales totals)
  let npTotal = 0;
  let npCount = 0;
  let manTotal = 0;
  let manCount = 0;
  let verifiedTotal = 0;
  let verifiedCount = 0;

  (state.overview.purchases || []).forEach((item) => {
    // Apply date filter for metrics
    if (item.created_at) {
      const createdDate = new Date(item.created_at);
      if (startDateVal) {
        const start = new Date(startDateVal + 'T00:00:00');
        if (createdDate < start) return;
      }
      if (endDateVal) {
        const end = new Date(endDateVal + 'T23:59:59');
        if (createdDate > end) return;
      }
    }

    if (item.status === 'approved') {
      const isManual = item.network === 'manual' || !item.network;
      if (isManual) {
        manTotal += Number(item.amount_usdt || 0);
        manCount++;
      } else {
        npTotal += Number(item.amount_usdt || 0);
        npCount++;
        if (item.real_tx_hash) {
          verifiedTotal += Number(item.amount_usdt || 0);
          verifiedCount++;
        }
      }
    }
  });

  // Update cards UI
  const nowpaymentsTotalEl = $('#nowpaymentsTotal');
  const nowpaymentsCountEl = $('#nowpaymentsCount');
  const manualTotalEl = $('#manualTotal');
  const manualCountEl = $('#manualCount');
  const verifiedTotalEl = $('#verifiedTotal');
  const verifiedCountEl = $('#verifiedCount');
  if (nowpaymentsTotalEl) nowpaymentsTotalEl.textContent = `${fmt(npTotal, 2)} USDT`;
  if (nowpaymentsCountEl) nowpaymentsCountEl.textContent = `${fmt(npCount, 0)} transacciones`;
  if (manualTotalEl) manualTotalEl.textContent = `${fmt(manTotal, 2)} USDT`;
  if (manualCountEl) manualCountEl.textContent = `${fmt(manCount, 0)} transacciones`;
  if (verifiedTotalEl) verifiedTotalEl.textContent = `${fmt(verifiedTotal, 2)} USDT`;
  if (verifiedCountEl) verifiedCountEl.textContent = `${fmt(verifiedCount, 0)} transacciones`;

  $('#purchasesBody').innerHTML = filteredPurchases.length
    ? filteredPurchases.map((item) => {
      const isManual = item.network === 'manual' || !item.network;
      const typeBadge = isManual
        ? `<span class="sync-pill" style="background: rgba(255,160,0,0.15); color: #ffa000; border-color: rgba(255,160,0,0.22); margin-top: 4px;">Manual</span>`
        : `<span class="sync-pill" style="background: rgba(70,211,158,0.15); color: #46d39e; border-color: rgba(70,211,158,0.22); margin-top: 4px;">${escapeAttr(String(item.network).toUpperCase())}</span>`;

      const txUrl = item.real_tx_hash ? explorerUrl(item.network, item.real_tx_hash) : '';
      const hashDisplay = txUrl
        ? `<a class="sync-pill tx-link" href="${txUrl}" target="_blank" rel="noopener" style="font-size: 0.75rem; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; border: 1px solid rgba(130, 214, 255, 0.22); color: #4cd8ff; background: rgba(5, 17, 61, 0.6);"><iconify-icon icon="ph:arrow-square-out-bold"></iconify-icon>${shortText(item.real_tx_hash, 14)}</a>`
        : `<span class="muted" style="font-size: 0.8rem; font-family: monospace;">ID: ${escapeAttr(item.tx_hash || 'Sin hash')}</span>`;

      return `
        <tr>
          <td>
            <strong>${item.id}</strong><br>
            ${typeBadge}
          </td>
          <td>${item.player_id}</td>
          <td>
            ${item.package_id}<br>
            ${hashDisplay}
          </td>
          <td>${fmt(item.amount_usdt, 2)} USDT</td>
          <td>${statusPill(item.status)}</td>
          <td>
            ${item.status === 'pending' ? `
              ${canAdmin('finance_edit') ? `
              <button class="approve-button" data-purchase-action="approve" data-id="${item.id}">Aprobar</button>
              <button class="danger-button" data-purchase-action="reject" data-id="${item.id}">Rechazar</button>
              ` : ''}
            ` : item.reviewed_at ? formatDateTime(item.reviewed_at) : formatDateTime(item.created_at)}
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="6" class="empty-state">Sin compras.</td></tr>';
}

async function saveManualPurchase(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  try {
    await api('/manual-purchase', {
      player_id: fields.playerId.value.trim(),
      package_id: fields.packageId.value,
      confirmation: fields.confirmation.value.trim(),
    });
    fields.confirmation.value = '';
    await loadData();
    showAlert('Pago manual creado y pack activado.', 'success');
  } catch (error) {
    showAlert(`No se pudo crear pago manual: ${error.message}`);
  }
}

function renderWithdrawals() {
  const filter = $('#withdrawalFilter').value;
  const rows = state.overview.withdrawals.filter((item) => filter === 'all' || item.status === filter);
  $('#withdrawalsList').innerHTML = rows.length
    ? rows.map((item) => {
      const gross = Number(item.usdt_amount || 0);
      const fee = Math.round((gross * withdrawalFeeRate + Number.EPSILON) * 100) / 100;
      const net = Math.max(0, Math.round((gross - fee + Number.EPSILON) * 100) / 100);
      const username = String(item.username || '').trim();
      const email = String(item.email || '').trim();
      const userLabel = username || 'Usuario sin nombre';
      const wallet = String(item.wallet || '').trim();
      const network = String(item.network || 'sin red').toUpperCase();
      return `
      <article class="withdrawal-card">
        <div class="withdrawal-main">
          <div class="withdrawal-head">
            <div class="withdrawal-user">
              <span class="withdrawal-user-icon"><iconify-icon icon="ph:user-circle-bold"></iconify-icon></span>
              <div>
                <h3>${escapeAttr(userLabel)}</h3>
                <p>${email ? escapeAttr(email) : shortText(item.player_id, 42)}</p>
              </div>
            </div>
            ${statusPill(item.status)}
          </div>
          <div class="withdrawal-payout">
            <span><small>Solicitado</small><strong>${fmt(gross, 2)} USDT</strong></span>
            <span><small>Fee 20%</small><strong>-${fmt(fee, 2)} USDT</strong></span>
            <span class="is-net"><small>Enviar al usuario</small><strong>${fmt(net, 2)} USDT</strong></span>
          </div>
          <div class="withdrawal-detail-grid">
            <span><small>FOX debitados</small><strong>${fmt(item.tokens, 0)} FOX</strong></span>
            <span><small>Red</small><strong>${escapeAttr(network)}</strong></span>
            <span><small>Fecha</small><strong>${formatDateTime(item.created_at)}</strong></span>
            <span><small>ID retiro</small><strong>${shortText(item.id, 28)}</strong></span>
          </div>
          <div class="withdrawal-meta">
            <button class="sync-pill withdrawal-wallet" type="button" data-copy-wallet="${escapeAttr(wallet)}" ${wallet ? '' : 'disabled'} title="Copiar wallet">
              <iconify-icon icon="ph:copy-bold"></iconify-icon>
              <span>${escapeAttr(wallet || 'Sin wallet')}</span>
              ${wallet ? '<b>Copiar</b>' : ''}
            </button>
            ${item.tx_hash ? (() => {
              const txUrl = item.tx_url || explorerUrl(item.network, item.tx_hash);
              const txLabel = shortText(item.tx_hash, 34);
              return txUrl
                ? `<a class="sync-pill tx-link" href="${txUrl}" target="_blank" rel="noopener">${txLabel}</a>`
                : `<span class="sync-pill tx-reference">${txLabel}</span>`;
            })() : ''}
          </div>
        </div>
        <div class="withdrawal-actions">
          ${canAdmin('finance_edit') ? `
          <button class="approve-button" type="button" data-withdrawal-action="approve" data-id="${item.id}" ${item.status !== 'pending' ? 'disabled' : ''}>Aprobar</button>
          <button class="danger-button" type="button" data-withdrawal-action="reject" data-id="${item.id}" ${item.status !== 'pending' ? 'disabled' : ''}>Rechazar</button>
          ` : ''}
        </div>
      </article>
    `;
    }).join('')
    : '<div class="empty-state">Sin retiros pendientes</div>';
}

function renderWorldCup() {
  const matches = state.overview.matches || [];
  const container = $('#matchesContainer');
  if (!container) return;

  container.innerHTML = matches.length
    ? matches.map((item) => {
      const stats = item.poolStats || { team_a: 0, draw: 0, team_b: 0, total: 0 };
      const betsCount = item.userBets ? item.userBets.length : 0;
      
      const odds = {
        team_a: Math.max(1, Number(item.odds_team_a || 1.10)),
        draw: Math.max(1, Number(item.odds_draw || 3.00)),
        team_b: Math.max(1, Number(item.odds_team_b || 2.00)),
      };

      let platformProfit = 0;
      let totalBetsAmount = 0;
      if (item.userBets) {
        item.userBets.forEach(b => {
          totalBetsAmount += Number(b.amount || 0);
        });
      }
      if (item.status === 'resolved' && item.result) {
        let totalPayouts = 0;
        if (item.userBets) {
          item.userBets.forEach(b => {
            if (b.bet_type === item.result) {
              const winningOdds = odds[item.result] || 1;
              totalPayouts += Math.floor(Number(b.amount) * winningOdds);
            }
          });
        }
        platformProfit = totalBetsAmount - totalPayouts;
      }

      return `
        <article class="match-card">
          <div class="match-card-header">
            <span class="match-card-venue">
              <iconify-icon icon="ph:soccer-ball-bold" style="color:var(--accent);"></iconify-icon>
              ${escapeAttr(item.venue || 'Por definir')}
            </span>
            <span class="match-card-date">${item.match_date ? formatDateTime(item.match_date) : formatDateTime(item.created_at)}</span>
          </div>

          <div class="match-teams-display">
            <div class="match-team-side">
              <span class="match-team-flag">${item.flag_a || '⚽'}</span>
              <span class="match-team-name">${item.team_a}</span>
            </div>
            
            <div class="match-vs-divider">
              <span class="match-vs-label">VS</span>
              <span class="sync-pill">Cuotas fijas</span>
              ${statusPill(item.status)}
              ${item.status === 'resolved' ? `<small style="color:var(--accent); font-weight:700; margin-top:2px;">Ganó: ${item.result === 'team_a' ? item.team_a : item.result === 'team_b' ? item.team_b : 'Empate'}</small>` : ''}
            </div>

            <div class="match-team-side">
              <span class="match-team-flag">${item.flag_b || '⚽'}</span>
              <span class="match-team-name">${item.team_b}</span>
            </div>
          </div>

          <div class="match-pool-labels">
            <div class="match-pool-label-item local">
              <span class="match-pool-title">Local (${item.team_a})</span>
              <span class="match-pool-value" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                x<input type="number" step="0.05" min="1.0" class="odds-inline-input" data-id="${item.id}" data-type="team_a" value="${odds.team_a.toFixed(2)}" style="width: 65px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 4px; padding: 2px; font-weight: 700; text-align: center; font-size: 0.95rem; outline: none; transition: all 0.2s ease;">
              </span>
              <span class="match-pool-manual">Pago estimado por FOX apostado</span>
            </div>
            <div class="match-pool-label-item draw">
              <span class="match-pool-title">Empate</span>
              <span class="match-pool-value" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                x<input type="number" step="0.05" min="1.0" class="odds-inline-input" data-id="${item.id}" data-type="draw" value="${odds.draw.toFixed(2)}" style="width: 65px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 4px; padding: 2px; font-weight: 700; text-align: center; font-size: 0.95rem; outline: none; transition: all 0.2s ease;">
              </span>
              <span class="match-pool-manual">Pago estimado por FOX apostado</span>
            </div>
            <div class="match-pool-label-item visitor">
              <span class="match-pool-title">Visita (${item.team_b})</span>
              <span class="match-pool-value" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                x<input type="number" step="0.05" min="1.0" class="odds-inline-input" data-id="${item.id}" data-type="team_b" value="${odds.team_b.toFixed(2)}" style="width: 65px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 4px; padding: 2px; font-weight: 700; text-align: center; font-size: 0.95rem; outline: none; transition: all 0.2s ease;">
              </span>
              <span class="match-pool-manual">Pago estimado por FOX apostado</span>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight:700; color: #fff; margin-top: -4px;">
            <div>Apuestas: <span style="color:var(--accent);">${fmt(totalBetsAmount, 0)} FOX</span></div>
            <div>
              ${item.status === 'resolved' ? `
                Plataforma: <span style="color: ${platformProfit >= 0 ? '#46d39e' : '#ff5b8c'};">${platformProfit >= 0 ? 'Ganó +' : 'Perdió '}${fmt(platformProfit, 0)} FOX</span>
              ` : `
                <span style="color: rgba(255,255,255,0.5);">Pendiente de juego</span>
              `}
            </div>
          </div>

          <!-- User Bets Expandable List -->
          <div class="match-bets-count-section">
            <button type="button" class="match-toggle-bets-btn" onclick="toggleUserBets('${item.id}')">
              <span><strong>${betsCount}</strong> Apuestas de Usuarios</span>
              <iconify-icon icon="ph:caret-down-bold"></iconify-icon>
            </button>
            
            <div id="bets-detail-${item.id}" class="match-bets-details-list" style="display: none;">
              ${betsCount > 0 ? item.userBets.map(b => {
                const isWinning = item.status === 'resolved' && b.bet_type === item.result;
                let statusHtml = '';
                if (item.status === 'resolved') {
                  if (isWinning) {
                    const winningOdds = odds[item.result] || 1;
                    const payout = Math.floor(Number(b.amount) * winningOdds);
                    statusHtml = `<span style="color: #46d39e; font-weight: 700;">Ganó (+${fmt(payout, 0)} FOX)</span>`;
                  } else {
                    statusHtml = `<span style="color: #ff5b8c; font-weight: 700;">Perdió (-${fmt(b.amount, 0)} FOX)</span>`;
                  }
                } else {
                  statusHtml = `<span style="color: rgba(255,255,255,0.5);">Pendiente</span>`;
                }
                const chosenTeam = b.bet_type === 'team_a' ? item.team_a : b.bet_type === 'team_b' ? item.team_b : 'Empate';
                return `
                  <div class="match-bet-detail-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 6px 0;">
                    <div>
                      <strong>${escapeAttr(b.username)}</strong>
                      <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">${chosenTeam} (${fmt(b.amount, 0)} FOX)</div>
                    </div>
                    <div style="text-align: right;">
                      ${statusHtml}
                    </div>
                  </div>
                `;
              }).join('') : '<div style="text-align:center; color:var(--muted); padding: 8px;">Sin apuestas registradas</div>'}
            </div>
          </div>

          <!-- Admin actions section -->
          <div class="match-actions-section">
            <div class="match-control-row">
              ${item.status === 'open' ? `
                <button type="button" class="approve-button" style="width:100%;" onclick="handleMatchAction('close', '${item.id}')">Cerrar Apuestas</button>
              ` : ''}
              ${item.status === 'closed' ? `
                <button type="button" class="primary-button" onclick="handleMatchAction('resolve', '${item.id}', 'team_a')">Ganó ${item.team_a}</button>
                <button type="button" class="primary-button" onclick="handleMatchAction('resolve', '${item.id}', 'draw')">Empate</button>
                <button type="button" class="primary-button" onclick="handleMatchAction('resolve', '${item.id}', 'team_b')">Ganó ${item.team_b}</button>
              ` : ''}
            </div>
            <div class="match-control-row" style="margin-top: 6px;">
              <button type="button" class="${item.status === 'disabled' ? 'approve-button' : 'reject-button'}" style="width:100%;" onclick="handleMatchAction('toggle-disabled', '${item.id}')">
                ${item.status === 'disabled' ? '👁️ Activar (Mostrar a Usuarios)' : '🚫 Ocultar (Desactivar Partido)'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('')
    : '<div class="empty-state" style="grid-column: 1 / -1;">Sin partidos registrados.</div>';
}

function renderSeason() {
  const settings = state.overview.settings || {};
  const limit = Math.max(1, Math.min(100, Number(settings.season_winner_limit || 20)));
  const now = Date.now();
  const startMs = settings.season_start_at ? new Date(settings.season_start_at).getTime() : NaN;
  const endMs = settings.season_end_at ? new Date(settings.season_end_at).getTime() : NaN;
  const status = Number.isFinite(endMs) && endMs <= now
    ? 'Finalizada'
    : Number.isFinite(startMs) && startMs > now
      ? 'Programada'
      : 'Activa';
  const winners = [...(state.overview.players || [])]
    .filter((user) => Number(user.season_earned_tokens || 0) > 0)
    .sort((a, b) => {
      const seasonDiff = Number(b.season_earned_tokens || 0) - Number(a.season_earned_tokens || 0);
      return seasonDiff || Number(b.total_earned_usd || 0) - Number(a.total_earned_usd || 0);
    })
    .slice(0, limit);

  $('#seasonStatus').textContent = `${status} · ${formatDateTime(settings.season_end_at)}`;
  $('#seasonWinnerCount').textContent = `${winners.length} / ${limit}`;
  $('#seasonWinnersList').innerHTML = winners.length
    ? winners.map((user, index) => `
      <article class="winner-row">
        <span class="winner-rank">#${index + 1}</span>
        <span class="winner-country">${countryFlag(user.country_code)}</span>
        <div>
          <strong>${user.username || user.player_id}</strong>
          <small>${user.country_name || user.country_code || 'Unknown'} · ${user.active_package_id || 'free'} · ${shortText(user.device_label || 'Unknown device', 26)}</small>
        </div>
        <div class="winner-score">
          <strong>${fmt(user.season_earned_tokens || 0, 0)} FOX</strong>
          <small>ganado esta temporada</small>
        </div>
      </article>
    `).join('')
    : '<div class="empty-state">Todavia no hay usuarios para la temporada.</div>';
}

function renderSeasonPanel() {
  const settings = state.overview.settings || {};
  const limit = Math.max(1, Math.min(100, Number(settings.season_winner_limit || 20)));
  const rewardPool = Math.max(0, Number(settings.season_reward_tokens || 0));
  const rewardMode = settings.season_reward_mode || 'competitive';
  const now = Date.now();
  const startMs = settings.season_start_at ? new Date(settings.season_start_at).getTime() : NaN;
  const endMs = settings.season_end_at ? new Date(settings.season_end_at).getTime() : NaN;
  const status = !Number.isFinite(startMs) || !Number.isFinite(endMs)
    ? 'Sin temporada'
    : endMs <= now
      ? 'Finalizada'
      : startMs > now
        ? 'Programada'
        : 'Activa';
  const winners = [...(state.overview.players || [])]
    .filter((user) => Number(user.season_earned_tokens || 0) > 0)
    .sort((a, b) => {
      const seasonDiff = Number(b.season_earned_tokens || 0) - Number(a.season_earned_tokens || 0);
      return seasonDiff || Number(b.total_earned_usd || 0) - Number(a.total_earned_usd || 0);
    })
    .slice(0, limit);

  $('#seasonStatus').textContent = `${status} - ${formatDateTime(settings.season_end_at)}`;
  $('#seasonWinnerCount').textContent = `${winners.length} / ${limit}`;
  $('#seasonPayButton').disabled = !winners.length || rewardPool <= 0 || Boolean(settings.season_paid_key);
  $('#seasonPayButton').textContent = settings.season_paid_key
    ? `Pagado ${formatDateTime(settings.season_paid_at)}`
    : `Repartir pool ${fmt(rewardPool, 0)} FOX`;
  const previewRewards = seasonRewardPreview(rewardPool, winners.length, rewardMode);
  $('#seasonWinnersList').innerHTML = winners.length
    ? winners.map((user, index) => `
      <article class="winner-row">
        <span class="winner-rank">#${index + 1}</span>
        <span class="winner-country">${countryFlag(user.country_code)}</span>
        <div>
          <strong>${user.username || user.player_id}</strong>
          <small>${user.country_name || user.country_code || 'Unknown'} - ${user.active_package_id || 'free'} - ${shortText(user.device_label || 'Unknown device', 26)}</small>
        </div>
        <div class="winner-score">
          <strong>${fmt(user.season_earned_tokens || 0, 0)} FOX</strong>
          <small>${previewRewards[index] ? `+${fmt(previewRewards[index], 0)} FOX premio` : 'ganado esta temporada'}</small>
        </div>
      </article>
    `).join('')
    : '<div class="empty-state">Todavia no hay usuarios para la temporada.</div>';
  renderSeasonSchedule(settings);
}

function seasonRewardPreview(poolTokens, count, mode = 'competitive') {
  const pool = Math.max(0, Math.floor(Number(poolTokens || 0)));
  const total = Math.max(0, Math.floor(Number(count || 0)));
  if (!pool || !total) return [];
  if (mode === 'equal') {
    const base = Math.floor(pool / total);
    let remainder = pool - (base * total);
    return Array.from({ length: total }, () => {
      const value = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return value;
    });
  }
  const weights = Array.from({ length: total }, (_, index) => {
    const position = index + 1;
    if (position === 1) return 25;
    if (position === 2) return 15;
    if (position === 3) return 10;
    if (position <= 10) return 5;
    return 1.5;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const rewards = weights.map((weight) => Math.floor((pool * weight) / weightTotal));
  let remainder = pool - rewards.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < rewards.length && remainder > 0; index += 1) {
    rewards[index] += 1;
    remainder -= 1;
  }
  return rewards;
}

function renderSeasonSchedule(settings = {}) {
  const list = $('#seasonScheduleList');
  if (!list) return;
  const now = Date.now();
  const activeId = settings.season_schedule_active_id || '';
  const rows = Array.isArray(settings.season_schedule) ? settings.season_schedule : [];
  list.innerHTML = rows.length
    ? rows.map((season) => {
      const startMs = season.start_at ? new Date(season.start_at).getTime() : NaN;
      const endMs = season.end_at ? new Date(season.end_at).getTime() : NaN;
      const status = season.id === activeId
        ? 'Activa'
        : Number.isFinite(endMs) && endMs < now
          ? 'Finalizada'
          : Number.isFinite(startMs) && startMs > now
            ? 'Programada'
            : 'Inactiva';
      const seasonId = escapeAttr(season.id);
      return `
        <article class="season-calendar-row ${season.id === activeId ? 'is-active' : ''}">
          <div class="season-calendar-main">
            <div class="season-image-row">
              <div class="season-image-preview" data-season-image-preview="${seasonId}">
                ${season.image_url ? `<img src="${escapeAttr(season.image_url)}" alt="" />` : '<iconify-icon icon="ph:image-square-bold"></iconify-icon>'}
              </div>
              <label>
                Imagen WebP
                <input data-season-field="image_url" data-season-id="${seasonId}" value="${escapeAttr(season.image_url || '')}" placeholder="./images/... o WebP optimizado" />
              </label>
              <label class="season-image-file" data-season-upload-button="${seasonId}">
                <span data-season-upload-button-label="${seasonId}">Subir</span>
                <input data-season-image-file data-season-id="${seasonId}" type="file" accept="image/*" />
              </label>
              <div class="season-upload-status" data-season-upload-status="${seasonId}" aria-live="polite">
                <span>Lista</span>
                <strong>0%</strong>
                <em style="width: 0%"></em>
              </div>
            </div>
            <label>
              Nombre
              <input data-season-field="name" data-season-id="${seasonId}" value="${escapeAttr(season.name || season.id)}" maxlength="80" />
            </label>
            <div class="season-calendar-dates">
              <label>
                Empieza
                <input data-season-field="start_at" data-season-id="${seasonId}" type="datetime-local" value="${toDateTimeLocal(season.start_at)}" />
              </label>
              <label>
                Termina
                <input data-season-field="end_at" data-season-id="${seasonId}" type="datetime-local" value="${toDateTimeLocal(season.end_at)}" />
              </label>
            </div>
          </div>
          <div class="season-calendar-side">
            <span class="sync-pill">${status}</span>
            <label>
              Pool total FOX
              <input data-season-field="reward_tokens" data-season-id="${seasonId}" type="number" min="0" step="1" value="${season.reward_tokens || 0}" />
            </label>
            <label>
              Distribución
              <select data-season-field="reward_mode" data-season-id="${seasonId}">
                <option value="competitive" ${(season.reward_mode || 'competitive') === 'competitive' ? 'selected' : ''}>Competitiva</option>
                <option value="equal" ${season.reward_mode === 'equal' ? 'selected' : ''}>Igualitaria</option>
              </select>
            </label>
            <label>
              Ganadores
              <input data-season-field="winner_limit" data-season-id="${seasonId}" type="number" min="1" max="100" step="1" value="${season.winner_limit || 20}" />
            </label>
            <label class="season-calendar-active">
              <input data-season-field="active" data-season-id="${seasonId}" type="checkbox" ${season.active === false ? '' : 'checked'} />
              Activa
            </label>
          </div>
        </article>
      `;
    }).join('')
    : '<div class="empty-state">No hay calendario configurado.</div>';
}

function collectSeasonSchedule() {
  const baseRows = Array.isArray(state.overview?.settings?.season_schedule)
    ? state.overview.settings.season_schedule
    : [];
  return baseRows.map((season) => {
    const field = (name) => document.querySelector(`[data-season-field="${name}"][data-season-id="${season.id}"]`);
    return {
      id: season.id,
      name: field('name')?.value.trim() || season.name || season.id,
      start_at: fromDateTimeLocal(field('start_at')?.value || '') || season.start_at,
      end_at: fromDateTimeLocal(field('end_at')?.value || '') || season.end_at,
      reward_tokens: Math.max(0, Math.floor(Number(field('reward_tokens')?.value || 0))),
      reward_mode: ['equal', 'competitive'].includes(field('reward_mode')?.value) ? field('reward_mode').value : 'competitive',
      image_url: field('image_url')?.value.trim() || '',
      winner_limit: Math.max(1, Math.min(100, Math.floor(Number(field('winner_limit')?.value || 20)))),
      active: Boolean(field('active')?.checked),
    };
  });
}

function buildAdminUnilevelRows(rootId) {
  const players = state.overview.players || [];
  const children = new Map();
  players.forEach((player) => {
    if (!player.referrer_id) return;
    if (!children.has(player.referrer_id)) children.set(player.referrer_id, []);
    children.get(player.referrer_id).push(player);
  });
  const rows = [];
  const walk = (parentId, level) => {
    if (level > 10) return;
    (children.get(parentId) || []).forEach((child) => {
      rows.push({ ...child, level });
      walk(child.player_id, level + 1);
    });
  };
  walk(rootId, 1);
  return rows;
}

function sortedActiveRanks() {
  return (state.overview.ranks || [])
    .filter((rank) => rank.active !== false)
    .sort((a, b) => (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || (Number(a.required_lifetime_usd || 0) - Number(b.required_lifetime_usd || 0)));
}

function rankNetworkDepth(rank = {}) {
  const order = Number(rank.sort_order || 0);
  return order <= 0 ? 0 : 10 + ((order - 1) * 5);
}

function unilevelEnabledLevels(packId) {
  const config = state.overview.settings?.unilevel_config || {};
  const values = config[packId] || defaultUnilevelConfig[packId] || [];
  return values.filter((rate) => Number(rate || 0) > 0).length;
}

function rankVolumeForRequirement(user = {}, rank = {}) {
  const byDepth = user.rank?.network_volume_by_depth || {};
  return Math.max(0, Number(byDepth[rank.id] ?? userRankVolumeUsd(user)));
}

function rankRequirementProgress(user = {}, nextRank = {}) {
  const ranks = sortedActiveRanks();
  const rankById = new Map(ranks.map((rank) => [rank.id, rank]));
  const counts = user.rank?.team_rank_counts || {};
  return Object.entries(nextRank.team_requirements || {})
    .filter(([, required]) => Number(required) > 0)
    .map(([rankId, required]) => {
      const targetRank = rankById.get(rankId);
      const targetOrder = Number(targetRank?.sort_order || 0);
      const current = ranks
        .filter((rank) => Number(rank.sort_order || 0) >= targetOrder)
        .reduce((sum, rank) => sum + Number(counts[rank.id] || 0), 0);
      return {
        label: targetRank?.name || rankId,
        current,
        required: Number(required || 0),
        missing: Math.max(0, Number(required || 0) - current),
      };
    });
}

function progressPercent(current, required) {
  const goal = Math.max(0, Number(required || 0));
  if (!goal) return 100;
  return Math.max(0, Math.min(100, (Number(current || 0) / goal) * 100));
}

function renderUnilevelRankProgress(user) {
  const target = $('#unilevelRankProgress');
  if (!target) return;
  if (!user) {
    target.innerHTML = '<p class="empty-state">Selecciona un usuario para ver su progreso.</p>';
    return;
  }

  const ranks = sortedActiveRanks();
  const packId = user.active_package_id || 'free';
  const currentRankId = user.rank?.id || 'free';
  const currentRank = ranks.find((rank) => rank.id === currentRankId) || user.rank || ranks[0] || { name: 'Free', sort_order: 0 };
  const currentOrder = Number(currentRank.sort_order || 0);
  const nextRank = ranks.find((rank) => Number(rank.sort_order || 0) > currentOrder);
  const enabledLevels = unilevelEnabledLevels(packId);
  const currentVolume = userRankVolumeUsd(user);
  const directCount = Number(user.rank?.direct_count || 0);

  if (!nextRank) {
    target.innerHTML = `
      <div class="rank-progress-head">
        <div>
          <small>Progreso de rango</small>
          <strong>${escapeAttr(user.username || user.player_id)}</strong>
        </div>
        <span class="rank-progress-badge">Rango maximo</span>
      </div>
      <div class="rank-progress-grid">
        <article><span>Pack actual</span><strong>${escapeAttr(packId)}</strong></article>
        <article><span>Niveles</span><strong>${fmt(enabledLevels, 0)} niveles</strong></article>
        <article><span>Rango actual</span><strong>${escapeAttr(currentRank.name || 'Free')}</strong></article>
        <article><span>Volumen packs</span><strong>${money(currentVolume)}</strong></article>
      </div>
      <p class="rank-progress-note">Este usuario ya no tiene un siguiente rango activo configurado.</p>
    `;
    return;
  }

  const volumeForNext = rankVolumeForRequirement(user, nextRank);
  const requiredVolume = Number(nextRank.required_lifetime_usd || 0);
  const requiredDirects = Number(nextRank.required_directs || 0);
  const missingVolume = Math.max(0, requiredVolume - volumeForNext);
  const missingDirects = Math.max(0, requiredDirects - directCount);
  const teamProgress = rankRequirementProgress(user, nextRank);
  const teamReady = !teamProgress.some((item) => item.missing > 0);

  target.innerHTML = `
    <div class="rank-progress-head">
      <div>
        <small>Progreso de rango por usuario</small>
        <strong>${escapeAttr(user.username || user.player_id)}</strong>
      </div>
      <span class="rank-progress-badge">${escapeAttr(currentRank.name || 'Free')} -> ${escapeAttr(nextRank.name || 'Siguiente')}</span>
    </div>
    <div class="rank-progress-grid">
      <article><span>Pack actual</span><strong>${escapeAttr(packId)}</strong></article>
      <article><span>Niveles</span><strong>${fmt(enabledLevels, 0)} niveles</strong></article>
      <article><span>Rango actual</span><strong>${escapeAttr(currentRank.name || 'Free')}</strong></article>
      <article><span>Volumen packs</span><strong>${money(currentVolume)}</strong></article>
    </div>
    <section class="rank-progress-next">
      <div class="rank-progress-next-head">
        <div>
          <small>Siguiente rango</small>
          <strong>${escapeAttr(nextRank.name || 'Siguiente')}</strong>
        </div>
        <span>Profundidad usada: ${fmt(rankNetworkDepth(nextRank), 0)} niveles</span>
      </div>
      <div class="rank-progress-line">
        <header><span>Directos</span><strong>${fmt(directCount, 0)} / ${fmt(requiredDirects, 0)}</strong></header>
        <div class="rank-progress-track"><span style="width: ${progressPercent(directCount, requiredDirects)}%"></span></div>
        <small>${missingDirects > 0 ? `Faltan ${fmt(missingDirects, 0)} directos` : 'Directos completos'}</small>
      </div>
      <div class="rank-progress-line">
        <header><span>Volumen de packs</span><strong>${money(volumeForNext)} / ${money(requiredVolume)}</strong></header>
        <div class="rank-progress-track"><span style="width: ${progressPercent(volumeForNext, requiredVolume)}%"></span></div>
        <small>${missingVolume > 0 ? `Falta ${money(missingVolume)}` : 'Volumen completo'}</small>
      </div>
      <div class="rank-team-requirements">
        ${teamProgress.length ? teamProgress.map((item) => `
          <span class="${item.missing > 0 ? '' : 'is-ready'}">${escapeAttr(item.label)}: ${fmt(item.current, 0)}/${fmt(item.required, 0)}${item.missing > 0 ? ` - faltan ${fmt(item.missing, 0)}` : ' - listo'}</span>
        `).join('') : '<span class="is-ready">Equipo requerido: ninguno</span>'}
      </div>
      <p class="rank-progress-note">${missingDirects || missingVolume || !teamReady ? 'Aun faltan requisitos para el siguiente rango.' : 'Requisitos del siguiente rango completos.'}</p>
    </section>
  `;
}

function renderAdminUnilevelMap() {
  const users = state.overview.players || [];
  const term = ($('#unilevelUserSearch')?.value || '').toLowerCase();
  const matches = users
    .filter((user) => `${user.username} ${user.player_id}`.toLowerCase().includes(term))
    .slice(0, 8);
  if (!state.adminUnilevelUserId && users[0]) state.adminUnilevelUserId = users[0].player_id;
  $('#unilevelUserList').innerHTML = matches.map((user) => `
    <button class="unilevel-user-chip ${state.adminUnilevelUserId === user.player_id ? 'is-active' : ''}" type="button" data-unilevel-user="${user.player_id}">
      ${countryFlag(user.country_code)} <span>${user.username || user.player_id}</span><small>${user.active_package_id}</small>
    </button>
  `).join('');
  const selectedUser = users.find((user) => user.player_id === state.adminUnilevelUserId);
  renderUnilevelRankProgress(selectedUser);
  const rows = buildAdminUnilevelRows(state.adminUnilevelUserId);
  const grouped = Array.from({ length: 10 }, (_, index) => rows.filter((row) => row.level === index + 1));
  $('#adminUnilevelMap').innerHTML = `
    <div class="unilevel-summary"><strong>${rows.length}</strong><span>usuarios en red</span></div>
    <div class="unilevel-summary">
      <strong>${fmt((state.overview.commissions || []).filter((row) => row.referrer_player_id === state.adminUnilevelUserId).reduce((sum, row) => sum + Number(row.lost_tokens || 0), 0), 0)}</strong>
      <span>FOX perdidos por cap</span>
    </div>
    <section class="unilevel-level">
      <h4>Historial de comisiones <span>${(state.overview.commissions || []).filter((row) => row.referrer_player_id === state.adminUnilevelUserId).length}</span></h4>
      ${(state.overview.commissions || []).filter((row) => row.referrer_player_id === state.adminUnilevelUserId).slice(0, 12).map((row) => `
        <article><span>L${row.level}</span><div><strong>${fmt(row.credited_tokens, 0)} FOX acreditados</strong><small>${fmt(row.lost_tokens, 0)} FOX perdidos · ${row.source_type} · ${row.status}</small></div></article>
      `).join('') || '<p class="empty-state">Sin comisiones.</p>'}
    </section>
    ${grouped.map((levelRows, index) => `
      <section class="unilevel-level">
        <h4>Nivel ${index + 1} <span>${levelRows.length}</span></h4>
        ${levelRows.length ? levelRows.slice(0, 12).map((user) => `
          <article>${countryFlag(user.country_code)} <strong>${user.username || user.player_id}</strong><small>${user.active_package_id} · ${fmt(user.token_balance, 0)} FOX</small></article>
        `).join('') : '<p class="empty-state">Sin usuarios.</p>'}
      </section>
    `).join('')}
  `;
}

function renderAll() {
  renderMetrics();
  renderAdminChrome();
  renderActivity();
  renderUsers();
  renderSupportTickets();
  renderPackages();
  renderRanks();
  renderAvatars();
  renderSkins();
  renderRouletteRewards();
  renderReferralTicketRewards();
  renderUnilevelConfig();
  renderAdminUnilevelMap();
  renderSeasonPanel();
  renderPurchases();
  renderWithdrawals();
  renderWorldCup();
  renderAdminUsers();
  $('#syncStatus').textContent = state.overview.persistence === 'postgres' ? 'Postgres' : 'Memoria';
}

function renderAdminChrome() {
  const panelPermissions = {
    overview: 'overview_view',
    users: 'users_view',
    support: 'support_view',
    packages: 'content_view',
    ranks: 'content_view',
    avatars: 'content_view',
    skins: 'content_view',
    roulette: 'content_view',
    unilevel: 'content_view',
    season: 'content_view',
    purchases: 'finance_view',
    withdrawals: 'finance_view',
    hotwallet: 'settings_view',
    settings: 'settings_view',
    admins: 'admins_view',
    maintenance: 'maintenance_edit',
  };
  const activePermission = panelPermissions[state.activePanel] || 'overview_view';
  if (!canAdmin(activePermission)) {
    state.activePanel = Object.keys(panelPermissions).find((panel) => canAdmin(panelPermissions[panel])) || 'overview';
  }
  $$('[data-panel]').forEach((button) => {
    const permission = panelPermissions[button.dataset.panel] || 'overview_view';
    button.classList.toggle('is-hidden', !canAdmin(permission));
    button.classList.toggle('is-active', button.dataset.panel === state.activePanel);
  });
  $$('[data-panel-view]').forEach((panel) => {
    const permission = panelPermissions[panel.dataset.panelView] || 'overview_view';
    const isActive = panel.dataset.panelView === state.activePanel;
    panel.classList.toggle('is-active', isActive);
    panel.classList.toggle('is-hidden', !canAdmin(permission) || !isActive);
  });
  $$('[data-superadmin-section]').forEach((item) => item.classList.toggle('is-hidden', !canAdmin('admins_view')));
  $$('[data-real-super-section]').forEach((item) => item.classList.toggle('is-hidden', !isRealSuperAdmin()));
  $('#adminUserForm')?.classList.toggle('is-hidden', !canAdmin('admins_edit'));
  $('[data-view="dashboard"]')?.classList.toggle('admin-readonly', !canAdmin('settings_edit'));
  ['newPackageButton', 'newRankButton', 'newAvatarButton', 'newSkinButton', 'newRouletteRewardButton', 'seasonPayButton', 'seasonScheduleSaveButton'].forEach((id) => {
    $(`#${id}`)?.classList.toggle('is-hidden', !canAdmin('content_edit'));
  });
  ['tokenPriceForm', 'withdrawalSettingsForm', 'securityForm', 'hotWalletForm'].forEach((id) => {
    $(`#${id}`)?.classList.toggle('is-hidden', !canAdmin('settings_edit'));
  });
  ['adminPushButton', 'adminPushTestButton'].forEach((id) => {
    $(`#${id}`)?.classList.toggle('is-hidden', !canAdmin('settings_edit') || isLocalAdminHost());
  });
  $('#sidebarAdminName').textContent = state.admin?.username || 'Admin';
  $('#panelTitle').textContent = adminPanelTitles[state.activePanel] || 'Resumen';
}

async function loadData() {
  clearAlert();
  try {
    state.overview = await api('/overview');
    state.admin = state.overview.admin || state.admin;
    state.admins = canAdmin('admins_view') ? (await api('/admins')).admins || [] : [];
    saveAdminSession();
    renderAll();
    updateAdminPushButton();
    void ensureAdminPushNotifications(false);
    void loadAdminPushDiagnostics();
  } catch (error) {
    state.overview = null;
    if (error.message === 'invalid_admin_key') {
      state.authKey = '';
      state.authToken = '';
      state.admin = null;
      clearAdminSession();
      showLogin();
      showAlert('Clave admin invalida. Ingresa la clave actual de Railway.', 'warn');
      return;
    }
    showAlert(`No se pudo cargar admin: ${error.message}`);
  }
}

function showDashboard() {
  document.documentElement.classList.remove('admin-session-restoring');
  $('[data-view="login"]').classList.add('is-hidden');
  $('[data-view="dashboard"]').classList.remove('is-hidden');
  void loadData();
}

function showLogin() {
  document.documentElement.classList.remove('admin-session-restoring');
  $('[data-view="login"]').classList.remove('is-hidden');
  $('[data-view="dashboard"]').classList.add('is-hidden');
  closeSidebar();
  $('#adminUsername').value = state.admin?.username || '';
  $('#adminPassword').value = '';
}

function openSidebar() {
  $('[data-view="dashboard"]')?.classList.add('sidebar-is-open');
}

function closeSidebar() {
  $('[data-view="dashboard"]')?.classList.remove('sidebar-is-open');
}

function switchPanel(panel) {
  state.activePanel = panel;
  renderAdminChrome();
  closeSidebar();
}

function escapeAttr(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function rankIdFromText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function rankRequirementsText(requirements = {}) {
  return Object.entries(requirements || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([rankId, count]) => `${rankId}:${Number(count)}`)
    .join('\n');
}

function parseRankRequirements(value = '') {
  const requirements = {};
  String(value || '').split(/\n|,/).forEach((line) => {
    const [rawId, rawCount] = line.split(':');
    const id = rankIdFromText(rawId || '');
    const count = Math.max(0, Math.floor(Number(rawCount || 0)));
    if (id && count > 0) requirements[id] = count;
  });
  return requirements;
}

function rankRequirementsLabel(requirements = {}) {
  const ranks = state.overview?.ranks || [];
  const items = Object.entries(requirements || {}).filter(([, count]) => Number(count) > 0);
  if (!items.length) return 'Ninguno';
  return items.map(([rankId, count]) => {
    const rank = ranks.find((item) => item.id === rankId);
    return `${fmt(count, 0)} ${rank?.name || rankId}`;
  }).join(' + ');
}

function taskRowMarkup(task = {}, type = 'youtube') {
  const safeType = ['social', 'partner'].includes(type) ? type : 'youtube';
  if (safeType === 'partner') {
    return `
      <article class="task-editor-row" data-task-row="partner">
        <input data-task-field="title" aria-label="Titulo de la tarea partner" title="Titulo: texto que vera el usuario." placeholder="Titulo" value="${escapeAttr(task.title || 'Complete partner task')}" />
        <input data-task-field="url" aria-label="URL tracking partner" title="URL: tracking link de GemiAd/GemiWall. Puede incluir {USER_ID}." placeholder="Tracking URL" value="${escapeAttr(task.url || '')}" />
        <select data-task-field="required" aria-label="Tarea requerida u opcional" title="Requerida: debe completarse por postback para desbloquear ticket diario.">
          <option value="true" ${task.required === false ? '' : 'selected'}>Requerida</option>
          <option value="false" ${task.required === false ? 'selected' : ''}>Opcional</option>
        </select>
        <select data-task-field="active" aria-label="Estado partner" title="Activo: se muestra a los usuarios. Pausado: queda guardado pero no aparece.">
          <option value="true" ${task.active === false ? '' : 'selected'}>Activo</option>
          <option value="false" ${task.active === false ? 'selected' : ''}>Pausado</option>
        </select>
        <input data-task-field="validation_key" aria-label="Sub ID 2" title="Debe coincidir con sub2 del tracking link y del postback." placeholder="sub2 / clave" value="${escapeAttr(task.validation_key || task.sub2 || 'partner_task')}" />
        <input data-task-field="offer_id" aria-label="Offer ID" title="Opcional: exige que el postback tenga este offerId." placeholder="Offer ID opcional" value="${escapeAttr(task.offer_id || '')}" />
        <input data-task-field="event_match" aria-label="Evento esperado" title="Opcional: exige Event ID o nombre, por ejemplo Reach Step 10." placeholder="Evento esperado" value="${escapeAttr(task.event_match || '')}" />
        <button class="danger-button compact-button" type="button" data-remove-task><iconify-icon icon="ph:trash-bold"></iconify-icon></button>
      </article>
    `;
  }
  if (safeType === 'social') {
    return `
      <article class="task-editor-row" data-task-row="social">
        <select data-task-field="platform" aria-label="Red social" title="Red social: Instagram, TikTok, Telegram o YouTube.">
          ${['instagram', 'tiktok', 'telegram', 'youtube'].map((platform) => `<option value="${platform}" ${task.platform === platform ? 'selected' : ''}>${platform}</option>`).join('')}
        </select>
        <input data-task-field="title" aria-label="Titulo de la tarea social" title="Titulo: texto que vera el usuario." placeholder="Titulo" value="${escapeAttr(task.title || 'Seguir cuenta')}" />
        <input data-task-field="url" aria-label="URL de cuenta o canal" title="URL: enlace de la cuenta, grupo, canal o perfil." placeholder="URL cuenta/canal" value="${escapeAttr(task.url || '')}" />
        <select data-task-field="required" aria-label="Tarea requerida u opcional" title="Requerida: debe completarse para desbloquear el tap. Opcional: solo da premio.">
          <option value="true" ${task.required === false ? '' : 'selected'}>Requerida</option>
          <option value="false" ${task.required === false ? 'selected' : ''}>Opcional</option>
        </select>
        <input data-task-field="wait_seconds" type="number" min="0" step="1" aria-label="Segundos minimos fuera de FoxPay" title="Espera: segundos minimos que debe permanecer fuera antes de volver a validar." placeholder="Espera seg." value="${escapeAttr(task.wait_seconds ?? 15)}" />
        <button class="danger-button compact-button" type="button" data-remove-task><iconify-icon icon="ph:trash-bold"></iconify-icon></button>
      </article>
    `;
  }
  return `
    <article class="task-editor-row" data-task-row="youtube">
      <input data-task-field="title" aria-label="Titulo del video" title="Titulo: texto que vera el usuario, por ejemplo Ver video 1." placeholder="Titulo" value="${escapeAttr(task.title || 'Ver video')}" />
      <input data-task-field="url" aria-label="URL de YouTube" title="URL: enlace del video de YouTube. Se abre fuera de la app." placeholder="URL de YouTube" value="${escapeAttr(task.url || '')}" />
      <select data-task-field="language" aria-label="Idioma del video" title="Idioma: el usuario vera videos segun su idioma. Todos sirve como respaldo.">
        ${[
          ['all', 'Todos'],
          ['es', 'Espanol'],
          ['en', 'Ingles'],
          ['pt', 'Portugues'],
        ].map(([value, label]) => `<option value="${value}" ${(task.language || 'all') === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <select data-task-field="active" aria-label="Estado del video" title="Activo: entra en la seleccion diaria. Pausado: queda guardado pero no se muestra.">
        <option value="true" ${task.active === false ? '' : 'selected'}>Activo</option>
        <option value="false" ${task.active === false ? 'selected' : ''}>Pausado</option>
      </select>
      <input data-task-field="watch_seconds" type="number" min="10" step="1" aria-label="Segundos minimos de visualizacion" title="Ver seg.: tiempo minimo que debe pasar antes de volver a validar." placeholder="Ver seg." value="${escapeAttr(task.watch_seconds ?? 30)}" />
      <input data-task-field="reward_delay_seconds" type="number" min="0" step="1" aria-label="Segundos de espera para validacion" title="Validacion seg.: espera adicional antes de marcar el check." placeholder="Validacion seg." value="${escapeAttr(task.reward_delay_seconds ?? 30)}" />
      <button class="danger-button compact-button" type="button" data-remove-task><iconify-icon icon="ph:trash-bold"></iconify-icon></button>
    </article>
  `;
}

function addTaskRow(type = 'youtube', task = {}) {
  $('#packageTaskList').insertAdjacentHTML('beforeend', taskRowMarkup(task, type));
}

function renderPackageTasks(taskConfig = {}) {
  $('#packageTaskList').innerHTML = '';
  (taskConfig.videos || []).forEach((task) => addTaskRow('youtube', task));
  (taskConfig.socials || []).forEach((task) => addTaskRow('social', task));
  (taskConfig.partners || []).forEach((task) => addTaskRow('partner', task));
}

function readTaskField(row, field) {
  return row.querySelector(`[data-task-field="${field}"]`)?.value?.trim() || '';
}

function parsePackageTaskConfig() {
  const videos = [];
  const socials = [];
  const partners = [];
  $$('#packageTaskList [data-task-row]').forEach((row, index) => {
    if (row.dataset.taskRow === 'partner') {
      partners.push({
        provider: 'gemiad',
        title: readTaskField(row, 'title') || 'Complete partner task',
        url: readTaskField(row, 'url'),
        required: readTaskField(row, 'required') !== 'false',
        active: readTaskField(row, 'active') !== 'false',
        validation_key: readTaskField(row, 'validation_key') || 'partner_task',
        offer_id: readTaskField(row, 'offer_id'),
        event_match: readTaskField(row, 'event_match'),
        reward_tokens: 0,
      });
      return;
    }
    if (row.dataset.taskRow === 'social') {
      socials.push({
        platform: readTaskField(row, 'platform') || 'youtube',
        title: readTaskField(row, 'title') || 'Seguir cuenta',
        url: readTaskField(row, 'url'),
        required: readTaskField(row, 'required') !== 'false',
        wait_seconds: Number(readTaskField(row, 'wait_seconds') || 15),
        reward_delay_seconds: 0,
        reward_tokens: 0,
      });
      return;
    }
    videos.push({
      title: readTaskField(row, 'title') || `Ver video ${index + 1}`,
      url: readTaskField(row, 'url'),
      language: readTaskField(row, 'language') || 'all',
      active: readTaskField(row, 'active') !== 'false',
      watch_seconds: Number(readTaskField(row, 'watch_seconds') || 30),
      reward_delay_seconds: Number(readTaskField(row, 'reward_delay_seconds') || 30),
      reward_tokens: 0,
    });
  });
  const form = $('#packageForm');
  return {
    daily_video_min: Number(form.elements.dailyVideoMin?.value || 0),
    daily_video_max: Number(form.elements.dailyVideoMax?.value || 0),
    partners,
    referral_task: {
      enabled: form.elements.referralTaskEnabled?.value !== 'false',
      required: form.elements.referralTaskRequired?.value !== 'false',
      probability: Number(form.elements.referralTaskProbability?.value || 0),
      first_target: Number(form.elements.referralTaskFirstTarget?.value || 3),
      repeat_target: Number(form.elements.referralTaskRepeatTarget?.value || 1),
      cooldown_days: Number(form.elements.referralTaskCooldown?.value || 0),
      validation: form.elements.referralTaskValidation?.value || 'created',
    },
    videos,
    socials,
  };
}

function openPackageModal(pack = {}) {
  const form = $('#packageForm');
  const fields = form.elements;
  form.reset();
  fields.id.value = pack.id || '';
  fields.name.value = pack.name || '';
  fields.iconUrl.value = pack.icon_url || '';
  renderPackageImagePreview(packageIconSrc(pack), !pack.icon_url);
  fields.priceUsd.value = pack.price_usdt || 0;
  fields.tokens.value = pack.tap_reward_tokens || 1;
  fields.freeCapUsd.value = pack.monthly_cap_usd || 0;
  fields.dailyEnergy.value = pack.daily_energy || 0;
  fields.description.value = pack.description || '';
  renderPackageTasks(pack.task_config || {});
  fields.dailyVideoMin.value = Number(pack.task_config?.daily_video_min || 0);
  fields.dailyVideoMax.value = Number(pack.task_config?.daily_video_max || 0);
  const referralTask = pack.task_config?.referral_task || {};
  fields.referralTaskEnabled.value = referralTask.enabled === false ? 'false' : 'true';
  fields.referralTaskRequired.value = referralTask.required === false ? 'false' : 'true';
  fields.referralTaskProbability.value = Number(referralTask.probability ?? 0);
  fields.referralTaskFirstTarget.value = Number(referralTask.first_target ?? 3);
  fields.referralTaskRepeatTarget.value = Number(referralTask.repeat_target ?? 1);
  fields.referralTaskCooldown.value = Number(referralTask.cooldown_days ?? 0);
  fields.referralTaskValidation.value = referralTask.validation === 'registered' ? 'registered' : 'created';
  fields.bonusPercent.value = Number(pack.price_usdt || 0) > 0 ? '300% automatico' : 'Editable en Cap free';
  fields.freeCapUsd.disabled = Number(pack.price_usdt || 0) > 0;
  fields.status.value = pack.active === false ? 'paused' : 'active';
  $('#packageModal').showModal();
}

function renderPackageImagePreview(src = '', isDefault = false) {
  $('#packageImagePreview').innerHTML = src
    ? `<img src="${src}" alt="${isDefault ? 'Imagen predeterminada del paquete' : ''}" />`
    : '<iconify-icon icon="ph:image-square-bold"></iconify-icon>';
}

function resizeImageToWebp(file, size = 192) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      const scale = Math.min(size / image.width, size / image.height);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const x = Math.round((size - width) / 2);
      const y = Math.round((size - height) / 2);
      ctx.drawImage(image, x, y, width, height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL('image/webp', 0.88));
    };
    image.onerror = () => reject(new Error('No se pudo procesar la imagen'));
    image.src = URL.createObjectURL(file);
  });
}

function resizeImageToWebpBox(file, maxWidth = 960, maxHeight = 420, quality = 0.78, onProgress = null) {
  return new Promise((resolve, reject) => {
    const report = (percent, label = '') => {
      if (typeof onProgress === 'function') onProgress(percent, label);
    };
    const image = new Image();
    image.onload = () => {
      report(82, 'Convirtiendo a WebP');
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      report(94, 'Optimizando WebP');
      resolve(canvas.toDataURL('image/webp', quality));
    };
    image.onerror = () => {
      reject(new Error('No se pudo procesar la imagen'));
    };
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) {
        report(35, 'Leyendo imagen');
        return;
      }
      report(Math.min(78, Math.max(1, Math.round((event.loaded / event.total) * 78))), 'Leyendo imagen');
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      report(80, 'Preparando imagen');
      image.src = reader.result;
    };
    report(1, 'Leyendo imagen');
    reader.readAsDataURL(file);
  });
}

function updateSeasonUploadStatus(seasonId, percent = 0, label = 'Lista', state = '') {
  const status = document.querySelector(`[data-season-upload-status="${seasonId}"]`);
  const button = document.querySelector(`[data-season-upload-button="${seasonId}"]`);
  const buttonLabel = document.querySelector(`[data-season-upload-button-label="${seasonId}"]`);
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent || 0))));
  if (status) {
    status.classList.toggle('is-uploading', state === 'uploading');
    status.classList.toggle('is-done', state === 'done');
    status.classList.toggle('is-error', state === 'error');
    status.querySelector('span').textContent = label;
    status.querySelector('strong').textContent = `${safePercent}%`;
    status.querySelector('em').style.width = `${safePercent}%`;
  }
  if (button) {
    button.classList.toggle('is-uploading', state === 'uploading');
    button.classList.toggle('is-done', state === 'done');
    button.classList.toggle('is-error', state === 'error');
  }
  if (buttonLabel) {
    buttonLabel.textContent = state === 'uploading'
      ? `${safePercent}%`
      : state === 'done'
        ? 'Listo'
        : state === 'error'
          ? 'Error'
          : 'Subir';
  }
}

function beginSeasonUploadProgress(seasonId) {
  const current = seasonUploadTimers.get(seasonId);
  if (current) clearInterval(current);
  let percent = 1;
  updateSeasonUploadStatus(seasonId, percent, 'Leyendo imagen', 'uploading');
  const timer = setInterval(() => {
    percent = Math.min(90, percent + (percent < 55 ? 9 : 4));
    updateSeasonUploadStatus(seasonId, percent, percent >= 78 ? 'Convirtiendo a WebP' : 'Leyendo imagen', 'uploading');
    if (percent >= 90) clearInterval(timer);
  }, 140);
  seasonUploadTimers.set(seasonId, timer);
}

function finishSeasonUploadProgress(seasonId, label = 'Completado', state = 'done') {
  const current = seasonUploadTimers.get(seasonId);
  if (current) clearInterval(current);
  seasonUploadTimers.delete(seasonId);
  updateSeasonUploadStatus(seasonId, state === 'done' ? 100 : 0, label, state);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handlePackageImage(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImageToWebp(file);
    $('#packageForm').elements.iconUrl.value = dataUrl;
    renderPackageImagePreview(dataUrl);
  } catch (error) {
    showAlert(error.message);
  }
}

async function handleSeasonImage(event) {
  const input = event.target;
  const file = input.files?.[0];
  const seasonId = input.dataset.seasonId;
  if (!file || !seasonId) return;
  try {
    input.disabled = true;
    beginSeasonUploadProgress(seasonId);
    const dataUrl = await resizeImageToWebpBox(file, 960, 420, 0.78, (percent, label) => {
      updateSeasonUploadStatus(seasonId, percent, label || 'Leyendo imagen', 'uploading');
    });
    updateSeasonUploadStatus(seasonId, 98, 'Actualizando vista previa', 'uploading');
    const field = document.querySelector(`[data-season-field="image_url"][data-season-id="${seasonId}"]`);
    const preview = document.querySelector(`[data-season-image-preview="${seasonId}"]`);
    if (field) field.value = dataUrl;
    if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="" />`;
    await wait(180);
    finishSeasonUploadProgress(seasonId, 'Lista para guardar', 'done');
    const feedback = $('#seasonFeedback');
    if (feedback) {
      feedback.textContent = 'Imagen lista. Presiona Guardar calendario para publicarla en la temporada.';
      feedback.dataset.type = 'success';
    }
  } catch (error) {
    finishSeasonUploadProgress(seasonId, 'Error', 'error');
    showAlert(error.message);
  } finally {
    input.disabled = false;
    input.value = '';
  }
}

function syncPackageCapFields() {
  const form = $('#packageForm');
  if (!form) return;
  const priceUsd = Number(form.elements.priceUsd.value || 0);
  form.elements.freeCapUsd.disabled = priceUsd > 0;
  form.elements.bonusPercent.value = priceUsd > 0 ? '300% automatico' : 'Editable en Cap free';
}

function renderRankImagePreview(src = '') {
  $('#rankImagePreview').innerHTML = src
    ? `<img src="${escapeAttr(src)}" alt="" />`
    : '<iconify-icon icon="ph:medal-bold"></iconify-icon>';
}

function openRankModal(rank = {}) {
  const form = $('#rankForm');
  form.reset();
  const id = rank.id || `rank-${Date.now()}`;
  form.elements.id.value = id;
  form.elements.id.readOnly = Boolean(rank.id);
  form.elements.name.value = rank.name || 'Nuevo rango';
  form.elements.imageUrl.value = rank.image_url || '';
  form.elements.requiredDirects.value = Number(rank.required_directs || 0);
  form.elements.requiredLifetimeUsd.value = Number(rank.required_lifetime_usd || 0);
  form.elements.teamRequirements.value = rankRequirementsText(rank.team_requirements || {});
  form.elements.sortOrder.value = Number(rank.sort_order || 0);
  form.elements.active.value = rank.active === false || rank.active === 'false' ? 'false' : 'true';
  renderRankImagePreview(form.elements.imageUrl.value);
  $('#rankModalTitle').textContent = rank.id ? `Editar ${rank.name}` : 'Nuevo rango';
  $('#rankModal').showModal();
}

async function handleRankImage(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImageToWebp(file);
    $('#rankForm').elements.imageUrl.value = dataUrl;
    renderRankImagePreview(dataUrl);
  } catch (error) {
    showAlert(error.message);
  } finally {
    event.currentTarget.value = '';
  }
}

async function saveRank(event) {
  event.preventDefault();
  const button = $('#rankSaveButton');
  const fields = event.currentTarget.elements;
  button.disabled = true;
  button.textContent = 'Guardando...';
  try {
    await api('/rank', {
      id: fields.id.value.trim(),
      name: fields.name.value.trim(),
      image_url: fields.imageUrl.value,
      required_directs: fields.requiredDirects.value || 0,
      required_lifetime_usd: fields.requiredLifetimeUsd.value || 0,
      team_requirements: JSON.stringify(parseRankRequirements(fields.teamRequirements.value)),
      sort_order: fields.sortOrder.value || 0,
      active: fields.active.value === 'true',
    });
    $('#rankModal').close();
    await loadData();
    showAlert('Rango guardado.', 'success');
  } catch (error) {
    showAlert(`No se pudo guardar rango: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar rango';
  }
}

function openAvatarModal(avatar = {}) {
  const form = $('#avatarForm');
  form.reset();
  form.elements.id.value = avatar.id || `avatar-${Date.now()}`;
  form.elements.name.value = avatar.name || 'Nuevo avatar';
  form.elements.imageUrl.value = avatar.image_url || './images/fox.png';
  form.elements.priceTokens.value = avatar.price_tokens || 0;
  form.elements.priceUsdt.value = avatar.price_usdt || 0;
  form.elements.isFree.value = isEnabled(avatar.is_free) ? 'true' : 'false';
  form.elements.active.value = avatar.active === false || avatar.active === 'false' ? 'false' : 'true';
  syncAvatarPrice('tokens');
  $('#avatarImagePreview').innerHTML = `<img src="${form.elements.imageUrl.value}" alt="" />`;
  $('#avatarModal').showModal();
}

async function handleAvatarImage(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImageToWebp(file);
    $('#avatarForm').elements.imageUrl.value = dataUrl;
    $('#avatarImagePreview').innerHTML = `<img src="${dataUrl}" alt="" />`;
  } catch (error) {
    showAlert(error.message);
  }
}

async function saveAvatar(event) {
  event.preventDefault();
  const button = $('#avatarSaveButton');
  const fields = event.currentTarget.elements;
  button.disabled = true;
  button.classList.add('is-saving');
  button.textContent = 'Guardando...';
  try {
    await api('/avatar', {
      id: fields.id.value.trim(),
      name: fields.name.value.trim(),
      image_url: fields.imageUrl.value,
      price_tokens: fields.priceTokens.value || 0,
      price_usdt: fields.priceUsdt.value || 0,
      is_free: fields.isFree.value === 'true',
      active: fields.active.value === 'true',
    });
    $('#avatarModal').close();
    await loadData();
    showAlert('Avatar guardado. Si es de pago, los usuarios deberan pagar con NOWPayments.', 'success');
  } catch (error) {
    showAlert(`No se pudo guardar avatar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
    button.textContent = 'Guardar avatar';
  }
}

function renderSkinPackageChecks(selectedIds = []) {
  const selected = new Set(selectedIds || []);
  $('#skinPackageList').innerHTML = `
    <strong>Packs donde puede salir en ruleta</strong>
    <div class="skin-pack-options">
      ${(state.overview.packages || []).map((pack) => `
        <label class="toggle-row">
          <input type="checkbox" value="${pack.id}" ${selected.has(pack.id) ? 'checked' : ''} />
          <span>${pack.name}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function openSkinModal(skin = {}) {
  const form = $('#skinForm');
  form.reset();
  form.elements.id.value = skin.id || `skin-${Date.now()}`;
  form.elements.name.value = skin.name || 'New Skin';
  form.elements.imageUrl.value = skin.image_url || './images/skin/optimized/skinbasic_03.webp';
  form.elements.priceUsdt.value = skin.price_usdt || 0;
  syncSkinPrice('usdt');
  form.elements.tapBonus.value = skin.tap_bonus_per_day || 0;
  form.elements.sortOrder.value = skin.sort_order || 0;
  form.elements.active.value = skin.active === false || skin.active === 'false' ? 'false' : 'true';
  renderSkinPackageChecks(skin.roulette_package_ids || []);
  $('#skinImagePreview').innerHTML = `<img src="${form.elements.imageUrl.value}" alt="" />`;
  $('#skinModal').showModal();
}

async function saveSkin(event) {
  event.preventDefault();
  const button = $('#skinSaveButton');
  const fields = event.currentTarget.elements;
  const packageIds = $$('#skinPackageList input[type="checkbox"]:checked').map((input) => input.value);
  syncSkinPrice(skinPriceSource);
  button.disabled = true;
  button.textContent = 'Guardando...';
  try {
    await api('/skin', {
      id: fields.id.value.trim(),
      name: fields.name.value.trim(),
      image_url: fields.imageUrl.value.trim(),
      price_usdt: fields.priceUsdt.value || 0,
      tap_bonus_per_day: fields.tapBonus.value || 0,
      roulette_package_ids: packageIds,
      sort_order: fields.sortOrder.value || 0,
      active: fields.active.value === 'true',
    });
    $('#skinModal').close();
    await loadData();
    showAlert('Skin guardada.', 'success');
  } catch (error) {
    showAlert(`No se pudo guardar skin: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar skin';
  }
}

async function removeSkin(skinId) {
  const skin = (state.overview.skins || []).find((item) => item.id === skinId);
  const label = skin?.name || skinId;
  if (!confirm(`Ocultar y remover skin "${label}"?\n\nSe marcara inactiva, se quitara de inventarios y skins activas de usuarios, y dejara de salir en ruleta. El historial de pagos no se borra.`)) {
    return;
  }
  try {
    const result = await api('/skin/remove', { id: skinId });
    await loadData();
    showAlert(`Skin ocultada. Usuarios actualizados: ${fmt(result.players_updated, 0)}. Premios desactivados: ${fmt(result.roulette_rewards_disabled, 0)}.`, 'success');
  } catch (error) {
    showAlert(`No se pudo remover skin: ${error.message}`);
  }
}

function openRouletteRewardModal(reward = {}) {
  const form = $('#rouletteRewardForm');
  form.reset();
  form.elements.id.value = reward.id || '';
  form.elements.packageId.innerHTML = (state.overview.packages || []).map((pack) => `<option value="${pack.id}" ${reward.package_id === pack.id ? 'selected' : ''}>${pack.name}</option>`).join('');
  form.elements.packageId.value = reward.package_id || $('#rouletteSettingForm')?.elements.packageId.value || state.overview.packages?.[0]?.id || 'free';
  form.elements.rewardType.value = reward.reward_type || 'tokens';
  form.elements.label.value = reward.label || '5 FOX';
  form.elements.amount.value = reward.amount || 0;
  rouletteAmountSource = 'fox';
  syncRouletteAmount('fox');
  form.elements.itemId.value = reward.item_id || '';
  form.elements.weight.value = reward.weight ?? 1;
  form.elements.sortOrder.value = reward.sort_order || 0;
  form.elements.active.value = reward.active === false || reward.active === 'false' ? 'false' : 'true';
  renderRouletteItemPicker();
  if (!reward.id) syncRouletteLabelFromItem();
  $('#rouletteRewardModal').showModal();
}

async function saveRouletteSetting(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  try {
    await api('/roulette/setting', {
      package_id: fields.packageId.value,
      ticket_cost: fields.ticketCost.value || 1,
    });
    await loadData();
    showAlert('Costo de ruleta guardado.', 'success');
  } catch (error) {
    showAlert(`No se pudo guardar costo: ${error.message}`);
  }
}

async function saveRouletteReward(event) {
  event.preventDefault();
  const button = $('#rouletteRewardSaveButton');
  const fields = event.currentTarget.elements;
  syncRouletteAmount(rouletteAmountSource);
  button.disabled = true;
  button.textContent = 'Guardando...';
  try {
    await api('/roulette/reward', {
      id: fields.id.value,
      package_id: fields.packageId.value,
      label: fields.label.value,
      reward_type: fields.rewardType.value,
      amount: ['tokens', 'tickets'].includes(fields.rewardType.value) ? (fields.amount.value || 0) : 0,
      item_id: fields.itemId.value,
      weight: fields.weight.value || 1,
      sort_order: fields.sortOrder.value || 0,
      active: fields.active.value === 'true',
    });
    $('#rouletteRewardModal').close();
    await loadData();
    showAlert('Premio de ruleta guardado.', 'success');
  } catch (error) {
    showAlert(`No se pudo guardar premio: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar premio';
  }
}

async function savePackage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;
  const id = fields.id.value;
  const priceUsd = Number(fields.priceUsd.value || 0);
  try {
    await api('/package', {
      id,
      name: fields.name.value,
      price_usdt: fields.priceUsd.value,
      tap_reward_tokens: fields.tokens.value,
      monthly_cap_usd: priceUsd > 0 ? priceUsd * 3 : (fields.freeCapUsd.value || 3),
      daily_energy: fields.dailyEnergy.value || 500,
      max_multiplier: 3,
      icon_url: fields.iconUrl.value,
      video_urls: '',
      task_config: JSON.stringify(parsePackageTaskConfig()),
      active: fields.status.value === 'active',
    });
    $('#packageModal').close();
    await loadData();
  } catch (error) {
    showAlert(`No se pudo guardar paquete: ${error.message}`);
  }
}

async function saveTokenPrice(event) {
  event.preventDefault();
  try {
    await api('/settings', {
      token_price_usd: event.currentTarget.elements.priceUsd.value,
      referral_rate: state.overview.settings.referral_rate,
    });
    await loadData();
  } catch (error) {
    showAlert(`No se pudo guardar precio: ${error.message}`);
  }
}

async function saveWithdrawalSettings(event) {
  event.preventDefault();
  const button = $('#withdrawalSettingsButton');
  const feedback = $('#withdrawalSettingsFeedback');
  button.disabled = true;
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/settings', {
      token_price_usd: state.overview.settings.token_price_usd,
      referral_rate: state.overview.settings.referral_rate,
      block_same_ip: state.overview.settings.block_same_ip,
      block_same_device: state.overview.settings.block_same_device,
      withdrawal_min_usdt: event.currentTarget.elements.minUsdt.value,
    });
    state.overview.settings = result.settings;
    renderMetrics();
    feedback.textContent = 'Minimo guardado.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar minimo';
  }
}

async function saveSecuritySettings(event) {
  event.preventDefault();
  const button = $('#securitySaveButton');
  const feedback = $('#securityFeedback');
  button.disabled = true;
  button.classList.add('is-saving');
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/settings', {
      token_price_usd: state.overview.settings.token_price_usd,
      referral_rate: state.overview.settings.referral_rate,
      block_same_ip: event.currentTarget.elements.blockSameIp.checked,
      block_same_device: event.currentTarget.elements.blockSameDevice.checked,
      daily_cycle_minutes: event.currentTarget.elements.dailyCycleMinutes.value || 1440,
    });
    state.overview.settings = result.settings;
    renderMetrics();
    feedback.textContent = 'Seguridad guardada.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
    button.textContent = 'Guardar seguridad';
  }
}

async function saveSeasonSettings(event) {
  event.preventDefault();
  const button = $('#seasonSaveButton');
  const feedback = $('#seasonFeedback');
  button.disabled = true;
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const fields = event.currentTarget.elements;
    const result = await api('/settings', {
      token_price_usd: state.overview.settings.token_price_usd,
      referral_rate: state.overview.settings.referral_rate,
      block_same_ip: state.overview.settings.block_same_ip,
      block_same_device: state.overview.settings.block_same_device,
      season_name: fields.seasonName.value,
      season_start_at: fromDateTimeLocal(fields.seasonStart.value),
      season_end_at: fromDateTimeLocal(fields.seasonEnd.value),
      season_winner_limit: fields.winnerLimit.value || 20,
      season_reward_tokens: fields.rewardTokens.value || 0,
      season_reward_mode: fields.rewardMode.value || 'competitive',
    });
    state.overview.settings = result.settings;
    renderMetrics();
    renderSeasonPanel();
    feedback.textContent = 'Temporada guardada.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar temporada';
  }
}

async function saveSeasonSchedule() {
  const button = $('#seasonScheduleSaveButton');
  const feedback = $('#seasonFeedback');
  button.disabled = true;
  button.textContent = 'Guardando calendario...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/settings', {
      token_price_usd: state.overview.settings.token_price_usd,
      referral_rate: state.overview.settings.referral_rate,
      block_same_ip: state.overview.settings.block_same_ip,
      block_same_device: state.overview.settings.block_same_device,
      season_schedule: JSON.stringify(collectSeasonSchedule()),
    });
    state.overview.settings = result.settings;
    renderMetrics();
    renderSeasonPanel();
    feedback.textContent = 'Calendario de temporadas guardado.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar calendario: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar calendario';
  }
}

async function saveUnilevelSettings(event) {
  event.preventDefault();
  const button = $('#unilevelSaveButton');
  const feedback = $('#unilevelFeedback');
  if (!state.overview?.settings) {
    feedback.textContent = 'Primero inicia sesion y carga los datos desde Postgres.';
    feedback.dataset.type = 'error';
    showLogin();
    return;
  }
  button.disabled = true;
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  try {
    const result = await api('/settings', {
      token_price_usd: state.overview.settings.token_price_usd,
      referral_rate: state.overview.settings.referral_rate,
      block_same_ip: state.overview.settings.block_same_ip,
      block_same_device: state.overview.settings.block_same_device,
      withdrawal_min_usdt: state.overview.settings.withdrawal_min_usdt,
      unilevel_config: JSON.stringify(collectUnilevelConfig()),
    });
    state.overview.settings = result.settings;
    renderUnilevelConfig();
    feedback.textContent = 'Unilevel guardado.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar unilevel';
  }
}

async function saveReferralTicketRewards(event) {
  event.preventDefault();
  const button = $('#referralTicketRewardsButton');
  const feedback = $('#referralTicketRewardsFeedback');
  const rewards = {};
  $$('[data-referral-ticket-pack]').forEach((input) => {
    rewards[input.dataset.referralTicketPack] = Math.max(0, Math.min(999, Math.floor(Number(input.value || 0))));
  });
  button.disabled = true;
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/settings', {
      token_price_usd: state.overview.settings.token_price_usd,
      referral_rate: state.overview.settings.referral_rate,
      block_same_ip: state.overview.settings.block_same_ip,
      block_same_device: state.overview.settings.block_same_device,
      withdrawal_min_usdt: state.overview.settings.withdrawal_min_usdt,
      referral_ticket_rewards: JSON.stringify(rewards),
    });
    state.overview.settings = result.settings;
    renderReferralTicketRewards();
    feedback.textContent = 'Tickets por referido guardados.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    const currentButton = $('#referralTicketRewardsButton');
    if (currentButton) {
      currentButton.disabled = false;
      currentButton.textContent = 'Guardar tickets';
    }
  }
}

async function saveHotWalletSettings(event) {
  event.preventDefault();
  const button = $('#hotWalletSaveButton');
  const feedback = $('#hotWalletFeedback');
  const fields = event.currentTarget.elements;
  button.disabled = true;
  button.classList.add('is-saving');
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/settings', {
      hot_wallet_network: fields.network.value,
      hot_wallet_address: fields.address.value.trim(),
      hot_wallet_note: fields.note.value.trim(),
      admin_password: fields.adminPassword.value,
    });
    state.overview.settings = result.settings;
    renderHotWalletSettings();
    feedback.textContent = 'Hot wallet guardada.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
    button.innerHTML = '<iconify-icon icon="ph:floppy-disk-bold"></iconify-icon> Guardar hot wallet';
  }
}

async function saveAdminUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#adminUserSaveButton');
  const feedback = $('#adminUserFeedback');
  const fields = form.elements;
  button.disabled = true;
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/admins', {
      username: fields.username.value.trim(),
      password: fields.password.value,
      active: fields.active.value,
      approved: fields.approved?.value || 'false',
      can_edit: fields.canEdit?.value || 'false',
      push_enabled: fields.pushEnabled?.value || 'true',
    });
    state.admins = result.admins || [];
    renderAdminUsers();
    form.reset();
    feedback.textContent = 'Admin guardado.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo guardar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar admin';
  }
}

async function deleteAdmin(username) {
  if (!username) return;
  if (username === state.admin?.username) {
    showAlert('No puedes eliminar tu propio usuario admin activo.', 'warn');
    return;
  }
  if (!confirm(`Eliminar admin ${username}?`)) return;
  try {
    const result = await api('/admins', { action: 'delete', username });
    state.admins = result.admins || [];
    renderAdminUsers();
    showAlert(`Admin eliminado: ${username}`, 'success');
  } catch (error) {
    showAlert(`No se pudo eliminar admin: ${error.message}`);
  }
}

async function replySupportTicket(ticketId) {
  const message = $('#supportReplyText')?.value || '';
  try {
    const result = await api('/support/reply', { ticket_id: ticketId, message });
    state.overview.support_tickets = result.support_tickets || [];
    renderSupportTickets();
    showAlert('Respuesta enviada.', 'success');
  } catch (error) {
    showAlert(`No se pudo responder soporte: ${error.message}`);
  }
}

async function closeSupportTicket(ticketId) {
  try {
    const result = await api('/support/status', { ticket_id: ticketId, status: 'closed' });
    state.overview.support_tickets = result.support_tickets || [];
    renderSupportTickets();
    showAlert('Ticket cerrado.', 'success');
  } catch (error) {
    showAlert(`No se pudo cerrar ticket: ${error.message}`);
  }
}

async function changeAdminPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#adminPasswordSaveButton');
  const feedback = $('#adminPasswordFeedback');
  const fields = form.elements;
  button.disabled = true;
  button.textContent = 'Guardando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/password', {
      current_password: fields.currentPassword.value,
      new_password: fields.newPassword.value,
    });
    if (result.source === 'db_override' && state.admin) state.admin.source = 'db';
    form.reset();
    feedback.textContent = 'Contrasena actualizada.';
    feedback.dataset.type = 'success';
  } catch (error) {
    feedback.textContent = `No se pudo cambiar: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.textContent = 'Cambiar contrasena';
  }
}

async function paySeasonRewards() {
  const button = $('#seasonPayButton');
  const feedback = $('#seasonFeedback');
  if (!confirm('Pagar la recompensa FOX a los ganadores actuales? Esta accion no se puede repetir para la misma temporada.')) {
    return;
  }
  button.disabled = true;
  button.textContent = 'Pagando...';
  feedback.textContent = '';
  feedback.dataset.type = '';
  try {
    const result = await api('/season/reward', {});
    state.overview.settings = result.settings;
    feedback.textContent = `Recompensa pagada a ${result.winners.length} ganadores.`;
    feedback.dataset.type = 'success';
    await loadData();
  } catch (error) {
    feedback.textContent = `No se pudo pagar: ${error.message}`;
    feedback.dataset.type = 'error';
    renderSeasonPanel();
  }
}

async function reviewPurchase(id, action) {
  await api('/purchase', { id, action });
  await loadData();
}

async function reviewWithdrawal(id, action) {
  try {
    let tx_hash = '';
    let network = '';
    if (action === 'approve') {
      const item = state.overview.withdrawals.find((row) => row.id === id);
      network = item?.network || 'bep20';
      const example = network === 'tron'
        ? 'Ej: hash de 64 caracteres o https://tronscan.org/#/transaction/...'
        : `Ej: 0x..., ${network === 'polygon' ? 'https://polygonscan.com/tx/0x...' : 'https://bscscan.com/tx/0x...'} o "Transferencia fuera de la cadena 377243486801"`;
      tx_hash = prompt(`Hash, URL o ID de transaccion (${network})\n${example}`) || '';
      if (!tx_hash) return;
    }
    await api('/withdrawal', { id, action, tx_hash, network });
    showAlert(action === 'approve' ? 'Retiro aprobado y hash guardado.' : 'Retiro rechazado.', 'success');
    await loadData();
  } catch (error) {
    showAlert(`No se pudo revisar el retiro: ${error.message}`, 'warn');
  }
}

async function deleteUser(playerId) {
  const user = state.overview.players.find((item) => item.player_id === playerId);
  const label = user?.username || playerId;
  if (!confirm(`Eliminar usuario ${label}? Esta accion borra su cuenta, compras y retiros.`)) {
    return;
  }
  try {
    await api('/user/delete', { player_id: playerId });
    showAlert(`Usuario eliminado: ${label}`, 'success');
    await loadData();
  } catch (error) {
    showAlert(`No se pudo eliminar usuario: ${error.message}`);
  }
}

async function updateUserStatus(playerId, status) {
  const user = state.overview.players.find((item) => item.player_id === playerId);
  const label = user?.username || playerId;
  const disabling = status === 'disabled';
  const message = disabling
    ? `Desactivar usuario ${label}? No podra ingresar, cobrar ni generar comisiones, pero su red se mantiene.`
    : `Reactivar usuario ${label}? Recuperara acceso normal.`;
  if (!confirm(message)) return;
  try {
    await api('/user/status', { player_id: playerId, status });
    showAlert(disabling ? `Usuario desactivado: ${label}` : `Usuario reactivado: ${label}`, 'success');
    await loadData();
  } catch (error) {
    showAlert(`No se pudo actualizar usuario: ${error.message}`);
  }
}

async function resetOperationalData(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#maintenanceResetButton');
  const feedback = $('#maintenanceResetFeedback');
  const confirmation = form.elements.confirmation.value.trim();
  feedback.textContent = '';
  feedback.dataset.type = '';
  if (confirmation !== 'RESET FOXPAY') {
    feedback.textContent = 'Debes escribir RESET FOXPAY exactamente.';
    feedback.dataset.type = 'error';
    return;
  }
  if (!confirm('Esta accion borrara usuarios, pagos, compras, retiros y comisiones. No borra admins ni configuracion. Continuar?')) {
    return;
  }
  button.disabled = true;
  button.textContent = 'Ejecutando...';
  try {
    const result = await api('/maintenance/reset', { confirmation });
    const deleted = result.deleted || {};
    feedback.textContent = `Reset completado: ${fmt(deleted.players, 0)} usuarios, ${fmt(deleted.payments, 0)} pagos, ${fmt(deleted.purchases, 0)} compras, ${fmt(deleted.withdrawals, 0)} retiros, ${fmt(deleted.commissions, 0)} comisiones, ${fmt(deleted.roulette_spins, 0)} giros.`;
    feedback.dataset.type = 'success';
    form.reset();
    await loadData();
  } catch (error) {
    feedback.textContent = `No se pudo ejecutar reset: ${error.message}`;
    feedback.dataset.type = 'error';
  } finally {
    button.disabled = false;
    button.innerHTML = '<iconify-icon icon="ph:trash-bold"></iconify-icon> Ejecutar reset operativo';
  }
}

async function loginWithLocalAdminKey(key = 'dev-admin') {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ admin_key: key }),
  });
  const data = await readApiJson(response);
  if (!response.ok || data.ok === false) throw new Error(data.message || data.error || 'invalid_admin_login');
  state.authToken = data.token || '';
  state.authKey = '';
  state.admin = data.admin || null;
  state.admins = [];
  state.overview = null;
  state.activePanel = 'overview';
  saveAdminSession();
  showDashboard();
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert();
  try {
    const localAdminKey = $('#localAdminKey')?.value.trim() || '';
    if (localAdminKey) {
      await loginWithLocalAdminKey(localAdminKey);
      return;
    }
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: $('#adminUsername').value.trim(),
        password: $('#adminPassword').value,
        admin_key: localAdminKey,
      }),
    });
    const data = await readApiJson(response);
    if (!response.ok || data.ok === false) throw new Error(data.message || data.error || 'invalid_admin_login');
    state.authToken = data.token || '';
    state.authKey = '';
    state.admin = data.admin || null;
    state.activePanel = 'overview';
    saveAdminSession();
    showDashboard();
  } catch (error) {
    showAlert(`No se pudo iniciar sesion: ${error.message}`, 'warn');
  }
});

if (isLocalAdminHost()) {
  $('#localAdminKeyBlock')?.classList.remove('is-hidden');
}

$('#toggleSecret').addEventListener('click', () => {
  $('#adminPassword').type = $('#adminPassword').type === 'password' ? 'text' : 'password';
});

$('#logoutButton').addEventListener('click', () => {
  void unregisterAdminPushSubscription();
  state.authKey = '';
  state.authToken = '';
  state.admin = null;
  state.admins = [];
  state.overview = null;
  state.push.subscriptionId = '';
  clearAdminSession();
  showLogin();
});

$('#refreshButton').addEventListener('click', loadData);
$('#adminPushButton').addEventListener('click', () => {
  void ensureAdminPushNotifications(true);
});
$('#adminPushTestButton').addEventListener('click', sendAdminPushTest);
$('#adminPushRefreshButton').addEventListener('click', loadAdminPushDiagnostics);
$('#tokenPriceForm').addEventListener('submit', saveTokenPrice);
$('#withdrawalSettingsForm').addEventListener('submit', saveWithdrawalSettings);
$('#securityForm').addEventListener('submit', saveSecuritySettings);
$('#seasonForm').addEventListener('submit', saveSeasonSettings);
$('#seasonScheduleSaveButton').addEventListener('click', saveSeasonSchedule);
$('#unilevelForm').addEventListener('submit', saveUnilevelSettings);
$('#hotWalletForm').addEventListener('submit', saveHotWalletSettings);
$('#adminUserForm').addEventListener('submit', saveAdminUser);
$('#adminPasswordForm').addEventListener('submit', changeAdminPassword);
$('#maintenanceResetForm').addEventListener('submit', resetOperationalData);
$('#manualPurchaseForm').addEventListener('submit', saveManualPurchase);
$('#seasonPayButton').addEventListener('click', paySeasonRewards);
$('#packageForm').addEventListener('submit', savePackage);
$('#packageForm').elements.priceUsd.addEventListener('input', syncPackageCapFields);
$('#rankForm').addEventListener('submit', saveRank);
$('#avatarForm').addEventListener('submit', saveAvatar);
$('#skinForm').addEventListener('submit', saveSkin);
$('#rouletteRewardForm').addEventListener('submit', saveRouletteReward);
$('#rouletteSettingForm').addEventListener('submit', saveRouletteSetting);
$('#referralTicketRewardsForm').addEventListener('submit', saveReferralTicketRewards);
$('#packageForm').elements.iconFile.addEventListener('change', handlePackageImage);
$('#rankForm').elements.imageFile.addEventListener('change', handleRankImage);
$('#avatarForm').elements.imageFile.addEventListener('change', handleAvatarImage);
$('#avatarForm').elements.priceTokens.addEventListener('input', () => syncAvatarPrice('tokens'));
$('#avatarForm').elements.priceUsdt.addEventListener('input', () => syncAvatarPrice('usdt'));
$('#skinForm').elements.priceFox.addEventListener('input', () => syncSkinPrice('fox'));
$('#skinForm').elements.priceUsdt.addEventListener('input', () => syncSkinPrice('usdt'));
$('#skinForm').elements.imageUrl.addEventListener('input', (event) => {
  $('#skinImagePreview').innerHTML = event.currentTarget.value
    ? `<img src="${escapeAttr(event.currentTarget.value)}" alt="" />`
    : '<iconify-icon icon="ph:sparkle-bold"></iconify-icon>';
});
$('#rouletteRewardForm').elements.rewardType.addEventListener('change', () => {
  $('#rouletteRewardForm').elements.itemId.value = '';
  renderRouletteItemPicker();
  syncRouletteAmount('fox');
  syncRouletteLabelFromItem(true);
});
$('#rouletteRewardForm').elements.amount.addEventListener('input', () => syncRouletteAmount('fox'));
$('#rouletteRewardForm').elements.amountUsdt.addEventListener('input', () => syncRouletteAmount('usdt'));
$('#addPackageTask').addEventListener('click', () => addTaskRow($('#taskAddType').value));
$('#openTaskHelp').addEventListener('click', () => $('#taskHelpModal').showModal());
$('#clearPackageImage').addEventListener('click', () => {
  $('#packageForm').elements.iconUrl.value = '__remove__';
  renderPackageImagePreview('');
});
$('#clearRankImage').addEventListener('click', () => {
  $('#rankForm').elements.imageUrl.value = '__remove__';
  renderRankImagePreview('');
});
$('#sidebarMenuButton')?.addEventListener('click', openSidebar);
$('#sidebarCloseButton')?.addEventListener('click', closeSidebar);
$('#sidebarBackdrop')?.addEventListener('click', closeSidebar);
document.addEventListener('change', (event) => {
  if (event.target?.matches?.('[data-season-image-file]')) {
    handleSeasonImage(event);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSidebar();
    hideFieldHelp();
  }
});
$('#userSearch').addEventListener('input', () => {
  state.usersPage = 1;
  renderUsers();
});
$('#supportFilter')?.addEventListener('change', renderSupportTickets);
$('#unilevelUserSearch').addEventListener('input', renderAdminUnilevelMap);
$('#purchaseFilter').addEventListener('change', renderPurchases);
$('#purchaseStartDate')?.addEventListener('change', renderPurchases);
$('#purchaseEndDate')?.addEventListener('change', renderPurchases);
$('#withdrawalFilter').addEventListener('change', renderWithdrawals);
$('#newPackageButton').addEventListener('click', () => openPackageModal({ id: 'custom', name: 'Custom Pack', price_usdt: 100, monthly_cap_usd: 300, daily_energy: 700, tap_reward_tokens: 2, active: true }));
$('#newRankButton').addEventListener('click', () => openRankModal({}));
$('#newAvatarButton').addEventListener('click', () => openAvatarModal({}));
$('#newSkinButton').addEventListener('click', () => openSkinModal({}));
$('#newRouletteRewardButton').addEventListener('click', () => openRouletteRewardModal({}));
$$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => $('#packageModal').close()));
$$('[data-close-rank-modal]').forEach((button) => button.addEventListener('click', () => $('#rankModal').close()));
$$('[data-close-avatar-modal]').forEach((button) => button.addEventListener('click', () => $('#avatarModal').close()));
$$('[data-close-skin-modal]').forEach((button) => button.addEventListener('click', () => $('#skinModal').close()));
$$('[data-close-roulette-modal]').forEach((button) => button.addEventListener('click', () => $('#rouletteRewardModal').close()));
$('#rouletteSettingForm').elements.packageId.addEventListener('change', renderRouletteRewards);

document.addEventListener('click', (event) => {
  const panel = event.target.closest('[data-panel]');
  const usersPageButton = event.target.closest('[data-users-page]');
  const edit = event.target.closest('[data-edit-package]');
  const editRank = event.target.closest('[data-edit-rank]');
  const editAvatar = event.target.closest('[data-edit-avatar]');
  const editSkin = event.target.closest('[data-edit-skin]');
  const removeSkinButton = event.target.closest('[data-remove-skin]');
  const editRoulette = event.target.closest('[data-edit-roulette]');
  const deleteButton = event.target.closest('[data-delete-user]');
  const userAddCoinsButton = event.target.closest('[data-user-add-coins]');
  const userStatusButton = event.target.closest('[data-user-status]');
  const editAdminButton = event.target.closest('[data-edit-admin]');
  const deleteAdminButton = event.target.closest('[data-delete-admin]');
  const unilevelUser = event.target.closest('[data-unilevel-user]');
  const unilevelDefault = event.target.closest('[data-unilevel-default]');
  const purchase = event.target.closest('[data-purchase-action]');
  const withdrawal = event.target.closest('[data-withdrawal-action]');
  const copyWallet = event.target.closest('[data-copy-wallet]');
  const supportTicket = event.target.closest('[data-support-ticket]');
  const supportReply = event.target.closest('[data-support-reply]');
  const supportClose = event.target.closest('[data-support-close]');
  const removeTask = event.target.closest('[data-remove-task]');
  const rewardItem = event.target.closest('[data-reward-item]');
  const fieldInfo = event.target.closest('.field-info-button');
  if (fieldInfo) {
    event.preventDefault();
    event.stopPropagation();
    showFieldHelp(fieldInfo);
    return;
  }
  if (!event.target.closest('.field-help-popover')) hideFieldHelp();
  if (removeTask) removeTask.closest('[data-task-row]')?.remove();
if (rewardItem) {
    $('#rouletteRewardForm').elements.itemId.value = rewardItem.dataset.rewardItem;
    renderRouletteItemPicker();
    syncRouletteLabelFromItem(true);
  }
  if (usersPageButton) {
    state.usersPage += usersPageButton.dataset.usersPage === 'next' ? 1 : -1;
    renderUsers();
  }
  if (panel) switchPanel(panel.dataset.panel);
  if (edit) openPackageModal(state.overview.packages.find((pack) => pack.id === edit.dataset.editPackage));
  if (editRank) openRankModal((state.overview.ranks || []).find((rank) => rank.id === editRank.dataset.editRank));
  if (editAvatar) openAvatarModal(state.overview.avatars.find((avatar) => avatar.id === editAvatar.dataset.editAvatar));
  if (editSkin) openSkinModal((state.overview.skins || []).find((skin) => skin.id === editSkin.dataset.editSkin));
  if (removeSkinButton) void removeSkin(removeSkinButton.dataset.removeSkin);
  if (editRoulette) openRouletteRewardModal((state.overview.roulette_rewards || []).find((reward) => reward.id === editRoulette.dataset.editRoulette));
  if (deleteButton) void deleteUser(deleteButton.dataset.deleteUser);
  if (userAddCoinsButton) void grantTestCoins(userAddCoinsButton.dataset.userAddCoins);
  if (userStatusButton) void updateUserStatus(userStatusButton.dataset.userStatus, userStatusButton.dataset.status);
  if (editAdminButton) editAdminUser(editAdminButton.dataset.editAdmin);
  if (deleteAdminButton) void deleteAdmin(deleteAdminButton.dataset.deleteAdmin);
  if (unilevelDefault) {
    applyDefaultUnilevelPattern(unilevelDefault.dataset.unilevelDefault);
    renderUnilevelConfig();
  }
  if (unilevelUser) {
    state.adminUnilevelUserId = unilevelUser.dataset.unilevelUser;
    renderAdminUnilevelMap();
  }
  if (purchase) void reviewPurchase(purchase.dataset.id, purchase.dataset.purchaseAction);
  if (copyWallet) void copyTextToClipboard(copyWallet.dataset.copyWallet, 'Wallet');
  if (withdrawal) void reviewWithdrawal(withdrawal.dataset.id, withdrawal.dataset.withdrawalAction);
  if (supportTicket) {
    state.supportTicketId = supportTicket.dataset.supportTicket;
    renderSupportTickets();
  }
  if (supportReply) void replySupportTicket(supportReply.dataset.supportReply);
  if (supportClose) void closeSupportTicket(supportClose.dataset.supportClose);
});

if (restoreAdminSession()) {
  showDashboard();
} else {
  showLogin();
}

async function grantTestCoins(playerId) {
  if (!confirm('¿Añadir 1,000,000 GFOX de prueba a este usuario?')) return;
  try {
    const res = await api('/user/add-coins', { playerId }, 'POST');
    if (res.ok) {
      showAlert('1 Millón GFOX añadido para pruebas.', 'success');
      void loadData();
    }
  } catch (err) {
    showAlert(`Error: ${err.message}`);
  }
}

$('#createMatchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!confirm('¿Crear partido con cuotas fijas?')) return;
  const teamA = e.target.elements.teamA.value.trim();
  const teamB = e.target.elements.teamB.value.trim();
  const flagA = e.target.elements.flagA.value.trim();
  const flagB = e.target.elements.flagB.value.trim();
  const venue = e.target.elements.venue.value.trim();
  const matchDateRaw = e.target.elements.matchDate.value;
  const matchDate = matchDateRaw ? new Date(matchDateRaw).toISOString() : null;

  try {
    const res = await api('/match/create', { teamA, teamB, flagA, flagB, venue, matchDate }, 'POST');
    if (res.ok) {
      showAlert('Partido creado.');
      e.target.reset();
      void loadData();
    }
  } catch (err) {
    showAlert(err.message);
  }
});

async function handleMatchAction(action, id, result) {
  const modal = $('#confirmMatchActionModal');
  const titleEl = $('#confirmMatchActionTitle');
  const msgEl = $('#confirmMatchActionMessage');
  const confirmBtn = $('#confirmMatchActionButton');
  
  if (!modal || !titleEl || !msgEl || !confirmBtn) return;
  
  // Find match info for descriptive prompt
  const match = (state.overview?.matches || []).find(m => m.id === id);
  const matchText = match ? `(${match.team_a} vs ${match.team_b})` : '';
  
  let title = '';
  let message = '';
  
  if (action === 'close') {
    title = 'Cerrar Apuestas';
    message = `¿Estás seguro de que deseas cerrar las apuestas para el partido ${matchText}? Ya no se permitirán nuevas apuestas.`;
  } else if (action === 'toggle-disabled') {
    const isDisabled = match?.status === 'disabled';
    title = isDisabled ? 'Activar Partido' : 'Ocultar Partido';
    message = isDisabled
      ? `¿Deseas activar y mostrar nuevamente el partido ${matchText} a los usuarios?`
      : `¿Deseas ocultar el partido ${matchText}? Los usuarios ya no podrán ver este partido en la lista de apuestas.`;
  } else if (action === 'resolve') {
    title = 'Resolver Partido';
    let resultText = '';
    if (result === 'team_a') resultText = `Ganó ${match ? match.team_a : 'Local'}`;
    else if (result === 'team_b') resultText = `Ganó ${match ? match.team_b : 'Visitante'}`;
    else if (result === 'draw') resultText = 'Empate';
    
    message = `¿Estás seguro de que deseas resolver el partido ${matchText} con el resultado: <strong>${resultText}</strong>? Esto pagará a los ganadores automáticamente según las cuotas fijas y cerrará el partido permanentemente.`;
  }
  
  titleEl.innerHTML = title;
  msgEl.innerHTML = message;
  
  // Setup the action button handler
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Procesando...';
    try {
      const endpoint = action === 'close' ? '/match/close' : action === 'toggle-disabled' ? '/match/toggle-disabled' : '/match/resolve';
      const body = action === 'resolve' ? { id, result } : { id };
      const res = await api(endpoint, body, 'POST');
      if (res.ok) {
        if (action === 'resolve') {
          const oddsText = res.odds
            ? ` Cuotas: L ${Number(res.odds.team_a || 0).toFixed(2)} | E ${Number(res.odds.draw || 0).toFixed(2)} | V ${Number(res.odds.team_b || 0).toFixed(2)}.`
            : '';
          showAlert(`Partido resuelto. Ganadores pagados.${oddsText} Apuestas cobradas: ${res.winnersCount || 0}.`, 'success');
        } else if (action === 'toggle-disabled') {
          showAlert(res.status === 'disabled' ? 'Partido ocultado con éxito.' : 'Partido activado con éxito.', 'success');
        } else {
          showAlert('Apuestas cerradas con éxito.', 'success');
        }
        modal.close();
        void loadData();
      }
    } catch (err) {
      showAlert(err.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmar';
    }
  };
  
  modal.showModal();
}

function handleAddManualPool(id, team, teamName) {
  const modal = $('#manualPoolModal');
  const form = $('#manualPoolForm');
  if (!modal || !form) return;
  
  form.elements.matchId.value = id;
  form.elements.team.value = team;
  form.elements.amount.value = '';
  $('#manualPoolTeamLabel').textContent = `Ajuste manual: ${teamName}`;
  modal.showModal();
  requestAnimationFrame(() => {
    form.elements.amount?.focus?.();
  });
}

function applyManualPoolUpdate(matchId, team, amount) {
  const match = state.overview?.matches?.find((item) => item.id === matchId);
  if (!match) return;

  const poolField = team === 'team_a'
    ? 'manual_pool_a'
    : team === 'team_b'
      ? 'manual_pool_b'
      : team === 'draw'
        ? 'manual_pool_draw'
        : '';
  const statsField = team === 'team_a'
    ? 'team_a'
    : team === 'team_b'
      ? 'team_b'
      : team === 'draw'
        ? 'draw'
        : '';

  if (!poolField || !statsField) return;

  match[poolField] = Number(match[poolField] || 0) + amount;
  match.poolStats = {
    ...(match.poolStats || { team_a: 0, draw: 0, team_b: 0, total: 0 }),
    [statsField]: Number(match.poolStats?.[statsField] || 0) + amount,
    total: Number(match.poolStats?.total || 0) + amount,
  };
}

$('#manualPoolForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.elements.matchId.value;
  const team = form.elements.team.value;
  const amount = Math.floor(Number(form.elements.amount.value));
  
  if (Number.isNaN(amount) || amount <= 0) {
    showAlert('Monto inválido.');
    return;
  }
  
  try {
    const res = await api('/match/add-pool', { id, team, amount });
    if (res.ok) {
      applyManualPoolUpdate(id, team, amount);
      $('#manualPoolModal').close();
      showAlert(`Pool incrementado en ${fmt(amount, 0)} GFOX.`, 'success');
      renderAll();
      void loadData();
    }
  } catch (err) {
    showAlert(err.message);
  }
});

function toggleUserBets(id) {
  const el = document.getElementById(`bets-detail-${id}`);
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

// Global keypad handlers for mobile-friendly input
window.addPoolPreset = function(presetVal) {
  const input = document.getElementById('manualPoolAmountInput');
  const preview = document.getElementById('manualPoolAmountPreview');
  if (!input) return;
  const current = Number(input.value) || 0;
  input.value = current + presetVal;
  if (preview) preview.textContent = fmt(input.value || 0, 0);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

window.pressPoolKeypad = function(key) {
  const input = document.getElementById('manualPoolAmountInput');
  const preview = document.getElementById('manualPoolAmountPreview');
  if (!input) return;
  
  let val = String(input.value || '');
  if (key === 'C') {
    val = '';
  } else if (key === 'back') {
    val = val.slice(0, -1);
  } else {
    // Prevent starting with multiple zeros
    if (val === '0') {
      val = key;
    } else {
      val += key;
    }
  }
  
  input.value = val;
  if (preview) preview.textContent = fmt(val || 0, 0);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

function syncManualPoolPreview(value) {
  const preview = document.getElementById('manualPoolAmountPreview');
  if (!preview) return;
  preview.textContent = fmt(value || 0, 0);
}

$('#manualPoolAmountInput')?.addEventListener('input', (event) => {
  syncManualPoolPreview(event.target.value);
});

// Delegated event listener for inline odds edits
document.addEventListener('change', async (e) => {
  if (e.target.classList.contains('odds-inline-input')) {
    const input = e.target;
    const matchId = input.dataset.id;
    const type = input.dataset.type; // 'team_a', 'draw', 'team_b'
    const value = parseFloat(input.value);

    if (isNaN(value) || value < 1.0) {
      showAlert('La cuota debe ser un número válido y mayor o igual a 1.0.');
      // Restore previous value
      const match = (state.overview.matches || []).find(m => m.id === matchId);
      if (match) {
        const origVal = type === 'team_a' ? match.odds_team_a : type === 'draw' ? match.odds_draw : match.odds_team_b;
        input.value = Number(origVal || 1.0).toFixed(2);
      }
      return;
    }

    try {
      input.style.boxShadow = '0 0 5px #ffaa00'; // Indicador de guardando (naranja)
      const res = await api('/match/update-odds', { id: matchId, type, value });
      if (res.ok) {
        input.style.boxShadow = '0 0 5px #00ff00'; // Éxito (verde)
        setTimeout(() => {
          input.style.boxShadow = '';
        }, 1500);

        // Update local state so it stays consistent without full reload
        const match = (state.overview.matches || []).find(m => m.id === matchId);
        if (match) {
          if (type === 'team_a') match.odds_team_a = value;
          else if (type === 'draw') match.odds_draw = value;
          else if (type === 'team_b') match.odds_team_b = value;
        }
      } else {
        throw new Error(res.error || 'Error al actualizar cuota');
      }
    } catch (err) {
      input.style.boxShadow = '0 0 5px #ff0000'; // Error (rojo)
      showAlert(err.message);
      // Restore previous value
      const match = (state.overview.matches || []).find(m => m.id === matchId);
      if (match) {
        const origVal = type === 'team_a' ? match.odds_team_a : type === 'draw' ? match.odds_draw : match.odds_team_b;
        input.value = Number(origVal || 1.0).toFixed(2);
      }
      setTimeout(() => {
        input.style.boxShadow = '';
      }, 1500);
    }
  }
});

async function openAuditDuplicatesModal() {
  const modal = $('#auditDuplicatesModal');
  const container = $('#auditReportContainer');
  if (!modal || !container) return;

  container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);"><iconify-icon icon="ph:spinner-bold" class="spin" style="font-size: 2rem;"></iconify-icon><br>Escaneando discrepancias y auditoría...</div>';
  modal.showModal();

  try {
    const res = await api('/match/audit-duplicates');
    if (!res.ok) throw new Error(res.error || 'Error al obtener la auditoría');

    const report = res.report || [];
    if (report.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 30px; color: #46d39e; font-weight: 500;"><iconify-icon icon="ph:check-circle-bold" style="font-size: 2.5rem; display: block; margin: 0 auto 10px;"></iconify-icon>Todo en orden. No se detectan duplicaciones de cobro de apuestas con saldo excedente.</div>';
      return;
    }

    let rows = '';
    report.forEach(item => {
      rows += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 10px 8px; font-size: 0.85rem;"><strong>${escapeAttr(item.username)}</strong></td>
          <td style="padding: 10px 8px; font-size: 0.85rem; color: var(--muted);">${escapeAttr(item.match_name)}</td>
          <td style="padding: 10px 8px; font-size: 0.85rem; text-align: right;">${fmt(item.expected_payout, 0)} FOX</td>
          <td style="padding: 10px 8px; font-size: 0.85rem; text-align: center;"><span style="background: rgba(255,91,140,0.15); color: #ff5b8c; padding: 2px 6px; border-radius: 4px; font-weight: 700;">+${item.times_extra} veces</span></td>
          <td style="padding: 10px 8px; font-size: 0.85rem; text-align: right; font-weight: 700; color: #ff5b8c;">-${fmt(item.suggested_deduction, 0)} FOX</td>
          <td style="padding: 10px 8px; font-size: 0.85rem; text-align: center;">
            <button type="button" class="danger-button compact-button" onclick="deductExtraPayout('${item.player_id}', '${escapeAttr(item.username)}', ${item.suggested_deduction})" style="background: #ff5b8c; color: #fff; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
              Descontar
            </button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
            <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Usuario</th>
            <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted);">Partido</th>
            <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted); text-align: right;">Premio Único</th>
            <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted); text-align: center;">Cobros Extra</th>
            <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted); text-align: right;">Descuento Sugerido</th>
            <th style="padding: 10px 8px; font-size: 0.8rem; color: var(--muted); text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

  } catch (err) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff5b8c;">Error: ${escapeAttr(err.message)}</div>`;
  }
}

async function deductExtraPayout(playerId, username, amount) {
  if (!confirm(`¿Estás seguro de que deseas descontar ${fmt(amount, 0)} FOX al usuario ${username} como devolución de cobro duplicado?`)) return;

  try {
    const res = await api('/user/adjust-balance', { player_id: playerId, amount: -amount }, 'POST');
    if (res.ok) {
      showAlert(`Se ha descontado ${fmt(amount, 0)} FOX a ${username} correctamente.`, 'success');
      void openAuditDuplicatesModal();
      void loadData();
    } else {
      throw new Error(res.error || 'Error al aplicar deducción');
    }
  } catch (err) {
    showAlert(err.message);
  }
}

// Bind backup events
document.addEventListener('DOMContentLoaded', () => {
  $('#btnDownloadBackupJson')?.addEventListener('click', () => {
    window.open('/api/foxpay/admin/match/download-backup?token=' + encodeURIComponent(state.authToken || ''), '_blank');
  });

  $('#btnCreateDbBackup')?.addEventListener('click', async () => {
    const btn = $('#btnCreateDbBackup');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Creando respaldo...';
    try {
      const res = await api('/match/create-backup', {}, 'POST');
      if (res.ok) {
        showAlert(res.message || 'Respaldo DB creado con éxito.', 'success');
      } else {
        throw new Error(res.error || 'Fallo al respaldar');
      }
    } catch (err) {
      showAlert(`Error de respaldo: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear Respaldo SQL (DB)';
    }
  });
});

