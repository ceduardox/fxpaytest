import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import pg from 'pg';

const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL === 'disable' ? '' : (process.env.DATABASE_URL || '');
const gemiAdApiKey = process.env.GEMIAD_API_KEY || '';
const gemiAdPlacementId = process.env.GEMIAD_PLACEMENT_ID || '';
const gemiAdSecretKey = process.env.GEMIAD_SECRET_KEY || '';
const gemiAdOffersUrl = process.env.GEMIAD_OFFERS_URL || 'https://api.gemiwall.com/api/offers/static';
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
const telegramBotUsername = (process.env.TELEGRAM_BOT_USERNAME || 'neraverse_bot').replace(/^@/, '');
const autoTapCost = Number(process.env.AUTO_TAP_COST || 300);
const autoTapDurationMinutes = Number(process.env.AUTO_TAP_DURATION_MINUTES || 30);
const autoTapRewardPerMinute = Number(process.env.AUTO_TAP_REWARD_PER_MINUTE || 10);
const nowPaymentsApiKey = process.env.NOWPAYMENTS_API_KEY || '';
const nowPaymentsIpnSecret = process.env.NOWPAYMENTS_IPN_SECRET || '';
const nowPaymentsApiUrl = (process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1').replace(/\/+$/, '');
const nowPaymentsIpnUrl = process.env.NOWPAYMENTS_IPN_URL || '';
const nowPaymentsSuccessUrl = process.env.NOWPAYMENTS_SUCCESS_URL || 'https://foxpay.live/';
const nowPaymentsCancelUrl = process.env.NOWPAYMENTS_CANCEL_URL || 'https://foxpay.live/';
const oneSignalAppId = process.env.ONESIGNAL_APP_ID || 'e951a9b5-2c5a-42ce-9c30-7be3dca788d5';
const oneSignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const foxpayMinItemUsdtPayment = 20;
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = rootDir;
const adminRoute = normalizeAdminRoute(process.env.FOXPAY_ADMIN_PATH || '/ceduardox');
const foxpayPublicBaseUrl = (process.env.COOLIFY_URL || process.env.NOWPAYMENTS_SUCCESS_URL || nowPaymentsSuccessUrl || 'https://foxpay.live/').replace(/\/+$/, '');
const foxpayAdminUrl = `${foxpayPublicBaseUrl}${adminRoute}/`;
const foxpayPushIconUrl = `${foxpayPublicBaseUrl}/logo2-meta.jpg`;
const foxpayPushBadgeUrl = `${foxpayPublicBaseUrl}/favicon.png`;
const foxpaySuperAdminUser = process.env.FOXPAY_SUPERADMIN_USER || '';
const foxpaySuperAdminPassword = process.env.FOXPAY_SUPERADMIN_PASSWORD || '';
const foxpayAdminKey = process.env.FOXPAY_ADMIN_KEY || '';
const foxpayAdminSessionSecret = process.env.FOXPAY_ADMIN_SESSION_SECRET || foxpayAdminKey || randomBytes(32).toString('hex');
const foxpayAdminLoginWindowMs = Number(process.env.FOXPAY_ADMIN_LOGIN_WINDOW_MS || 10 * 60 * 1000);
const foxpayAdminLoginMaxFailures = Number(process.env.FOXPAY_ADMIN_LOGIN_MAX_FAILURES || 5);
const foxpayAdminLoginBlockMs = Number(process.env.FOXPAY_ADMIN_LOGIN_BLOCK_MS || 10 * 60 * 1000);
const foxpayPaymentExpirationGraceMs = Math.max(0, Number(process.env.FOXPAY_PAYMENT_EXPIRATION_GRACE_MS || 2 * 60 * 1000));

const freeWithdrawalLimitUsd = Number(process.env.FREE_WITHDRAWAL_LIMIT_USD || 10.0);

const FOXPAY_UPGRADE_CARDS = [
  // --- MARKETING ---
  { id: 'tg_channel', name: 'Canal de Telegram', category: 'marketing', baseCost: 100, baseProfit: 10, costMultiplier: 1.18, requires: null },
  { id: 'wa_group', name: 'Grupo de WhatsApp', category: 'marketing', baseCost: 250, baseProfit: 25, costMultiplier: 1.18, requires: { type: 'card', id: 'tg_channel', level: 3 } },
  { id: 'seo_strategy', name: 'Estrategia SEO Global', category: 'marketing', baseCost: 500, baseProfit: 55, costMultiplier: 1.18, requires: { type: 'card', id: 'wa_group', level: 2 } },
  { id: 'tiktok_campaign', name: 'Campaña de TikTok', category: 'marketing', baseCost: 800, baseProfit: 85, costMultiplier: 1.18, requires: { type: 'card', id: 'seo_strategy', level: 4 } },
  { id: 'youtube_ads', name: 'Campaña de YouTube Ads', category: 'marketing', baseCost: 1200, baseProfit: 130, costMultiplier: 1.18, requires: { type: 'card', id: 'tiktok_campaign', level: 5 } },
  { id: 'community_airdrop', name: 'Airdrops Comunitarios', category: 'marketing', baseCost: 1800, baseProfit: 200, costMultiplier: 1.18, requires: { type: 'card', id: 'youtube_ads', level: 4 } },
  { id: 'influencer_mkt', name: 'Marketing de Influencers', category: 'marketing', baseCost: 2500, baseProfit: 300, costMultiplier: 1.18, requires: { type: 'invites', count: 2 } },
  { id: 'metaverse_billboard', name: 'Vallas en el Metaverso', category: 'marketing', baseCost: 4500, baseProfit: 550, costMultiplier: 1.18, requires: { type: 'card', id: 'influencer_mkt', level: 5 } },
  { id: 'ambassador_program', name: 'Programa de Embajadores', category: 'marketing', baseCost: 8000, baseProfit: 1000, costMultiplier: 1.18, requires: { type: 'invites', count: 5 } },
  { id: 'esports_sponsor', name: 'Patrocinio eSports', category: 'marketing', baseCost: 15000, baseProfit: 2000, costMultiplier: 1.18, requires: { type: 'card', id: 'ambassador_program', level: 5 } },

  // --- TECNOLOGÍA ---
  { id: 'local_servers', name: 'Servidores Locales', category: 'technology', baseCost: 150, baseProfit: 15, costMultiplier: 1.18, requires: null },
  { id: 'smart_contract_audit', name: 'Auditoría de Smart Contract', category: 'technology', baseCost: 350, baseProfit: 35, costMultiplier: 1.18, requires: { type: 'card', id: 'local_servers', level: 3 } },
  { id: 'aws_cloud', name: 'Servidores Cloud (AWS)', category: 'technology', baseCost: 500, baseProfit: 55, costMultiplier: 1.18, requires: { type: 'card', id: 'local_servers', level: 5 } },
  { id: 'gpu_mining', name: 'Granjas de Minería GPU', category: 'technology', baseCost: 900, baseProfit: 100, costMultiplier: 1.18, requires: { type: 'card', id: 'aws_cloud', level: 4 } },
  { id: 'cybersecurity', name: 'Ciberseguridad Avanzada', category: 'technology', baseCost: 1400, baseProfit: 160, costMultiplier: 1.18, requires: { type: 'card', id: 'smart_contract_audit', level: 5 } },
  { id: 'foxpay_validator', name: 'Nodo Validador FoxPay', category: 'technology', baseCost: 2200, baseProfit: 260, costMultiplier: 1.18, requires: { type: 'card', id: 'gpu_mining', level: 5 } },
  { id: 'senior_devs', name: 'Desarrolladores Senior Web3', category: 'technology', baseCost: 3800, baseProfit: 450, costMultiplier: 1.18, requires: { type: 'card', id: 'foxpay_validator', level: 4 } },
  { id: 'ai_autotap', name: 'Algoritmo AI Auto-Tap', category: 'technology', baseCost: 6500, baseProfit: 800, costMultiplier: 1.18, requires: { type: 'card', id: 'senior_devs', level: 5 } },
  { id: 'quantum_computing', name: 'Computación Cuántica', category: 'technology', baseCost: 12000, baseProfit: 1500, costMultiplier: 1.18, requires: { type: 'card', id: 'ai_autotap', level: 6 } },
  { id: 'metaverse_core', name: 'Motor del Metaverso', category: 'technology', baseCost: 25000, baseProfit: 3500, costMultiplier: 1.18, requires: { type: 'card', id: 'quantum_computing', level: 5 } },

  // --- NEGOCIOS ---
  { id: 'brand_registration', name: 'Registro de Marca', category: 'business', baseCost: 300, baseProfit: 32, costMultiplier: 1.18, requires: null },
  { id: 'fintech_license', name: 'Licencia de Operación Fintech', category: 'business', baseCost: 600, baseProfit: 65, costMultiplier: 1.18, requires: { type: 'card', id: 'brand_registration', level: 4 } },
  { id: 'local_bank_integration', name: 'Integración con Bancos', category: 'business', baseCost: 1000, baseProfit: 110, costMultiplier: 1.18, requires: { type: 'card', id: 'fintech_license', level: 3 } },
  { id: 'strategic_partnerships', name: 'Alianzas Estratégicas', category: 'business', baseCost: 1800, baseProfit: 210, costMultiplier: 1.18, requires: { type: 'card', id: 'local_bank_integration', level: 4 } },
  { id: 'kyc_compliance', name: 'Cumplimiento Legal KYC', category: 'business', baseCost: 2800, baseProfit: 330, costMultiplier: 1.18, requires: { type: 'card', id: 'fintech_license', level: 6 } },
  { id: 'dubai_office', name: 'Oficinas en Dubai', category: 'business', baseCost: 5000, baseProfit: 600, costMultiplier: 1.18, requires: { type: 'card', id: 'strategic_partnerships', level: 5 } },
  { id: 'seed_fund', name: 'Fondo de Inversión Semilla', category: 'business', baseCost: 9000, baseProfit: 1100, costMultiplier: 1.18, requires: { type: 'card', id: 'dubai_office', level: 4 } },
  { id: 'cmc_listing', name: 'Listado en CoinMarketCap', category: 'business', baseCost: 15000, baseProfit: 1900, costMultiplier: 1.18, requires: { type: 'card', id: 'kyc_compliance', level: 8 } },
  { id: 'tier1_exchange', name: 'Lanzamiento Exchange Tier 1', category: 'business', baseCost: 30000, baseProfit: 4000, costMultiplier: 1.18, requires: { type: 'card', id: 'cmc_listing', level: 5 } },
  { id: 'global_conglomerate', name: 'Conglomerado Global', category: 'business', baseCost: 60000, baseProfit: 8500, costMultiplier: 1.18, requires: { type: 'card', id: 'tier1_exchange', level: 7 } }
];


const balances = new Map();
const transactions = new Set();
const boosters = new Map();
const friendProgress = new Map();
const gameStates = new Map();
const foxpayPlayers = new Map();
const foxpayPackagesMemory = new Map();
const foxpayAvatarsMemory = new Map();
const foxpaySkinsMemory = new Map();
const foxpayRanksMemory = new Map();
const foxpayPurchases = new Map();
const foxpayPayments = new Map();
const foxpayCommissions = new Map();
const foxpayWithdrawals = new Map();
const foxpayPlayerDailyStatsMemory = new Map();
const foxpayPurchaseLocks = new Set();
const foxpayRouletteRewardsMemory = new Map();
const foxpayRouletteSpinsMemory = new Map();
const foxpayRouletteSettingsMemory = new Map();
const foxpaySettingsMemory = new Map();
const foxpayAdminUsersMemory = new Map();
const foxpayAdminPushSubscriptionsMemory = new Map();
const foxpayAdminNotificationEventsMemory = new Set();
const foxpayMatchesMemory = new Map();
const foxpayBetsMemory = new Map();
const foxpayAdminPushLogsMemory = [];
const foxpayAdminLoginAttempts = new Map();
const foxpaySupportTicketsMemory = new Map();
const foxpaySupportMessagesMemory = new Map();
const countryLookupCache = new Map();
const foxpayRegisterCaptchas = new Map();
const pool = databaseUrl
  ? new pg.Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  })
  : null;

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function cacheControlForAsset(assetPath, filePath) {
  const normalizedPath = assetPath.replaceAll('\\', '/');
  const extension = extname(filePath).toLowerCase();
  if (
    normalizedPath === 'index.html'
    || normalizedPath === 'sw.js'
    || normalizedPath.endsWith('.html')
    || ['.js', '.css', '.webmanifest', '.json'].includes(extension)
  ) {
    return 'no-store, no-cache, must-revalidate, proxy-revalidate';
  }
  if (normalizedPath.startsWith('images/') || ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'].includes(extension)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-store, no-cache, must-revalidate, proxy-revalidate';
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  if (response.req?.method === 'HEAD') {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  if (response.req?.method === 'HEAD') {
    response.end();
    return;
  }
  response.end(text);
}

function normalizeAdminRoute(value) {
  const raw = String(value || '').trim();
  const route = raw.startsWith('/') ? raw : `/${raw}`;
  return route.replace(/\/+$/, '') || '/ceduardox';
}

function md5(value) {
  return createHash('md5').update(value).digest('hex');
}

function validateTelegramInitData(initData) {
  if (!telegramBotToken) {
    return {
      ok: false,
      error: 'telegram_token_not_configured',
    };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  params.delete('hash');

  if (!hash) {
    return {
      ok: false,
      error: 'missing_hash',
    };
  }

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(telegramBotToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (hashBuffer.length !== expectedBuffer.length || !timingSafeEqual(hashBuffer, expectedBuffer)) {
    return {
      ok: false,
      error: 'invalid_hash',
    };
  }

  const authDate = Number(params.get('auth_date') || 0);
  if (!Number.isFinite(authDate) || authDate <= 0 || Date.now() / 1000 - authDate > 86400) {
    return {
      ok: false,
      error: 'expired_init_data',
    };
  }

  let user;
  try {
    user = JSON.parse(params.get('user') || '{}');
  } catch {
    user = null;
  }

  if (!user?.id) {
    return {
      ok: false,
      error: 'missing_user',
    };
  }

  return {
    ok: true,
    playerId: `tg_${user.id}`,
    user,
  };
}

async function readRequestParams(request, url) {
  const params = new URLSearchParams(url.searchParams);

  if (request.method !== 'POST') {
    return params;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) {
    return params;
  }

  const contentType = request.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    try {
      const payload = JSON.parse(body);
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });
    } catch (e) {
      console.error('[SERVER-ERROR] Failed to parse JSON body:', e.message);
    }
    return params;
  }

  const bodyParams = new URLSearchParams(body);
  bodyParams.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

async function initDatabase() {
  if (!pool) {
    return;
  }

  await pool.query(`
    create table if not exists player_balances (
      player_id text primary key,
      balance integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists partner_transactions (
      transaction_id text primary key,
      player_id text not null references player_balances(player_id),
      amount integer not null,
      offer_id text,
      offer_name text,
      payout numeric,
      country text,
      platform text,
      raw_payload jsonb not null,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists player_boosters (
      id bigserial primary key,
      player_id text not null references player_balances(player_id),
      booster_type text not null,
      started_at timestamptz not null default now(),
      expires_at timestamptz not null,
      last_claimed_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists cpa_conversions (
      transaction_id text primary key,
      provider text not null,
      player_id text not null references player_balances(player_id),
      campaign_id text,
      campaign_name text,
      payout numeric,
      reward_type text not null,
      raw_payload jsonb not null,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists player_referrals (
      player_id text primary key references player_balances(player_id),
      invited_count integer not null default 0,
      claimed_tiers jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists player_referral_links (
      invited_player_id text primary key references player_balances(player_id),
      referrer_player_id text not null references player_balances(player_id),
      invited_name text,
      invited_username text,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query('alter table player_referral_links add column if not exists invited_name text');
  await pool.query('alter table player_referral_links add column if not exists invited_username text');

  await pool.query(`
    create table if not exists player_game_states (
      player_id text primary key references player_balances(player_id),
      state jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists foxpay_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists foxpay_admin_users (
      id text primary key,
      username text not null unique,
      password_hash text not null,
      password_salt text not null,
      role text not null default 'viewer',
      permissions jsonb not null default '{}'::jsonb,
      created_by text,
      approved boolean not null default false,
      can_edit boolean not null default false,
      push_enabled boolean not null default true,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_login_at timestamptz
    )
  `);
  await pool.query(`alter table foxpay_admin_users add column if not exists permissions jsonb not null default '{}'::jsonb`);
  await pool.query(`alter table foxpay_admin_users add column if not exists created_by text`);
  await pool.query(`alter table foxpay_admin_users add column if not exists approved boolean not null default false`);
  await pool.query(`alter table foxpay_admin_users add column if not exists can_edit boolean not null default false`);
  await pool.query(`alter table foxpay_admin_users add column if not exists push_enabled boolean not null default true`);
  await pool.query(`update foxpay_admin_users set push_enabled = true where push_enabled is null`);
  await pool.query(`
    update foxpay_admin_users
       set approved = true
     where approved = false
       and created_at < now() - interval '2 minutes'
  `);

  await pool.query(`
    create table if not exists foxpay_admin_push_subscriptions (
      id text primary key,
      admin_username text not null,
      subscription_id text not null unique,
      active boolean not null default true,
      user_agent text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    )
  `);
  await pool.query('create index if not exists foxpay_admin_push_active_idx on foxpay_admin_push_subscriptions (active, updated_at desc)');

  await pool.query(`
    create table if not exists foxpay_admin_notification_events (
      event_key text primary key,
      event_type text not null,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists foxpay_admin_push_logs (
      id bigserial primary key,
      event_type text not null,
      event_key text,
      status text not null,
      subscription_count integer not null default 0,
      response jsonb not null default '{}'::jsonb,
      error text,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query('create index if not exists foxpay_admin_push_logs_created_idx on foxpay_admin_push_logs (created_at desc)');

  await pool.query(`
    create table if not exists foxpay_support_tickets (
      id text primary key,
      player_id text not null,
      username text not null default '',
      category text not null,
      subject text not null default '',
      status text not null default 'open',
      priority text not null default 'normal',
      last_message_at timestamptz not null default now(),
      last_admin_message_at timestamptz,
      last_player_message_at timestamptz,
      last_player_read_at timestamptz,
      admin_unread_count integer not null default 0,
      player_unread_count integer not null default 0,
      device_key text,
      signup_ip text,
      user_agent text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      closed_at timestamptz,
      rating integer,
      rated_at timestamptz
    )
  `);
  await pool.query('create index if not exists foxpay_support_tickets_player_idx on foxpay_support_tickets (player_id, updated_at desc)');
  await pool.query('create index if not exists foxpay_support_tickets_status_idx on foxpay_support_tickets (status, updated_at desc)');
  await pool.query('create index if not exists foxpay_support_tickets_device_idx on foxpay_support_tickets (device_key, created_at desc)');
  await pool.query('create index if not exists foxpay_support_tickets_ip_idx on foxpay_support_tickets (signup_ip, created_at desc)');
  await pool.query('alter table foxpay_support_tickets add column if not exists rating integer');
  await pool.query('alter table foxpay_support_tickets add column if not exists rated_at timestamptz');

  await pool.query(`
    create table if not exists foxpay_support_messages (
      id text primary key,
      ticket_id text not null references foxpay_support_tickets(id) on delete cascade,
      sender_type text not null,
      sender_id text not null,
      message text not null,
      image_url text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  await pool.query('alter table foxpay_support_messages add column if not exists image_url text not null default \'\'');
  await pool.query('create index if not exists foxpay_support_messages_ticket_idx on foxpay_support_messages (ticket_id, created_at asc)');

  await pool.query(`
    create table if not exists foxpay_packages (
      id text primary key,
      name text not null,
      price_usdt numeric not null,
      max_multiplier numeric not null default 3,
      monthly_cap_usd numeric not null default 0,
      daily_energy integer not null default 500,
      tap_reward_tokens integer not null default 1,
      icon_url text,
      video_urls jsonb not null default '[]'::jsonb,
      task_config jsonb not null default '{}'::jsonb,
      active boolean not null default true,
      sort_order integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query('alter table foxpay_packages add column if not exists icon_url text');
  await pool.query('alter table foxpay_packages add column if not exists video_urls jsonb not null default \'[]\'::jsonb');
  await pool.query('alter table foxpay_packages add column if not exists task_config jsonb not null default \'{}\'::jsonb');

  await pool.query(`
    create table if not exists foxpay_avatars (
      id text primary key,
      name text not null,
      image_url text not null,
      price_tokens numeric not null default 0,
      price_usdt numeric not null default 0,
      is_free boolean not null default true,
      active boolean not null default true,
      sort_order integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists foxpay_skins (
      id text primary key,
      name text not null,
      image_url text not null,
      price_usdt numeric not null default 0,
      tap_bonus_per_day integer not null default 0,
      roulette_package_ids jsonb not null default '[]'::jsonb,
      active boolean not null default true,
      sort_order integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query('alter table foxpay_skins add column if not exists price_usdt numeric not null default 0');
  await pool.query('alter table foxpay_skins add column if not exists tap_bonus_per_day integer not null default 0');
  await pool.query('alter table foxpay_skins add column if not exists roulette_package_ids jsonb not null default \'[]\'::jsonb');
  await pool.query('create index if not exists foxpay_skins_active_idx on foxpay_skins (active, sort_order)');

  await pool.query(`
    create table if not exists foxpay_ranks (
      id text primary key,
      name text not null,
      image_url text not null default '',
      required_directs integer not null default 0,
      required_lifetime_usd numeric not null default 0,
      team_requirements jsonb not null default '{}'::jsonb,
      active boolean not null default true,
      sort_order integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query('alter table foxpay_ranks add column if not exists image_url text not null default \'\'');
  await pool.query('alter table foxpay_ranks add column if not exists required_directs integer not null default 0');
  await pool.query('alter table foxpay_ranks add column if not exists required_lifetime_usd numeric not null default 0');
  await pool.query('alter table foxpay_ranks add column if not exists team_requirements jsonb not null default \'{}\'::jsonb');
  await pool.query('alter table foxpay_ranks add column if not exists active boolean not null default true');
  await pool.query('alter table foxpay_ranks add column if not exists sort_order integer not null default 0');
  await pool.query('create index if not exists foxpay_ranks_active_idx on foxpay_ranks (active, sort_order)');

  await pool.query(`
    create table if not exists foxpay_players (
      player_id text primary key,
      username text not null default 'Fox player',
      email text not null default '',
      password_hash text,
      password_salt text,
      account_token text,
      registered_at timestamptz,
      last_login_at timestamptz,
      signup_ip text,
      country_code text,
      country_name text,
      device_key text,
      device_label text,
      user_agent text,
      selected_avatar_id text,
      owned_avatars jsonb not null default '[]'::jsonb,
      owned_skins jsonb not null default '[]'::jsonb,
      selected_skins jsonb not null default '[]'::jsonb,
      skin_taps_daily_key text not null default '',
      withdrawal_wallet text not null default '',
      withdrawal_network text not null default 'bep20',
      referrer_id text,
      account_status text not null default 'active',
      token_balance numeric not null default 0,
      roulette_tickets integer not null default 0,
      total_earned_usd numeric not null default 0,
      lifetime_earned_usd numeric not null default 0,
      season_key text not null default '',
      season_earned_tokens numeric not null default 0,
      total_withdrawn_usd numeric not null default 0,
      active_package_id text not null default 'free',
      energy integer not null default 0,
      max_energy integer not null default 500,
      daily_key text not null default '',
      streak_days integer not null default 0,
      streak_last_key text not null default '',
      daily_tasks jsonb not null default '{}'::jsonb,
      task_progress jsonb not null default '{}'::jsonb,
      referral_task_state jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query('alter table foxpay_players add column if not exists password_hash text');
  await pool.query('alter table foxpay_players add column if not exists email text not null default \'\'');
  await pool.query('alter table foxpay_players add column if not exists password_salt text');
  await pool.query('alter table foxpay_players add column if not exists account_token text');
  await pool.query('alter table foxpay_players add column if not exists registered_at timestamptz');
  await pool.query('alter table foxpay_players add column if not exists last_login_at timestamptz');
  await pool.query('alter table foxpay_players add column if not exists signup_ip text');
  await pool.query('alter table foxpay_players add column if not exists country_code text');
  await pool.query('alter table foxpay_players add column if not exists country_name text');
  await pool.query('alter table foxpay_players add column if not exists device_key text');
  await pool.query('alter table foxpay_players add column if not exists device_label text');
  await pool.query('alter table foxpay_players add column if not exists user_agent text');
  await pool.query('alter table foxpay_players add column if not exists selected_avatar_id text');
  await pool.query('alter table foxpay_players add column if not exists owned_avatars jsonb not null default \'[]\'::jsonb');
  await pool.query('alter table foxpay_players add column if not exists owned_skins jsonb not null default \'[]\'::jsonb');
  await pool.query('alter table foxpay_players add column if not exists selected_skins jsonb not null default \'[]\'::jsonb');
  await pool.query('alter table foxpay_players add column if not exists skin_taps_daily_key text not null default \'\'');
  await pool.query('alter table foxpay_players add column if not exists withdrawal_wallet text not null default \'\'');
  await pool.query('alter table foxpay_players add column if not exists withdrawal_network text not null default \'bep20\'');
  await pool.query('alter table foxpay_players add column if not exists account_status text not null default \'active\'');
  await pool.query('alter table foxpay_players add column if not exists roulette_tickets integer not null default 0');
  await pool.query('alter table foxpay_players add column if not exists lifetime_earned_usd numeric not null default 0');
  await pool.query('update foxpay_players set lifetime_earned_usd = greatest(lifetime_earned_usd, total_earned_usd) where lifetime_earned_usd < total_earned_usd');
  await pool.query('alter table foxpay_players add column if not exists season_key text not null default \'\'');
  await pool.query('alter table foxpay_players add column if not exists season_earned_tokens numeric not null default 0');
  await pool.query('alter table foxpay_players add column if not exists streak_days integer not null default 0');
  await pool.query('alter table foxpay_players add column if not exists streak_last_key text not null default \'\'');
  await pool.query('alter table foxpay_players add column if not exists referral_task_state jsonb not null default \'{}\'::jsonb');
  await pool.query('alter table foxpay_players add column if not exists game_fox_balance numeric not null default 0');
  await pool.query('alter table foxpay_players add column if not exists passive_income_per_hour numeric not null default 0');
  await pool.query('alter table foxpay_players add column if not exists last_passive_claim_timestamp timestamptz not null default now()');
  await pool.query('alter table foxpay_players add column if not exists upgrade_cards_levels jsonb not null default \'{}\'::jsonb');
  await pool.query('alter table foxpay_players add column if not exists free_withdrawal_claimed boolean not null default false');

  await pool.query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'foxpay_players_token_balance_nonnegative'
      ) then
        alter table foxpay_players
          add constraint foxpay_players_token_balance_nonnegative
          check (token_balance >= 0) not valid;
      end if;
    end $$;
  `);
  await pool.query('create unique index if not exists foxpay_players_username_registered_idx on foxpay_players (lower(username)) where password_hash is not null');
  await pool.query("create unique index if not exists foxpay_players_email_registered_idx on foxpay_players (lower(email)) where password_hash is not null and email <> ''");

  await pool.query(`
    create table if not exists foxpay_player_daily_stats (
      player_id text not null references foxpay_players(player_id),
      daily_key text not null,
      active_package_id text not null default 'free',
      max_energy integer not null default 0,
      energy_used integer not null default 0,
      energy_remaining integer not null default 0,
      taps integer not null default 0,
      earned_tokens numeric not null default 0,
      earned_usd numeric not null default 0,
      completed_task_count integer not null default 0,
      completed_tasks jsonb not null default '[]'::jsonb,
      required_video_count integer not null default 0,
      token_price_usd numeric not null default 0,
      last_activity_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (player_id, daily_key)
    )
  `);
  await pool.query('create index if not exists foxpay_daily_stats_player_day_idx on foxpay_player_daily_stats (player_id, daily_key desc)');

  await pool.query(`
    create table if not exists foxpay_payments (
      id text primary key,
      player_id text not null references foxpay_players(player_id),
      item_type text not null,
      item_id text not null,
      amount_usdt numeric not null,
      network text not null,
      pay_currency text not null,
      nowpayments_payment_id text,
      order_id text not null unique,
      status text not null default 'waiting',
      pay_amount numeric,
      pay_address text,
      payment_url text,
      raw_payload jsonb not null default '{}'::jsonb,
      expires_at timestamptz,
      activated_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query('alter table foxpay_payments add column if not exists activated_at timestamptz');
  await pool.query('create index if not exists foxpay_payments_player_idx on foxpay_payments (player_id, created_at desc)');
  await pool.query('create index if not exists foxpay_payments_np_id_idx on foxpay_payments (nowpayments_payment_id)');

  await pool.query(`
    create table if not exists foxpay_commissions (
      id text primary key,
      source_id text not null,
      source_type text not null,
      buyer_player_id text not null,
      referrer_player_id text not null,
      level integer not null,
      rate numeric not null,
      amount_usdt numeric not null,
      expected_tokens numeric not null,
      credited_tokens numeric not null,
      lost_tokens numeric not null,
      credited_usd numeric not null,
      lost_usd numeric not null,
      referrer_package_id text,
      status text not null,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query('create index if not exists foxpay_commissions_referrer_idx on foxpay_commissions (referrer_player_id, created_at desc)');
  await pool.query('create index if not exists foxpay_commissions_source_idx on foxpay_commissions (source_id)');

  await pool.query(`
    create table if not exists foxpay_purchases (
      id text primary key,
      player_id text not null references foxpay_players(player_id),
      package_id text not null references foxpay_packages(id),
      amount_usdt numeric not null,
      status text not null default 'pending',
      tx_hash text,
      created_at timestamptz not null default now(),
      reviewed_at timestamptz
    )
  `);
  await pool.query('alter table foxpay_purchases add column if not exists fox_tokens_paid numeric not null default 0');
  await pool.query('alter table foxpay_purchases add column if not exists fox_usdt_paid numeric not null default 0');
  await pool.query('alter table foxpay_purchases add column if not exists usdt_due numeric not null default 0');
  await pool.query('create index if not exists foxpay_purchases_player_idx on foxpay_purchases (player_id, created_at desc)');

  await pool.query(`
    create table if not exists foxpay_withdrawals (
      id text primary key,
      player_id text not null references foxpay_players(player_id),
      tokens numeric not null,
      usdt_amount numeric not null,
      wallet text not null,
      network text,
      tx_hash text,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      reviewed_at timestamptz
    )
  `);

  await pool.query('alter table foxpay_withdrawals add column if not exists network text');
  await pool.query('alter table foxpay_withdrawals add column if not exists tx_hash text');
  await pool.query("create unique index if not exists foxpay_withdrawals_one_pending_idx on foxpay_withdrawals (player_id) where status = 'pending'");

  await pool.query(`
    create table if not exists foxpay_roulette_rewards (
      id text primary key,
      package_id text not null references foxpay_packages(id),
      label text not null,
      reward_type text not null,
      amount numeric not null default 0,
      item_id text,
      weight integer not null default 1,
      active boolean not null default true,
      sort_order integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query('create index if not exists foxpay_roulette_rewards_package_idx on foxpay_roulette_rewards (package_id, sort_order)');

  await pool.query(`
    create table if not exists foxpay_roulette_settings (
      package_id text primary key references foxpay_packages(id),
      ticket_cost integer not null default 1,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists foxpay_roulette_spins (
      id text primary key,
      player_id text not null references foxpay_players(player_id),
      package_id text not null references foxpay_packages(id),
      ticket_cost integer not null default 1,
      reward_id text,
      reward_type text not null,
      reward_label text not null,
      reward_amount numeric not null default 0,
      reward_item_id text,
      credited_tokens numeric not null default 0,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query('create index if not exists foxpay_roulette_spins_player_idx on foxpay_roulette_spins (player_id, created_at desc)');

  await pool.query(`
    create table if not exists foxpay_matches (
      id text primary key,
      team_a text not null,
      team_b text not null,
      flag_a text,
      flag_b text,
      venue text,
      match_date timestamptz,
      status text not null default 'open',
      result text,
      created_at timestamptz not null default now(),
      manual_pool_a numeric not null default 0,
      manual_pool_b numeric not null default 0,
      manual_pool_draw numeric not null default 0,
      odds_team_a numeric not null default 1.10,
      odds_draw numeric not null default 3.00,
      odds_team_b numeric not null default 2.00
    )
  `);
  try {
    await pool.query('alter table foxpay_matches add column if not exists flag_a text');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists flag_b text');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists venue text');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists match_date timestamptz');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists manual_pool_a numeric not null default 0');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists manual_pool_b numeric not null default 0');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists manual_pool_draw numeric not null default 0');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists odds_team_a numeric not null default 1.10');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists odds_draw numeric not null default 3.00');
  } catch (err) {}
  try {
    await pool.query('alter table foxpay_matches add column if not exists odds_team_b numeric not null default 2.00');
  } catch (err) {}

  await pool.query(`
    create table if not exists foxpay_bets (
      id text primary key,
      match_id text not null references foxpay_matches(id),
      player_id text not null references foxpay_players(player_id),
      bet_type text not null,
      amount numeric not null,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query('create index if not exists foxpay_bets_match_idx on foxpay_bets (match_id)');
  await pool.query('create index if not exists foxpay_bets_player_idx on foxpay_bets (player_id)');

  await seedFoxPayDefaults();
  await repairFoxPayCapOverages();
}

async function ensurePlayer(playerId) {
  if (pool) {
    await pool.query(
      `insert into player_balances (player_id, balance)
       values ($1, 0)
       on conflict (player_id) do nothing`,
      [playerId],
    );
    return;
  }

  if (!balances.has(playerId)) {
    balances.set(playerId, 0);
  }
}

async function addPlayerBalance(playerId, amount) {
  await ensurePlayer(playerId);

  if (pool) {
    const result = await pool.query(
      `update player_balances
       set balance = balance + $2, updated_at = now()
       where player_id = $1
       returning balance`,
      [playerId, amount],
    );
    return Number(result.rows[0]?.balance || 0);
  }

  const nextBalance = (balances.get(playerId) || 0) + amount;
  balances.set(playerId, nextBalance);
  return nextBalance;
}

async function getPlayerBalance(playerId) {
  if (pool) {
    const result = await pool.query(
      'select balance from player_balances where player_id = $1',
      [playerId],
    );
    return Number(result.rows[0]?.balance || 0);
  }

  return balances.get(playerId) || 0;
}

async function getGameState(playerId) {
  await ensurePlayer(playerId);

  if (pool) {
    await pool.query(
      `insert into player_game_states (player_id, state)
       values ($1, '{}'::jsonb)
       on conflict (player_id) do nothing`,
      [playerId],
    );

    const result = await pool.query(
      'select state, updated_at from player_game_states where player_id = $1',
      [playerId],
    );

    return {
      state: result.rows[0]?.state || {},
      updated_at: result.rows[0]?.updated_at || null,
    };
  }

  if (!gameStates.has(playerId)) {
    gameStates.set(playerId, {});
  }

  return {
    state: gameStates.get(playerId),
    updated_at: null,
  };
}

async function saveGameState(playerId, state) {
  await ensurePlayer(playerId);

  if (pool) {
    const result = await pool.query(
      `insert into player_game_states (player_id, state, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (player_id)
       do update set state = excluded.state, updated_at = now()
       returning updated_at`,
      [playerId, JSON.stringify(state)],
    );

    return result.rows[0]?.updated_at || null;
  }

  gameStates.set(playerId, state);
  return null;
}

function foxPayDefaultSeasonSchedule(year = 2026) {
  const seasons = [
    ['frost-fox', 'Frost Fox Season', 0, 1, 3, 1, 600000, './images/UX/optimized/snowflake.webp'],
    ['blossom-quest', 'Blossom Quest Season', 3, 1, 6, 1, 600000, './images/UX/optimized/sparkle.webp'],
    ['solar-rush', 'Solar Rush Season', 6, 1, 9, 1, 600000, './images/UX/optimized/paw-badge.webp'],
    ['harvest-league', 'Harvest League Season', 9, 1, 11, 1, 400000, './images/UX/optimized/fox-gold-wreath.webp'],
    ['grand-fox-festival', 'Grand Fox Festival', 11, 1, 12, 1, 1000000, './images/UX/optimized/fox-crown-wreath.webp'],
  ];
  return seasons.map(([id, name, startMonth, startDay, endMonth, endDay, rewardTokens, imageUrl]) => {
    const start = new Date(Date.UTC(year, startMonth, startDay, 4, 0, 0));
    const end = new Date(Date.UTC(year, endMonth, endDay, 3, 59, 59));
    return {
      id: `${id}-${year}`,
      name,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      winner_limit: 20,
      reward_tokens: rewardTokens,
      reward_mode: 'competitive',
      image_url: imageUrl,
      active: true,
    };
  });
}

const foxpayDefaultReferralTicketRewards = Object.freeze({
  free: 0,
  p30: 3,
  p60: 6,
  p120: 9,
  p480: 12,
  p960: 24,
});

const foxpayDefaultReferralTaskRules = Object.freeze({
  free: { enabled: true, required: true, probability: 45, first_target: 3, repeat_target: 2, cooldown_days: 1, validation: 'created' },
  p30: { enabled: true, required: true, probability: 35, first_target: 3, repeat_target: 1, cooldown_days: 1, validation: 'created' },
  p60: { enabled: true, required: true, probability: 28, first_target: 3, repeat_target: 1, cooldown_days: 2, validation: 'created' },
  p120: { enabled: true, required: true, probability: 22, first_target: 3, repeat_target: 1, cooldown_days: 2, validation: 'created' },
  p480: { enabled: true, required: true, probability: 16, first_target: 3, repeat_target: 1, cooldown_days: 3, validation: 'created' },
  p960: { enabled: true, required: true, probability: 10, first_target: 3, repeat_target: 1, cooldown_days: 4, validation: 'created' },
});

const foxpayDefaultRanks = Object.freeze([
  { id: 'free', name: 'Free', image_url: './images/fox-optimized.webp', required_directs: 0, required_lifetime_usd: 0, team_requirements: {}, active: true, sort_order: 0 },
  { id: 'bronze-fox', name: 'Bronze Fox', image_url: './images/ranks/rankkes_02.png', required_directs: 5, required_lifetime_usd: 1000, team_requirements: {}, active: true, sort_order: 1 },
  { id: 'silver-fox', name: 'Silver Fox', image_url: './images/ranks/rankkes_03.png', required_directs: 6, required_lifetime_usd: 5000, team_requirements: { 'bronze-fox': 1 }, active: true, sort_order: 2 },
  { id: 'golden-fox', name: 'Golden Fox', image_url: './images/ranks/rankkes_04.png', required_directs: 8, required_lifetime_usd: 10000, team_requirements: { 'bronze-fox': 2 }, active: true, sort_order: 3 },
  { id: 'platinum-fang', name: 'Platinum Fang', image_url: './images/ranks/rankkes_05.png', required_directs: 10, required_lifetime_usd: 20000, team_requirements: { 'silver-fox': 1, 'bronze-fox': 2 }, active: true, sort_order: 4 },
  { id: 'royal-vulpes', name: 'Royal Vulpes', image_url: './images/ranks/rankkes_09.png', required_directs: 12, required_lifetime_usd: 50000, team_requirements: { 'silver-fox': 2, 'bronze-fox': 3 }, active: true, sort_order: 5 },
  { id: 'king-fox', name: 'King Fox', image_url: './images/ranks/rankkes_10.png', required_directs: 15, required_lifetime_usd: 100000, team_requirements: { 'golden-fox': 1, 'silver-fox': 2 }, active: true, sort_order: 6 },
  { id: 'legendary-fox', name: 'Legendary Fox', image_url: './images/ranks/rankkes_12.png', required_directs: 20, required_lifetime_usd: 200000, team_requirements: { 'golden-fox': 2, 'silver-fox': 2 }, active: true, sort_order: 7 },
  { id: 'mythic-vulpes', name: 'Mythic Vulpes', image_url: './images/ranks/rankkes_13.png', required_directs: 25, required_lifetime_usd: 500000, team_requirements: { 'king-fox': 1, 'golden-fox': 2 }, active: true, sort_order: 8 },
]);

const foxpayLeaderboardSimulatedProfiles = Object.freeze([
  { id: 'sim_us_aurora9', username: 'Aurora9', country_code: 'US', country_name: 'United States', rank_id: 'mythic-vulpes', package_id: 'p960', base_tokens: 6400000, daily_pct: 2.4 },
  { id: 'sim_de_fx91a2', username: 'FX91A2', country_code: 'DE', country_name: 'Germany', rank_id: 'legendary-fox', package_id: 'p960', base_tokens: 5750000, daily_pct: 1.9 },
  { id: 'sim_gb_novafox', username: 'NovaFox', country_code: 'GB', country_name: 'United Kingdom', rank_id: 'king-fox', package_id: 'p480', base_tokens: 4980000, daily_pct: 2.15 },
  { id: 'sim_fr_7c42e9', username: '7C42E9', country_code: 'FR', country_name: 'France', rank_id: 'royal-vulpes', package_id: 'p480', base_tokens: 4520000, daily_pct: 1.55 },
  { id: 'sim_us_miami10', username: 'Miami10', country_code: 'US', country_name: 'United States', rank_id: 'platinum-fang', package_id: 'p480', base_tokens: 4210000, daily_pct: 2.75 },
  { id: 'sim_es_iberfox', username: 'IberFox', country_code: 'ES', country_name: 'Spain', rank_id: 'golden-fox', package_id: 'p120', base_tokens: 3860000, daily_pct: 1.35 },
  { id: 'sim_it_roma88', username: 'Roma88', country_code: 'IT', country_name: 'Italy', rank_id: 'golden-fox', package_id: 'p120', base_tokens: 3510000, daily_pct: 2.05 },
  { id: 'sim_nl_euro5f', username: 'EURO5F', country_code: 'NL', country_name: 'Netherlands', rank_id: 'silver-fox', package_id: 'p120', base_tokens: 3180000, daily_pct: 1.72 },
  { id: 'sim_ca_northfox', username: 'NorthFox', country_code: 'CA', country_name: 'Canada', rank_id: 'silver-fox', package_id: 'p60', base_tokens: 2870000, daily_pct: 2.32 },
  { id: 'sim_vn_saigon8', username: 'Saigon8', country_code: 'VN', country_name: 'Vietnam', rank_id: 'golden-fox', package_id: 'p120', base_tokens: 2710000, daily_pct: 2.06 },
  { id: 'sim_se_2bd091', username: '2BD091', country_code: 'SE', country_name: 'Sweden', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 2530000, daily_pct: 1.48 },
  { id: 'sim_pt_lisboa', username: 'LisboaFox', country_code: 'PT', country_name: 'Portugal', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 2260000, daily_pct: 2.61 },
  { id: 'sim_ch_alp7x', username: 'ALP7X', country_code: 'CH', country_name: 'Switzerland', rank_id: 'silver-fox', package_id: 'p120', base_tokens: 2140000, daily_pct: 1.22 },
  { id: 'sim_mx_luna21', username: 'Luna21', country_code: 'MX', country_name: 'Mexico', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 1980000, daily_pct: 2.18 },
  { id: 'sim_br_foxrio', username: 'FoxRio', country_code: 'BR', country_name: 'Brazil', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 1840000, daily_pct: 1.64 },
  { id: 'sim_co_andes7', username: 'Andes7', country_code: 'CO', country_name: 'Colombia', rank_id: 'silver-fox', package_id: 'p120', base_tokens: 1720000, daily_pct: 2.43 },
  { id: 'sim_cl_9fd120', username: '9FD120', country_code: 'CL', country_name: 'Chile', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 1590000, daily_pct: 1.31 },
  { id: 'sim_ar_pampa4', username: 'Pampa4', country_code: 'AR', country_name: 'Argentina', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 1450000, daily_pct: 2.02 },
  { id: 'sim_pe_inka88', username: 'Inka88', country_code: 'PE', country_name: 'Peru', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 1320000, daily_pct: 1.86 },
  { id: 'sim_bo_5a91bc', username: '5A91BC', country_code: 'BO', country_name: 'Bolivia', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 1180000, daily_pct: 2.24 },
  { id: 'sim_uy_monte6', username: 'Monte6', country_code: 'UY', country_name: 'Uruguay', rank_id: 'bronze-fox', package_id: 'p60', base_tokens: 990000, daily_pct: 1.57 },
]);

const foxpaySimulatedPackageGrowth = Object.freeze({
  free: 0.82,
  p30: 0.96,
  p60: 1.06,
  p120: 1.18,
  p480: 1.34,
  p960: 1.52,
});

const foxpayDefaultSettings = {
  token_price_usd: 0.0001,
  referral_rate: 0.10,
  block_same_ip: false,
  block_same_device: false,
  daily_cycle_minutes: 1440,
  youtube_video_urls: [],
  season_name: 'Monthly Season',
  season_start_at: '',
  season_end_at: '',
  season_winner_limit: 20,
  season_reward_tokens: 0,
  season_reward_mode: 'competitive',
  season_image_url: '',
  season_paid_at: '',
  season_paid_key: '',
  season_paid_winners: [],
  season_schedule_version: '2026-themed-v1',
  season_schedule: foxPayDefaultSeasonSchedule(2026),
  withdrawal_min_usdt: 10,
  hot_wallet_network: 'BEP20',
  hot_wallet_address: '',
  hot_wallet_note: '',
  referral_ticket_rewards: foxpayDefaultReferralTicketRewards,
  unilevel_config: {
    free: [10],
    p30: [20, 3],
    p60: [20, 3, 3, 3],
    p120: [20, 3, 3, 3, 1.5, 1.5],
    p480: [20, 3, 3, 3, 1.5, 1.5, 1, 1],
    p960: [20, 3, 3, 3, 1.5, 1.5, 1, 1, 0.6, 0.6],
  },
  admin_note: 'FoxPay economy settings',
};

const foxPayMinPartialUsdt = 20;

const foxpayPaidPackageEconomy = [
  { price: 30, daily_energy: 500, tap_reward_tokens: 4 },
  { price: 60, daily_energy: 800, tap_reward_tokens: 5 },
  { price: 120, daily_energy: 1000, tap_reward_tokens: 8 },
  { price: 480, daily_energy: 1600, tap_reward_tokens: 20 },
  { price: 960, daily_energy: 2000, tap_reward_tokens: 32 },
];

const foxpayDefaultPackages = [
  {
    id: 'free',
    name: 'Free Tap',
    price_usdt: 0,
    max_multiplier: 0,
    monthly_cap_usd: 3,
    daily_energy: 300,
    tap_reward_tokens: 1,
    icon_url: '',
    video_urls: [],
    active: true,
    sort_order: 0,
  },
  ...foxpayPaidPackageEconomy.map((item, index) => ({
    price_usdt: item.price,
    id: `p${item.price}`,
    name: `${item.price} USDT Pack`,
    max_multiplier: 3,
    monthly_cap_usd: item.price * 3,
    daily_energy: item.daily_energy,
    tap_reward_tokens: item.tap_reward_tokens,
    icon_url: '',
    video_urls: [],
    active: true,
    sort_order: index + 1,
  })),
];

const foxpaySeedVideoLibrary = [
  { language: 'es', title: 'Bitcoin para empezar', url: 'https://www.youtube.com/watch?v=SIaAsACeRXI' },
  { language: 'es', title: 'Guardar bitcoin seguro', url: 'https://www.youtube.com/watch?v=B0bxTi3YV7E' },
  { language: 'es', title: 'Primera wallet Bitcoin', url: 'https://www.youtube.com/watch?v=xTG2XapXDvk' },
  { language: 'es', title: 'Wallets Bitcoin guia', url: 'https://www.youtube.com/watch?v=t3fqo9B0-sA' },
  { language: 'es', title: 'Software wallet Bitcoin', url: 'https://www.youtube.com/watch?v=f35i4EPQRMY' },
  { language: 'es', title: 'Bitcoin al iniciar', url: 'https://www.youtube.com/watch?v=UgchKoQRzE8' },
  { language: 'es', title: 'Educacion Bitcoin', url: 'https://www.youtube.com/watch?v=LcuXsTZXjiA' },
  { language: 'es', title: 'Bitcoin y educacion financiera', url: 'https://www.youtube.com/watch?v=GU1tm7FbE04' },
  { language: 'es', title: 'Instalar wallet Bitcoin', url: 'https://www.youtube.com/watch?v=7p9Py2XUOZo' },
  { language: 'es', title: 'BlueWallet tutorial', url: 'https://www.youtube.com/watch?v=HuuojmWtsYE' },
  { language: 'es', title: 'Dudas comunes sobre Bitcoin', url: 'https://www.youtube.com/watch?v=R_-ovKPYhvQ' },
  { language: 'es', title: 'Formatos de direccion Bitcoin', url: 'https://www.youtube.com/watch?v=CzynlaxAza4' },
  { language: 'en', title: 'Introduction to Bitcoin', url: 'https://www.youtube.com/watch?v=l1si5ZWLgy0' },
  { language: 'en', title: 'Bitcoin explained simply', url: 'https://www.youtube.com/watch?v=UlKZ83REIkA' },
  { language: 'en', title: 'Bitcoin vs Blockchain', url: 'https://www.youtube.com/watch?v=kHbtp7pOftU' },
  { language: 'en', title: 'Crypto wallet basics', url: 'https://www.youtube.com/watch?v=SQyg9pyJ1Ac' },
  { language: 'en', title: 'Stablecoins explained', url: 'https://www.youtube.com/watch?v=pGzfexGmuVw' },
  { language: 'en', title: 'Decentralized exchanges', url: 'https://www.youtube.com/watch?v=2tTVJL4bpTU' },
  { language: 'en', title: 'DeFi explained', url: 'https://www.youtube.com/watch?v=k9HYC0EJU6E' },
  { language: 'en', title: 'Liquidity pools', url: 'https://www.youtube.com/watch?v=cizLhxSKrAc' },
  { language: 'en', title: 'Blockchain explained', url: 'https://www.youtube.com/watch?v=kHybf1aC-jE' },
  { language: 'en', title: 'Bitcoin wallet', url: 'https://www.youtube.com/watch?v=WGpatcqhArU' },
  { language: 'en', title: 'Bitcoin mining basics', url: 'https://www.youtube.com/watch?v=mrtSAgcpack' },
  { language: 'en', title: 'What is Bitcoin', url: 'https://www.youtube.com/watch?v=41JCpzvnn_0' },
  { language: 'pt', title: 'O que e Bitcoin', url: 'https://www.youtube.com/watch?v=6Ly0L8_9Pu8' },
  { language: 'pt', title: 'Bitcoin para iniciantes', url: 'https://www.youtube.com/watch?v=lEbHIyekm4M' },
  { language: 'pt', title: 'Carteiras de criptomoedas', url: 'https://www.youtube.com/watch?v=6iTnwezxQhs' },
  { language: 'pt', title: 'Guardar Bitcoin', url: 'https://www.youtube.com/watch?v=cUTJOPAI0Wg' },
  { language: 'pt', title: 'Blockchain facil', url: 'https://www.youtube.com/watch?v=dkElPTevoR4' },
  { language: 'pt', title: 'Seeds de recuperacao', url: 'https://www.youtube.com/watch?v=KVzIdVD_RSg' },
  { language: 'pt', title: 'Guia de wallet Bitcoin', url: 'https://www.youtube.com/watch?v=qGqr7qfhutc' },
  { language: 'pt', title: 'Celular como hardwallet', url: 'https://www.youtube.com/watch?v=9BtnKajKqgM' },
  { language: 'pt', title: 'Dudas sobre wallets Bitcoin', url: 'https://www.youtube.com/watch?v=bq6lMkvq_1o' },
  { language: 'pt', title: 'BlueWallet cold wallet', url: 'https://www.youtube.com/watch?v=PUOGHgHtfj4' },
  { language: 'pt', title: 'Carteira fria e passphrase', url: 'https://www.youtube.com/watch?v=Va42n_wprWA' },
  { language: 'pt', title: 'BlueWallet Bitcoin e Lightning', url: 'https://www.youtube.com/watch?v=pJMDWel_9k0' },
];

function seededFoxpayVideoTasks() {
  return foxpaySeedVideoLibrary.map((video) => ({
    title: video.title,
    url: video.url,
    language: video.language,
    active: true,
    watch_seconds: 30,
    reward_delay_seconds: 30,
    reward_tokens: 0,
  }));
}

function foxpayVideoRangeForPackageId(packageId) {
  const id = String(packageId || '');
  if (id === 'free') return { min: 4, max: 6 };
  if (id === 'p30') return { min: 3, max: 5 };
  if (id === 'p60') return { min: 2, max: 4 };
  if (id === 'p120') return { min: 2, max: 3 };
  if (id === 'p480') return { min: 1, max: 2 };
  return { min: 1, max: 1 };
}

function defaultReferralTaskRule(packageId = 'free') {
  return {
    ...(foxpayDefaultReferralTaskRules[packageId] || foxpayDefaultReferralTaskRules.p960),
  };
}

function mergeFoxpaySeedVideoConfig(currentConfig = {}, packageId = '') {
  const rawConfig = parseJsonObject(currentConfig || {});
  const rawReferralTask = parseJsonObject(rawConfig.referral_task || {});
  const current = normalizePackageTaskConfig(currentConfig || {});
  const referralTask = Object.keys(rawReferralTask).length
    ? normalizeReferralTaskConfig(rawReferralTask, packageId)
    : defaultReferralTaskRule(packageId);
  const urls = new Set(current.videos.map((video) => String(video.url || '').trim()).filter(Boolean));
  const seedVideos = seededFoxpayVideoTasks()
    .filter((video) => !urls.has(video.url))
    .map((video) => {
      urls.add(video.url);
      return video;
    });
  const range = foxpayVideoRangeForPackageId(packageId);
  return normalizePackageTaskConfig({
    ...current,
    daily_video_min: current.daily_video_min > 0 ? current.daily_video_min : range.min,
    daily_video_max: current.daily_video_max > 0 ? current.daily_video_max : range.max,
    videos: [...current.videos, ...seedVideos],
    socials: current.socials,
    referral_task: referralTask,
  });
}

const foxpayStandardPackageEconomy = foxpayDefaultPackages.map((pack) => ({
  id: pack.id,
  price_usdt: pack.price_usdt,
  max_multiplier: pack.max_multiplier,
  monthly_cap_usd: pack.monthly_cap_usd,
  daily_energy: pack.daily_energy,
  tap_reward_tokens: pack.tap_reward_tokens,
  sort_order: pack.sort_order,
}));

const foxPayAvatarPriceTokens = (priceUsdt) => Math.max(0, Math.ceil(toNumber(priceUsdt, 0) / foxpayDefaultSettings.token_price_usd));

const foxPayAvatarDefaults = [
  ['fox-default', 'Fox Starter', './images/fox-optimized.webp', 0, true],
  ['street-fox', 'Street Fox', './images/UX/avatars/optimized/userdata_03.png', 0, true],
  ['builder-fox', 'Builder Fox', './images/UX/avatars/optimized/userdata_05.png', 0, true],
  ['muscle-fox', 'Muscle Fox', './images/UX/avatars/optimized/userdata_08.png', 5, false],
  ['executive-fox', 'Executive Fox', './images/UX/avatars/optimized/userdata_11.png', 8, false],
  ['runner-fox', 'Runner Fox', './images/UX/avatars/optimized/userdata_17.png', 12, false],
  ['chef-fox', 'Chef Fox', './images/UX/avatars/optimized/userdata_18.png', 18, false],
  ['gamer-fox', 'Gamer Fox', './images/UX/avatars/optimized/userdata_20.png', 25, false],
  ['doctor-fox', 'Doctor Fox', './images/UX/avatars/optimized/userdata_23.png', 35, false],
  ['pilot-fox', 'Pilot Fox', './images/UX/avatars/optimized/userdata_29.png', 50, false],
  ['royal-fox', 'Royal Fox', './images/UX/avatars/optimized/userdata_31.png', 70, false],
  ['detective-fox', 'Detective Fox', './images/UX/avatars/optimized/userdata_32.png', 85, false],
  ['dj-fox', 'DJ Fox', './images/UX/avatars/optimized/userdata_34.png', 100, false],
];

const foxpayDefaultAvatars = foxPayAvatarDefaults.map(([id, name, image_url, price_usdt, is_free], index) => ({
  id,
  name,
  image_url,
  price_tokens: foxPayAvatarPriceTokens(price_usdt),
  price_usdt,
  is_free,
  active: true,
  sort_order: index,
}));

function foxPaySuggestedSkinPriceUsdt(tapBonusPerDay) {
  const generatedUsdt = Math.max(0, Number(tapBonusPerDay || 0)) * foxpayDefaultSettings.token_price_usd * 450;
  return Math.ceil((generatedUsdt * 0.55) * 20) / 20;
}

const foxpayDefaultSkins = [
  ['basic-ember-03', 'Basic Ember', 'skinbasic_03.webp', 8, ['free', 'p30']],
  ['basic-spark-05', 'Basic Spark', 'skinbasic_05.webp', 8, ['free', 'p30']],
  ['basic-neon-06', 'Basic Neon', 'skinbasic_06.webp', 10, ['free', 'p30']],
  ['basic-ruby-07', 'Basic Ruby', 'skinbasic_07.webp', 10, ['free', 'p30']],
  ['basic-aqua-08', 'Basic Aqua', 'skinbasic_08.webp', 12, ['free', 'p30']],
  ['basic-lime-13', 'Basic Lime', 'skinbasic_13.webp', 12, ['free', 'p30', 'p60']],
  ['basic-solar-14', 'Basic Solar', 'skinbasic_14.webp', 14, ['free', 'p30', 'p60']],
  ['basic-frost-16', 'Basic Frost', 'skinbasic_16.webp', 14, ['p30', 'p60']],
  ['basic-shadow-17', 'Basic Shadow', 'skinbasic_17.webp', 16, ['p30', 'p60']],
  ['basic-royal-18', 'Basic Royal', 'skinbasic_18.webp', 16, ['p30', 'p60']],
  ['super-flare-02', 'Super Flare', 'skinsup_02.webp', 30, ['p60', 'p120']],
  ['super-pulse-07', 'Super Pulse', 'skinsup_07.webp', 30, ['p60', 'p120']],
  ['super-blaze-08', 'Super Blaze', 'skinsup_08.webp', 35, ['p60', 'p120']],
  ['super-storm-09', 'Super Storm', 'skinsup_09.webp', 35, ['p60', 'p120']],
  ['super-orbit-16', 'Super Orbit', 'skinsup_16.webp', 40, ['p120', 'p480']],
  ['super-aurora-19', 'Super Aurora', 'skinsup_19.webp', 40, ['p120', 'p480']],
  ['super-crown-21', 'Super Crown', 'skinsup_21.webp', 45, ['p120', 'p480']],
  ['super-phantom-22', 'Super Phantom', 'skinsup_22.webp', 45, ['p120', 'p480']],
  ['elite-flare-02', 'Elite Flare', 'skinsup2_02.webp', 80, ['p480', 'p960']],
  ['elite-pulse-03', 'Elite Pulse', 'skinsup2_03.webp', 80, ['p480', 'p960']],
  ['elite-blaze-05', 'Elite Blaze', 'skinsup2_05.webp', 90, ['p480', 'p960']],
  ['elite-storm-06', 'Elite Storm', 'skinsup2_06.webp', 90, ['p480', 'p960']],
  ['elite-orbit-07', 'Elite Orbit', 'skinsup2_07.webp', 100, ['p480', 'p960']],
  ['elite-aurora-10', 'Elite Aurora', 'skinsup2_10.webp', 100, ['p480', 'p960']],
  ['elite-crown-12', 'Elite Crown', 'skinsup2_12.webp', 120, ['p960']],
  ['elite-phantom-13', 'Elite Phantom', 'skinsup2_13.webp', 120, ['p960']],
  ['elite-nova-14', 'Elite Nova', 'skinsup2_14.webp', 140, ['p960']],
  ['elite-omega-16', 'Elite Omega', 'skinsup2_16.webp', 160, ['p960']],
].map(([id, name, file, tap_bonus_per_day, roulette_package_ids], index) => ({
  id,
  name,
  image_url: `./images/skin/optimized/${file}`,
  price_usdt: foxPaySuggestedSkinPriceUsdt(tap_bonus_per_day),
  tap_bonus_per_day,
  roulette_package_ids,
  active: true,
  sort_order: index + 1,
}));

const foxpayDefaultRouletteSettings = [
  { package_id: 'free', ticket_cost: 1 },
  { package_id: 'p30', ticket_cost: 1 },
  { package_id: 'p60', ticket_cost: 2 },
  { package_id: 'p120', ticket_cost: 3 },
  { package_id: 'p480', ticket_cost: 4 },
  { package_id: 'p960', ticket_cost: 6 },
];

const foxpayTokensFromUsdt = (usdt) => Math.max(1, Math.round(Number(usdt || 0) / foxpayDefaultSettings.token_price_usd));

const foxpayRouletteNoPrizeRewards = (package_id, start = 1) => [
  { package_id, label: 'Keep trying', reward_type: 'none', amount: 0, item_id: '', weight: 34, active: true, sort_order: start },
  { package_id, label: 'Almost!', reward_type: 'none', amount: 0, item_id: '', weight: 26, active: true, sort_order: start + 1 },
  { package_id, label: 'No prize', reward_type: 'none', amount: 0, item_id: '', weight: 23, active: true, sort_order: start + 2 },
  { package_id, label: 'Next time', reward_type: 'none', amount: 0, item_id: '', weight: 19, active: true, sort_order: start + 3 },
  { package_id, label: 'Empty', reward_type: 'none', amount: 0, item_id: '', weight: 16, active: true, sort_order: start + 4 },
  { package_id, label: 'Miss', reward_type: 'none', amount: 0, item_id: '', weight: 14, active: true, sort_order: start + 5 },
];

const foxpayRouletteTicketRewards = (package_id, values, start) => values.map((tickets, index) => ({
  package_id,
  label: `+${tickets} ticket${tickets === 1 ? '' : 's'}`,
  reward_type: 'tickets',
  amount: tickets,
  item_id: '',
  weight: Math.max(2, 12 - (index * 3)),
  active: true,
  sort_order: start + index,
}));

const foxpayRouletteTokenRewards = (package_id, usdtValues, start) => usdtValues.map((usdt, index) => ({
  package_id,
  label: `${usdt} USDT`,
  reward_type: 'tokens',
  amount: foxpayTokensFromUsdt(usdt),
  item_id: '',
  weight: Math.max(1, 10 - (index * 2)),
  active: true,
  sort_order: start + index,
}));

const foxpayRouletteItemRewards = (package_id, type, ids, start) => ids.map((item_id, index) => ({
  package_id,
  label: type === 'skin' ? (index % 2 ? 'Rare skin' : 'Skin') : (index % 2 ? 'Rare avatar' : 'Avatar'),
  reward_type: type,
  amount: 0,
  item_id,
  weight: Math.max(1, 5 - index),
  active: true,
  sort_order: start + index,
}));

const foxpayDefaultRouletteRewards = [
  ...foxpayRouletteNoPrizeRewards('free', 1),
  ...foxpayRouletteTicketRewards('free', [1, 1, 2, 1], 20),
  ...foxpayRouletteTokenRewards('free', [0.0001, 0.0005, 0.001, 0.002, 0.003], 40),
  ...[
    {
      package_id: 'p30',
      tickets: [1, 2, 3],
      usdt: [0.01, 0.03, 0.05],
      skins: ['basic-frost-16', 'basic-shadow-17', 'basic-royal-18'],
      avatars: ['street-fox', 'builder-fox'],
    },
    {
      package_id: 'p60',
      tickets: [1, 2, 4],
      usdt: [0.03, 0.06, 0.12],
      skins: ['super-flare-02', 'super-pulse-07', 'super-blaze-08'],
      avatars: ['muscle-fox', 'runner-fox'],
    },
    {
      package_id: 'p120',
      tickets: [2, 3, 5],
      usdt: [0.1, 0.2, 0.5],
      skins: ['super-orbit-16', 'super-aurora-19', 'super-crown-21'],
      avatars: ['executive-fox', 'gamer-fox'],
    },
    {
      package_id: 'p480',
      tickets: [2, 4, 8],
      usdt: [0.5, 1, 3, 5],
      skins: ['elite-flare-02', 'elite-pulse-03', 'elite-blaze-05', 'elite-storm-06'],
      avatars: ['doctor-fox', 'pilot-fox'],
    },
    {
      package_id: 'p960',
      tickets: [3, 6, 12],
      usdt: [1, 3, 8, 20],
      skins: ['elite-crown-12', 'elite-phantom-13', 'elite-nova-14', 'elite-omega-16'],
      avatars: ['royal-fox', 'detective-fox', 'dj-fox'],
    },
  ].flatMap(({ package_id, tickets, usdt, skins, avatars }) => [
    ...foxpayRouletteNoPrizeRewards(package_id, 1),
    ...foxpayRouletteTicketRewards(package_id, tickets, 20),
    ...foxpayRouletteTokenRewards(package_id, usdt, 40),
    ...foxpayRouletteItemRewards(package_id, 'skin', skins, 60),
    ...foxpayRouletteItemRewards(package_id, 'avatar', avatars, 80),
  ]),
];

const foxpayLegacyRouletteRewards = [
  { package_id: 'free', label: '1 FOX', reward_type: 'tokens', sort_order: 1 },
  { package_id: 'free', label: '1 ticket', reward_type: 'tickets', sort_order: 2 },
  { package_id: 'free', label: 'Try again', reward_type: 'none', sort_order: 3 },
  { package_id: 'free', label: 'Free extra spin', reward_type: 'tickets', sort_order: 3 },
  { package_id: 'free', label: 'Basic Ember skin', reward_type: 'skin', sort_order: 5 },
  { package_id: 'free', label: '+1 spin', reward_type: 'tickets', sort_order: 7 },
  { package_id: 'free', label: '+1 ticket', reward_type: 'tickets', sort_order: 8 },
  { package_id: 'free', label: '2 FOX', reward_type: 'tokens', sort_order: 9 },
  { package_id: 'free', label: '5 FOX', reward_type: 'tokens', sort_order: 10 },
  { package_id: 'free', label: 'Ember skin', reward_type: 'skin', sort_order: 11 },
  { package_id: 'free', label: 'Spark skin', reward_type: 'skin', sort_order: 12 },
  ...[
    ['p30', 5, 2],
    ['p60', 10, 3],
    ['p120', 20, 4],
    ['p480', 80, 8],
    ['p960', 160, 12],
  ].flatMap(([package_id, fox, tickets]) => [
    { package_id, label: `${fox} FOX`, reward_type: 'tokens', sort_order: 1 },
    { package_id, label: `${tickets} tickets`, reward_type: 'tickets', sort_order: 2 },
    { package_id, label: 'Try again', reward_type: 'none', sort_order: 3 },
  ]),
  ...['p30', 'p60', 'p120', 'p480', 'p960'].flatMap((package_id) => [
    { package_id, label: 'No prize this time', reward_type: 'none', sort_order: 3 },
    { package_id, label: 'Free extra spin', reward_type: 'tickets', sort_order: 4 },
    { package_id, label: 'Skin reward', reward_type: 'skin', sort_order: 6 },
  ]),
  ...[
    ['p30', 20, 45, 1],
    ['p60', 40, 90, 1],
    ['p120', 80, 160, 2],
    ['p480', 180, 360, 2],
    ['p960', 320, 640, 3],
  ].flatMap(([package_id, foxSmall, foxBig, tickets]) => [
    { package_id, label: '+1 spin', reward_type: 'tickets', sort_order: 7 },
    { package_id, label: `+${tickets} tickets`, reward_type: 'tickets', sort_order: 8 },
    { package_id, label: `${foxSmall} FOX`, reward_type: 'tokens', sort_order: 9 },
    { package_id, label: `${foxBig} FOX`, reward_type: 'tokens', sort_order: 10 },
    { package_id, label: 'Skin', reward_type: 'skin', sort_order: 11 },
    { package_id, label: 'Rare skin', reward_type: 'skin', sort_order: 12 },
  ]),
];

const foxpayDailyTaskDefinitions = [
  { id: 'daily_check', title: 'Daily check-in', description: 'Activate today session', reward_tokens: 0 },
  { id: 'tap_goal', title: 'Tap 100 times', description: 'Complete the daily tap cycle', reward_tokens: 0, goal: 100 },
  { id: 'youtube', title: 'Watch YouTube video', description: 'Watch the daily video task', reward_tokens: 0 },
];

const foxpayDailyTaskTicketFlag = '__daily_task_ticket_awarded';
const foxpaySkinTapsClaimedSkinsFlag = '__skin_taps_claimed_skins';

const countryNames = new Map([
  ['US', 'United States'],
  ['BO', 'Bolivia'],
  ['EC', 'Ecuador'],
  ['CO', 'Colombia'],
  ['PE', 'Peru'],
  ['CL', 'Chile'],
  ['AR', 'Argentina'],
  ['MX', 'Mexico'],
  ['BR', 'Brazil'],
  ['ES', 'Spain'],
  ['VE', 'Venezuela'],
  ['PA', 'Panama'],
  ['CR', 'Costa Rica'],
  ['DO', 'Dominican Republic'],
  ['GT', 'Guatemala'],
  ['HN', 'Honduras'],
  ['SV', 'El Salvador'],
  ['PY', 'Paraguay'],
  ['UY', 'Uruguay'],
]);

function foxPayDailyCycleMinutes(settings = foxpayDefaultSettings) {
  return Math.max(1, Math.min(1440, Math.floor(toNumber(settings.daily_cycle_minutes, 1440))));
}

function foxpayTodayKey(settings = foxpayDefaultSettings) {
  return foxpayCycleKeyForTime(settings, Date.now());
}

function foxpayCycleKeyForTime(settings = foxpayDefaultSettings, time = Date.now()) {
  const minutes = foxPayDailyCycleMinutes(settings);
  const timestamp = Number(time instanceof Date ? time.getTime() : time);
  const safeTime = Number.isFinite(timestamp) ? timestamp : Date.now();
  if (minutes >= 1440) return new Date(safeTime).toISOString().slice(0, 10);
  return `m${minutes}_${Math.floor(safeTime / (minutes * 60000))}`;
}

function foxpayDayDiff(leftKey, rightKey) {
  const leftCycle = String(leftKey || '').match(/^m(\d+)_(\d+)$/);
  const rightCycle = String(rightKey || '').match(/^m(\d+)_(\d+)$/);
  if (leftCycle && rightCycle && leftCycle[1] === rightCycle[1]) {
    return Number(leftCycle[2]) - Number(rightCycle[2]);
  }
  const left = Date.parse(`${leftKey || ''}T00:00:00.000Z`);
  const right = Date.parse(`${rightKey || ''}T00:00:00.000Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.round((left - right) / 86400000);
}

function foxPayVisibleStreak(player, today = foxpayTodayKey()) {
  const lastKey = String(player?.streak_last_key || '');
  const days = Math.max(0, Number(player?.streak_days || 0));
  const diff = foxpayDayDiff(today, lastKey);
  return diff === 0 || diff === 1 ? days : 0;
}

function markFoxPayDailyStreak(player, today = foxpayTodayKey()) {
  const lastKey = String(player?.streak_last_key || '');
  if (lastKey === today) {
    player.streak_days = foxPayVisibleStreak(player, today);
    return player.streak_days;
  }
  const diff = foxpayDayDiff(today, lastKey);
  player.streak_days = diff === 1 ? Math.max(0, Number(player.streak_days || 0)) + 1 : 1;
  player.streak_last_key = today;
  return player.streak_days;
}

function foxpayPurchaseId() {
  return `fp_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundUsdtCents(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function ceilUsdtCents(value) {
  return Math.ceil((toNumber(value) - 1e-9) * 100) / 100;
}

function firstHeaderValue(request, names) {
  for (const name of names) {
    const value = request.headers[name];
    if (Array.isArray(value) && value.length) return value[0];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function getClientIp(request) {
  const raw = firstHeaderValue(request, [
    'cf-connecting-ip',
    'x-real-ip',
    'x-client-ip',
    'x-forwarded-for',
    'forwarded',
  ]);
  if (!raw) return request.socket?.remoteAddress || '';
  if (raw.toLowerCase().startsWith('for=')) {
    return raw.split(';')[0].replace(/^for=/i, '').replaceAll('"', '').trim();
  }
  return raw.split(',')[0].trim();
}

function getRequestCountry(request) {
  const code = firstHeaderValue(request, [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'x-country-code',
    'cloudfront-viewer-country',
  ]).toUpperCase();
  const safeCode = /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : '';
  return {
    code: safeCode,
    name: safeCode ? (countryNames.get(safeCode) || safeCode) : '',
  };
}

function normalizePublicIp(value) {
  const ip = String(value || '').trim().replace(/^::ffff:/, '');
  if (
    !ip
    || ip === '127.0.0.1'
    || ip === '::1'
    || ip.startsWith('10.')
    || ip.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  ) {
    return '';
  }
  return ip;
}

async function lookupCountryByIp(ip) {
  const publicIp = normalizePublicIp(ip);
  if (!publicIp) return { code: '', name: '' };
  if (countryLookupCache.has(publicIp)) return countryLookupCache.get(publicIp);

  const fallback = { code: '', name: '' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(publicIp)}/json/`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error('country_lookup_failed');
    const data = await response.json();
    const code = String(data.country_code || '').toUpperCase();
    const result = /^[A-Z]{2}$/.test(code)
      ? { code, name: String(data.country_name || countryNames.get(code) || code) }
      : fallback;
    countryLookupCache.set(publicIp, result);
    return result;
  } catch {
    countryLookupCache.set(publicIp, fallback);
    return fallback;
  }
}

async function getFoxPayRequestMeta(request) {
  const headerCountry = getRequestCountry(request);
  const userAgent = String(request.headers['user-agent'] || '').slice(0, 500);
  const signupIp = getClientIp(request);
  const country = headerCountry.code ? headerCountry : await lookupCountryByIp(signupIp);
  return {
    signup_ip: signupIp,
    country_code: country.code,
    country_name: country.name,
    user_agent: userAgent,
    device_label: detectDeviceLabel(userAgent),
  };
}

function detectDeviceLabel(userAgent) {
  const value = String(userAgent || '');
  const platform = /iPhone/i.test(value)
    ? 'iPhone'
    : /iPad/i.test(value)
      ? 'iPad'
      : /Android/i.test(value)
        ? 'Android'
        : /Windows/i.test(value)
          ? 'Windows'
          : /Mac OS X|Macintosh/i.test(value)
            ? 'Mac'
            : /Linux/i.test(value)
              ? 'Linux'
              : 'Unknown';
  const browser = /Edg\//i.test(value)
    ? 'Edge'
    : /OPR\//i.test(value)
      ? 'Opera'
      : /Chrome\//i.test(value)
        ? 'Chrome'
        : /Safari\//i.test(value) && !/Chrome\//i.test(value)
          ? 'Safari'
          : /Firefox\//i.test(value)
            ? 'Firefox'
            : 'Browser';
  return `${platform} / ${browser}`;
}

function foxpaySettingsFromMemory() {
  if (!foxpaySettingsMemory.has('settings')) {
    foxpaySettingsMemory.set('settings', { ...foxpayDefaultSettings });
  }
  const stored = foxpaySettingsMemory.get('settings');
  const scheduleVersion = String(stored.season_schedule_version || '');
  return applyFoxPaySeasonSchedule({
    ...foxpayDefaultSettings,
    ...stored,
    season_schedule_version: foxpayDefaultSettings.season_schedule_version,
    season_schedule: scheduleVersion === foxpayDefaultSettings.season_schedule_version
      ? stored.season_schedule
      : foxpayDefaultSettings.season_schedule,
    referral_ticket_rewards: normalizeReferralTicketRewards(stored.referral_ticket_rewards),
  });
}

async function seedFoxPayDefaults() {
  if (!pool) {
    if (!foxpayPackagesMemory.size) {
      foxpayDefaultPackages.forEach((pack) => foxpayPackagesMemory.set(pack.id, { ...pack }));
    }
    if (!foxpayAvatarsMemory.size) {
      foxpayDefaultAvatars.forEach((avatar) => foxpayAvatarsMemory.set(avatar.id, { ...avatar }));
    }
    if (!foxpaySkinsMemory.size) {
      foxpayDefaultSkins.forEach((skin) => foxpaySkinsMemory.set(skin.id, { ...skin }));
    }
    if (!foxpayRanksMemory.size) {
      foxpayDefaultRanks.forEach((rank) => foxpayRanksMemory.set(rank.id, { ...rank, team_requirements: { ...(rank.team_requirements || {}) } }));
    }
    if (!foxpayRouletteSettingsMemory.size) {
      foxpayDefaultRouletteSettings.forEach((setting) => foxpayRouletteSettingsMemory.set(setting.package_id, { ...setting }));
    }
    if (!foxpaySettingsMemory.has('video_task_library_seed_20260523_v1')) {
      for (const [id, pack] of foxpayPackagesMemory.entries()) {
        foxpayPackagesMemory.set(id, {
          ...pack,
          task_config: mergeFoxpaySeedVideoConfig(pack.task_config || {}, id),
          video_urls: [],
        });
      }
      foxpaySettingsMemory.set('video_task_library_seed_20260523_v1', { applied_at: new Date().toISOString() });
    }
    foxpaySettingsFromMemory();
    await seedWorldCupMatches();
    return;
  }

  await pool.query(
    `insert into foxpay_settings (key, value)
     values ('economy', $1::jsonb)
     on conflict (key) do nothing`,
    [JSON.stringify(foxpayDefaultSettings)],
  );

  for (const pack of foxpayDefaultPackages) {
    await pool.query(
      `insert into foxpay_packages
       (id, name, price_usdt, max_multiplier, monthly_cap_usd, daily_energy, tap_reward_tokens, icon_url, video_urls, active, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       on conflict (id) do nothing`,
      [
        pack.id,
        pack.name,
        pack.price_usdt,
        pack.max_multiplier,
        pack.monthly_cap_usd,
        pack.daily_energy,
        pack.tap_reward_tokens,
        pack.icon_url || '',
        JSON.stringify(pack.video_urls || []),
        pack.active,
        pack.sort_order,
      ],
    );
  }
  const economyMigration = await pool.query("select 1 from foxpay_settings where key = 'package_economy_15_months_v1' limit 1");
  if (!economyMigration.rowCount) {
    for (const pack of foxpayStandardPackageEconomy) {
      await pool.query(
        `update foxpay_packages
         set price_usdt = $2,
             max_multiplier = $3,
             monthly_cap_usd = $4,
             daily_energy = $5,
             tap_reward_tokens = $6,
             sort_order = $7,
             updated_at = now()
         where id = $1`,
        [
          pack.id,
          pack.price_usdt,
          pack.max_multiplier,
          pack.monthly_cap_usd,
          pack.daily_energy,
          pack.tap_reward_tokens,
          pack.sort_order,
        ],
      );
    }
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('package_economy_15_months_v1', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), packages: foxpayStandardPackageEconomy })],
    );
  }

  const videoLibraryMigration = await pool.query("select 1 from foxpay_settings where key = 'video_task_library_seed_20260523_v1' limit 1");
  if (!videoLibraryMigration.rowCount) {
    const packageRows = await pool.query('select id, task_config from foxpay_packages');
    for (const row of packageRows.rows) {
      const taskConfig = mergeFoxpaySeedVideoConfig(row.task_config || {}, row.id);
      await pool.query(
        `update foxpay_packages
         set video_urls = '[]'::jsonb,
             task_config = $2::jsonb,
             updated_at = now()
         where id = $1`,
        [row.id, JSON.stringify(taskConfig)],
      );
    }
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('video_task_library_seed_20260523_v1', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), videos: foxpaySeedVideoLibrary.length })],
    );
  }

  for (const avatar of foxpayDefaultAvatars) {
    await pool.query(
      `insert into foxpay_avatars
       (id, name, image_url, price_tokens, price_usdt, is_free, active, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do nothing`,
      [avatar.id, avatar.name, avatar.image_url, avatar.price_tokens, avatar.price_usdt, avatar.is_free, avatar.active, avatar.sort_order],
    );
  }
  await pool.query(
    `update foxpay_avatars
     set image_url = replace(image_url, './images/UX/avatars/', './images/UX/avatars/optimized/'), updated_at = now()
     where image_url like './images/UX/avatars/userdata_%.png'
       and image_url not like './images/UX/avatars/optimized/%'`,
  );
  await pool.query(
    `update foxpay_avatars
     set image_url = './images/fox-optimized.webp', updated_at = now()
     where id = 'fox-default' and image_url = './images/fox.png'`,
  );
  const avatarPricingMigration = await pool.query("select 1 from foxpay_settings where key = 'avatar_pricing_v1' limit 1");
  if (!avatarPricingMigration.rowCount) {
    for (const avatar of foxpayDefaultAvatars) {
      await pool.query(
        `update foxpay_avatars
         set price_tokens = $2,
             price_usdt = $3,
             is_free = $4,
             sort_order = $5,
             updated_at = now()
         where id = $1`,
        [avatar.id, avatar.price_tokens, avatar.price_usdt, avatar.is_free, avatar.sort_order],
      );
    }
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('avatar_pricing_v1', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), avatars: foxpayDefaultAvatars.map(({ id, price_usdt, is_free }) => ({ id, price_usdt, is_free })) })],
    );
  }

  for (const skin of foxpayDefaultSkins) {
    await pool.query(
      `insert into foxpay_skins
       (id, name, image_url, price_usdt, tap_bonus_per_day, roulette_package_ids, active, sort_order)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       on conflict (id) do nothing`,
      [skin.id, skin.name, skin.image_url, skin.price_usdt, skin.tap_bonus_per_day, JSON.stringify(skin.roulette_package_ids || []), skin.active, skin.sort_order],
    );
  }

  for (const rank of foxpayDefaultRanks) {
    await pool.query(
      `insert into foxpay_ranks
       (id, name, image_url, required_directs, required_lifetime_usd, team_requirements, active, sort_order)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       on conflict (id) do nothing`,
      [rank.id, rank.name, rank.image_url, rank.required_directs, rank.required_lifetime_usd, JSON.stringify(rank.team_requirements || {}), rank.active, rank.sort_order],
    );
  }
  const rankImageMigration = await pool.query("select 1 from foxpay_settings where key = 'rank_images_from_assets_v1' limit 1");
  if (!rankImageMigration.rowCount) {
    for (const rank of foxpayDefaultRanks) {
      await pool.query(
        `update foxpay_ranks
         set image_url = $2,
             updated_at = now()
         where id = $1
           and (image_url = '' or image_url like './images/UX/%')`,
        [rank.id, rank.image_url],
      );
    }
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('rank_images_from_assets_v1', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), source: './images/ranks', ranks: foxpayDefaultRanks.map(({ id, image_url }) => ({ id, image_url })) })],
    );
  }
  const rankImageCorrection = await pool.query("select 1 from foxpay_settings where key = 'rank_images_from_assets_v2' limit 1");
  if (!rankImageCorrection.rowCount) {
    for (const rank of foxpayDefaultRanks) {
      await pool.query(
        `update foxpay_ranks
         set image_url = $2,
             updated_at = now()
         where id = $1`,
        [rank.id, rank.image_url],
      );
    }
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('rank_images_from_assets_v2', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), source: 'corrected_rank_image_mapping', ranks: foxpayDefaultRanks.map(({ id, image_url }) => ({ id, image_url })) })],
    );
  }
  const skinPriceMigration = await pool.query("select 1 from foxpay_settings where key = 'skin_price_55_percent_v1' limit 1");
  if (!skinPriceMigration.rowCount) {
    for (const skin of foxpayDefaultSkins) {
      await pool.query(
        `update foxpay_skins
         set price_usdt = $2,
             tap_bonus_per_day = $3,
             roulette_package_ids = $4::jsonb,
             sort_order = $5,
             updated_at = now()
         where id = $1`,
        [skin.id, skin.price_usdt, skin.tap_bonus_per_day, JSON.stringify(skin.roulette_package_ids || []), skin.sort_order],
      );
    }
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('skin_price_55_percent_v1', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), pricing: '55_percent_of_450_day_generation', skins: foxpayDefaultSkins })],
    );
  }

  for (const setting of foxpayDefaultRouletteSettings) {
    await pool.query(
      `insert into foxpay_roulette_settings (package_id, ticket_cost)
       values ($1, $2)
       on conflict (package_id) do nothing`,
      [setting.package_id, setting.ticket_cost],
    );
  }

  // Migration: Remove skins from free roulette by wiping it so the new defaults without skins re-seed
  const removeFreeSkinsMigration = await pool.query("select 1 from foxpay_settings where key = 'roulette_free_skins_removed' limit 1");
  if (!removeFreeSkinsMigration.rowCount) {
    await pool.query("delete from foxpay_roulette_rewards where package_id = 'free'");
    await pool.query("insert into foxpay_settings (key, value) values ('roulette_free_skins_removed', 'true') on conflict (key) do nothing");
  }

  const roulettePoolMigration = await pool.query("select 1 from foxpay_settings where key = 'roulette_pool_rotation_v2' limit 1");
  if (!roulettePoolMigration.rowCount) {
    for (const setting of foxpayDefaultRouletteSettings) {
      await pool.query(
        `insert into foxpay_roulette_settings (package_id, ticket_cost, updated_at)
         values ($1, $2, now())
         on conflict (package_id) do update
           set ticket_cost = excluded.ticket_cost,
               updated_at = now()`,
        [setting.package_id, setting.ticket_cost],
      );
    }
  }

  for (const reward of foxpayDefaultRouletteRewards) {
    const id = `roulette_${reward.package_id}_${md5(`${reward.label}:${reward.reward_type}:${reward.sort_order}`).slice(0, 10)}`;
    await pool.query(
      `insert into foxpay_roulette_rewards
       (id, package_id, label, reward_type, amount, item_id, weight, active, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do nothing`,
      [id, reward.package_id, reward.label, reward.reward_type, reward.amount, reward.item_id || null, reward.weight, reward.active, reward.sort_order],
    );
  }

  if (!roulettePoolMigration.rowCount) {
    for (const reward of foxpayDefaultRouletteRewards) {
      const id = `roulette_${reward.package_id}_${md5(`${reward.label}:${reward.reward_type}:${reward.sort_order}`).slice(0, 10)}`;
      await pool.query(
        `insert into foxpay_roulette_rewards
         (id, package_id, label, reward_type, amount, item_id, weight, active, sort_order, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         on conflict (id) do update
           set label = excluded.label,
               reward_type = excluded.reward_type,
               amount = excluded.amount,
               item_id = excluded.item_id,
               weight = excluded.weight,
               active = excluded.active,
               sort_order = excluded.sort_order,
               updated_at = now()`,
        [id, reward.package_id, reward.label, reward.reward_type, reward.amount, reward.item_id || null, reward.weight, reward.active, reward.sort_order],
      );
    }
  }

  for (const reward of foxpayLegacyRouletteRewards) {
    const id = `roulette_${reward.package_id}_${md5(`${reward.label}:${reward.reward_type}:${reward.sort_order}`).slice(0, 10)}`;
    await pool.query(
      `update foxpay_roulette_rewards
       set active = false, updated_at = now()
       where id = $1`,
      [id],
    );
  }

  if (!roulettePoolMigration.rowCount) {
    await pool.query(
      `insert into foxpay_settings (key, value)
       values ('roulette_pool_rotation_v2', $1::jsonb)
       on conflict (key) do nothing`,
      [JSON.stringify({ applied_at: new Date().toISOString(), cycle_days: 3, visible_rewards: 12, rewards: foxpayDefaultRouletteRewards.length })],
    );
  }

  await seedWorldCupMatches();
}

async function seedWorldCupMatches() {
  const matches = [
    { id: 'wc_2026_1', team_a: 'England', team_b: 'Ghana', flag_a: '🇬🇧', flag_b: '🇬🇭', venue: 'Boston Stadium', match_date: '2026-06-23T15:00:00Z' },
    { id: 'wc_2026_2', team_a: 'Panama', team_b: 'Croatia', flag_a: '🇵🇦', flag_b: '🇭🇷', venue: 'Toronto Stadium', match_date: '2026-06-23T18:00:00Z' },
    { id: 'wc_2026_3', team_a: 'Portugal', team_b: 'Uzbekistan', flag_a: '🇵🇹', flag_b: '🇺🇿', venue: 'Houston Stadium', match_date: '2026-06-23T21:00:00Z' },
    { id: 'wc_2026_4', team_a: 'Colombia', team_b: 'Congo DR', flag_a: '🇨🇴', flag_b: '🇨🇩', venue: 'Estadio Guadalajara', match_date: '2026-06-23T23:30:00Z' },
    { id: 'wc_2026_5', team_a: 'Switzerland', team_b: 'Canada', flag_a: '🇨🇭', flag_b: '🇨🇦', venue: 'Vancouver Stadium', match_date: '2026-06-24T15:00:00Z' },
    { id: 'wc_2026_6', team_a: 'Bosnia', team_b: 'Qatar', flag_a: '🇧🇦', flag_b: '🇶🇦', venue: 'Atlanta Stadium', match_date: '2026-06-24T18:00:00Z' },
    { id: 'wc_2026_7', team_a: 'Morocco', team_b: 'Haiti', flag_a: '🇲🇦', flag_b: '🇭🇹', venue: 'Miami Stadium', match_date: '2026-06-24T21:00:00Z' },
    { id: 'wc_2026_8', team_a: 'Scotland', team_b: 'Brazil', flag_a: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', flag_b: '🇧🇷', venue: 'Seattle Stadium', match_date: '2026-06-24T23:30:00Z' },
    { id: 'wc_2026_9', team_a: 'Japan', team_b: 'Sweden', flag_a: '🇯🇵', flag_b: '🇸🇪', venue: 'Los Angeles Stadium', match_date: '2026-06-25T15:00:00Z' },
    { id: 'wc_2026_10', team_a: 'Ecuador', team_b: 'Germany', flag_a: '🇪🇨', flag_b: '🇩🇪', venue: 'New York Stadium', match_date: '2026-06-25T18:00:00Z' },
    { id: 'wc_2026_11', team_a: 'Uruguay', team_b: 'Spain', flag_a: '🇺🇾', flag_b: '🇪🇸', venue: 'Dallas Stadium', match_date: '2026-06-26T21:00:00Z' },
    { id: 'wc_2026_12', team_a: 'Argentina', team_b: 'Jordan', flag_a: '🇦🇷', flag_b: '🇯🇴', venue: 'San Francisco Stadium', match_date: '2026-06-27T18:00:00Z' },
    { id: 'wc_2026_13', team_a: 'France', team_b: 'Mexico', flag_a: '🇫🇷', flag_b: '🇲🇽', venue: 'Houston Stadium', match_date: '2026-06-28T15:00:00Z' },
    { id: 'wc_2026_14', team_a: 'Netherlands', team_b: 'Nigeria', flag_a: '🇳🇱', flag_b: '🇳🇬', venue: 'Atlanta Stadium', match_date: '2026-06-28T18:00:00Z' },
    { id: 'wc_2026_15', team_a: 'USA', team_b: 'Serbia', flag_a: '🇺🇸', flag_b: '🇷🇸', venue: 'Seattle Stadium', match_date: '2026-06-28T21:00:00Z' },
    { id: 'wc_2026_16', team_a: 'Italy', team_b: 'Chile', flag_a: '🇮🇹', flag_b: '🇨🇱', venue: 'Vancouver Stadium', match_date: '2026-06-28T23:30:00Z' },
    { id: 'wc_2026_17', team_a: 'Belgium', team_b: 'Peru', flag_a: '🇧🇪', flag_b: '🇵🇪', venue: 'Boston Stadium', match_date: '2026-06-29T18:00:00Z' },
    { id: 'wc_2026_18', team_a: 'Denmark', team_b: 'South Korea', flag_a: '🇩🇰', flag_b: '🇰🇷', venue: 'Toronto Stadium', match_date: '2026-06-29T21:00:00Z' }
  ];

  if (!pool) {
    for (const match of matches) {
      if (!foxpayMatchesMemory.has(match.id)) {
        foxpayMatchesMemory.set(match.id, { 
          ...match, 
          status: 'open', 
          result: null, 
          created_at: new Date().toISOString(),
          manual_pool_a: 0,
          manual_pool_b: 0,
          manual_pool_draw: 0
        });
      }
    }
    return;
  }

  for (const match of matches) {
    await pool.query(
      `insert into foxpay_matches
       (id, team_a, team_b, flag_a, flag_b, venue, match_date, status)
       values ($1, $2, $3, $4, $5, $6, $7, 'open')
       on conflict (id) do nothing`,
      [match.id, match.team_a, match.team_b, match.flag_a, match.flag_b, match.venue, match.match_date]
    );
  }
}

let worldCupSeedPromise = null;

async function ensureWorldCupMatchesSeeded() {
  if (!worldCupSeedPromise) {
    worldCupSeedPromise = seedWorldCupMatches().finally(() => {
      worldCupSeedPromise = null;
    });
  }

  return worldCupSeedPromise;
}

async function getFoxPaySettings() {
  if (!pool) {
    return foxpaySettingsFromMemory();
  }

  const result = await pool.query("select value from foxpay_settings where key = 'economy'");
  const stored = result.rows[0]?.value || {};
  const scheduleVersion = String(stored.season_schedule_version || '');
  const migratedSchedule = scheduleVersion === foxpayDefaultSettings.season_schedule_version
    ? stored.season_schedule
    : foxpayDefaultSettings.season_schedule;
  return applyFoxPaySeasonSchedule({
    ...foxpayDefaultSettings,
    ...stored,
    season_schedule_version: foxpayDefaultSettings.season_schedule_version,
    season_schedule: migratedSchedule,
    referral_ticket_rewards: normalizeReferralTicketRewards(stored.referral_ticket_rewards),
  });
}

async function getFoxPayMaintenanceState() {
  if (!pool) {
    return foxpaySettingsMemory.get('maintenance_reset') || null;
  }
  const result = await pool.query("select value from foxpay_settings where key = 'maintenance_reset' limit 1");
  return result.rows[0]?.value || null;
}

function createFoxPayMaintenanceResetState(admin = {}) {
  const resetAt = new Date().toISOString();
  return {
    version: `${resetAt}:${md5(`${resetAt}:${admin.username || admin.role || 'admin'}`).slice(0, 8)}`,
    reset_at: resetAt,
    reset_by: admin.username || admin.role || 'admin',
  };
}

function foxPayResetPlayerPrefix(resetState = {}) {
  const version = String(resetState?.version || '');
  return version ? `fox_${md5(version).slice(0, 10)}_` : '';
}

function foxPayPlayerIdMatchesReset(playerId = '', resetState = {}) {
  const prefix = foxPayResetPlayerPrefix(resetState);
  return !prefix || String(playerId || '').startsWith(prefix);
}

async function saveFoxPaySettingsRaw(settings) {
  const next = {
    ...foxpayDefaultSettings,
    ...settings,
    season_schedule_version: foxpayDefaultSettings.season_schedule_version,
    season_schedule: normalizeFoxPaySeasonSchedule(settings.season_schedule || foxpayDefaultSettings.season_schedule),
    referral_ticket_rewards: normalizeReferralTicketRewards(settings.referral_ticket_rewards),
  };
  if (!pool) {
    foxpaySettingsMemory.set('settings', next);
    return next;
  }

  await pool.query(
    `insert into foxpay_settings (key, value, updated_at)
     values ('economy', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  return next;
}

async function updateFoxPaySettings(patch) {
  const current = await getFoxPaySettings();
  const previousSeasonKey = foxPaySeasonPeriodKey(current);
  const next = {
    ...current,
    token_price_usd: Math.max(0.00000001, toNumber(patch.token_price_usd, current.token_price_usd)),
    referral_rate: Math.max(0, Math.min(1, toNumber(patch.referral_rate, current.referral_rate))),
    block_same_ip: patch.block_same_ip === undefined ? Boolean(current.block_same_ip) : settingEnabled(patch.block_same_ip),
    block_same_device: patch.block_same_device === undefined ? Boolean(current.block_same_device) : settingEnabled(patch.block_same_device),
    daily_cycle_minutes: patch.daily_cycle_minutes === undefined
      ? foxPayDailyCycleMinutes(current)
      : foxPayDailyCycleMinutes({ daily_cycle_minutes: patch.daily_cycle_minutes }),
    youtube_video_urls: patch.youtube_video_urls === undefined
      ? normalizeYoutubeUrls(current.youtube_video_urls)
      : normalizeYoutubeUrls(patch.youtube_video_urls),
    season_name: patch.season_name === undefined
      ? String(current.season_name || foxpayDefaultSettings.season_name)
      : String(patch.season_name || foxpayDefaultSettings.season_name).trim().slice(0, 80),
    season_start_at: normalizeSeasonDate(patch.season_start_at, current.season_start_at),
    season_end_at: normalizeSeasonDate(patch.season_end_at, current.season_end_at),
    season_winner_limit: Math.max(1, Math.min(100, Math.round(toNumber(patch.season_winner_limit, current.season_winner_limit || 20)))),
    season_reward_tokens: Math.max(0, Math.floor(toNumber(patch.season_reward_tokens, current.season_reward_tokens || 0))),
    season_reward_mode: ['equal', 'competitive'].includes(String(patch.season_reward_mode || '').toLowerCase())
      ? String(patch.season_reward_mode).toLowerCase()
      : String(current.season_reward_mode || 'competitive'),
    season_schedule: patch.season_schedule === undefined
      ? normalizeFoxPaySeasonSchedule(current.season_schedule)
      : normalizeFoxPaySeasonSchedule(patch.season_schedule),
    withdrawal_min_usdt: Math.max(0.01, toNumber(patch.withdrawal_min_usdt, current.withdrawal_min_usdt || 10)),
    hot_wallet_network: patch.hot_wallet_network === undefined
      ? String(current.hot_wallet_network || foxpayDefaultSettings.hot_wallet_network)
      : String(patch.hot_wallet_network || foxpayDefaultSettings.hot_wallet_network).trim().slice(0, 24),
    hot_wallet_address: patch.hot_wallet_address === undefined
      ? String(current.hot_wallet_address || '')
      : String(patch.hot_wallet_address || '').trim().slice(0, 180),
    hot_wallet_note: patch.hot_wallet_note === undefined
      ? String(current.hot_wallet_note || '')
      : String(patch.hot_wallet_note || '').trim().slice(0, 300),
    referral_ticket_rewards: patch.referral_ticket_rewards === undefined
      ? normalizeReferralTicketRewards(current.referral_ticket_rewards)
      : normalizeReferralTicketRewards(patch.referral_ticket_rewards),
    unilevel_config: patch.unilevel_config === undefined
      ? normalizeUnilevelConfig(current.unilevel_config)
      : normalizeUnilevelConfig(patch.unilevel_config),
  };

  if (foxPaySeasonPeriodKey(next) !== previousSeasonKey) {
    next.season_paid_at = '';
    next.season_paid_key = '';
    next.season_paid_winners = [];
  }

  return saveFoxPaySettingsRaw(applyFoxPaySeasonSchedule(next));
}

async function getFoxPayPackages(includeInactive = false) {
  if (!pool) {
    if (!foxpayPackagesMemory.size) {
      foxpayDefaultPackages.forEach((pack) => foxpayPackagesMemory.set(pack.id, { ...pack }));
    }
    if (!foxpaySettingsMemory.has('video_task_library_seed_20260523_v1')) {
      for (const [id, pack] of foxpayPackagesMemory.entries()) {
        foxpayPackagesMemory.set(id, {
          ...pack,
          task_config: mergeFoxpaySeedVideoConfig(pack.task_config || {}, id),
          video_urls: [],
        });
      }
      foxpaySettingsMemory.set('video_task_library_seed_20260523_v1', { applied_at: new Date().toISOString() });
    }
    const packs = [...foxpayPackagesMemory.values()];
    return applyFreeVideoFallback(packs
      .filter((pack) => includeInactive || pack.active)
      .sort((left, right) => left.sort_order - right.sort_order));
  }

  const result = await pool.query(
    `select id, name, price_usdt, max_multiplier, monthly_cap_usd, daily_energy, tap_reward_tokens, icon_url, video_urls, task_config, active, sort_order
     from foxpay_packages
     ${includeInactive ? '' : 'where active = true'}
     order by sort_order, price_usdt`,
  );
  const packages = result.rows.map((row) => {
    const rawTaskConfig = parseJsonObject(row.task_config || {});
    const taskConfig = normalizePackageTaskConfig(row.task_config || {});
    taskConfig.referral_task = Object.keys(parseJsonObject(rawTaskConfig.referral_task || {})).length
      ? normalizeReferralTaskConfig(rawTaskConfig.referral_task, row.id)
      : defaultReferralTaskRule(row.id);
    const legacyConfig = legacyVideoUrlsToTaskConfig(row.video_urls || []);
    const hasStructuredTasks = taskConfig.videos.length || taskConfig.socials.length;
    return {
      id: row.id,
      name: row.name,
      price_usdt: toNumber(row.price_usdt),
      max_multiplier: toNumber(row.max_multiplier),
      monthly_cap_usd: toNumber(row.monthly_cap_usd),
      daily_energy: Number(row.daily_energy || 0),
      tap_reward_tokens: Number(row.tap_reward_tokens || 1),
      icon_url: row.icon_url || '',
      video_urls: normalizeYoutubeUrls(row.video_urls || []),
      task_config: hasStructuredTasks ? taskConfig : { ...legacyConfig, referral_task: taskConfig.referral_task },
      active: Boolean(row.active),
      sort_order: Number(row.sort_order || 0),
    };
  });
  return applyFreeVideoFallback(packages);
}

async function getFoxPayPackage(packageId) {
  const packages = await getFoxPayPackages(true);
  return packages.find((pack) => pack.id === packageId) || packages.find((pack) => pack.id === 'free');
}

async function getFoxPayAvatars(includeInactive = false) {
  if (!pool) {
    if (!foxpayAvatarsMemory.size) {
      foxpayDefaultAvatars.forEach((avatar) => foxpayAvatarsMemory.set(avatar.id, { ...avatar }));
    }
    return [...foxpayAvatarsMemory.values()]
      .filter((avatar) => includeInactive || avatar.active)
      .sort((left, right) => left.sort_order - right.sort_order);
  }
  const result = await pool.query(
    `select id, name, image_url, price_tokens, price_usdt, is_free, active, sort_order
     from foxpay_avatars
     ${includeInactive ? '' : 'where active = true'}
     order by sort_order, name`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    image_url: row.image_url,
    price_tokens: toNumber(row.price_tokens),
    price_usdt: toNumber(row.price_usdt),
    is_free: Boolean(row.is_free),
    active: Boolean(row.active),
    sort_order: Number(row.sort_order || 0),
  }));
}

async function getFoxPayAvatar(avatarId) {
  const avatars = await getFoxPayAvatars(true);
  return avatars.find((avatar) => avatar.id === avatarId) || avatars.find((avatar) => avatar.id === 'fox-default') || null;
}

async function getFoxPaySkins(includeInactive = false) {
  if (!pool) {
    if (!foxpaySkinsMemory.size) {
      foxpayDefaultSkins.forEach((skin) => foxpaySkinsMemory.set(skin.id, { ...skin }));
    }
    return [...foxpaySkinsMemory.values()]
      .map(normalizeFoxPaySkin)
      .filter((skin) => includeInactive || skin.active)
      .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
  }
  const result = await pool.query(
    `select id, name, image_url, price_usdt, tap_bonus_per_day, roulette_package_ids, active, sort_order
     from foxpay_skins
     ${includeInactive ? '' : 'where active = true'}
     order by sort_order, name`,
  );
  return result.rows.map(normalizeFoxPaySkin);
}

async function getFoxPaySkin(skinId) {
  const skins = await getFoxPaySkins(true);
  return skins.find((skin) => skin.id === skinId) || null;
}

async function saveFoxPaySkin(input = {}) {
  const skin = normalizeFoxPaySkin(input);
  if (!skin.id || !skin.name || !skin.image_url) {
    const error = new Error('invalid_skin');
    error.code = 'invalid_skin';
    throw error;
  }
  if (!pool) {
    foxpaySkinsMemory.set(skin.id, skin);
    return skin;
  }
  const result = await pool.query(
    `insert into foxpay_skins
     (id, name, image_url, price_usdt, tap_bonus_per_day, roulette_package_ids, active, sort_order, updated_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
     on conflict (id) do update
       set name = excluded.name,
           image_url = excluded.image_url,
           price_usdt = excluded.price_usdt,
           tap_bonus_per_day = excluded.tap_bonus_per_day,
           roulette_package_ids = excluded.roulette_package_ids,
           active = excluded.active,
           sort_order = excluded.sort_order,
           updated_at = now()
     returning id, name, image_url, price_usdt, tap_bonus_per_day, roulette_package_ids, active, sort_order`,
    [skin.id, skin.name, skin.image_url, skin.price_usdt, skin.tap_bonus_per_day, JSON.stringify(skin.roulette_package_ids), skin.active, skin.sort_order],
  );
  return normalizeFoxPaySkin(result.rows[0]);
}

async function getFoxPayRanks(includeInactive = false) {
  if (!pool) {
    if (!foxpayRanksMemory.size) {
      foxpayDefaultRanks.forEach((rank) => foxpayRanksMemory.set(rank.id, { ...rank, team_requirements: { ...(rank.team_requirements || {}) } }));
    }
    return [...foxpayRanksMemory.values()]
      .map(normalizeFoxPayRank)
      .filter((rank) => includeInactive || rank.active)
      .sort((left, right) => left.sort_order - right.sort_order || left.required_lifetime_usd - right.required_lifetime_usd);
  }
  const result = await pool.query(
    `select id, name, image_url, required_directs, required_lifetime_usd, team_requirements, active, sort_order
     from foxpay_ranks
     ${includeInactive ? '' : 'where active = true'}
     order by sort_order, required_lifetime_usd`,
  );
  return result.rows.map(normalizeFoxPayRank);
}

async function saveFoxPayRank(input = {}) {
  const rank = normalizeFoxPayRank(input);
  if (!rank.id || !rank.name) {
    const error = new Error('invalid_rank');
    error.code = 'invalid_rank';
    throw error;
  }
  if (!pool) {
    foxpayRanksMemory.set(rank.id, rank);
    return rank;
  }
  const result = await pool.query(
    `insert into foxpay_ranks
     (id, name, image_url, required_directs, required_lifetime_usd, team_requirements, active, sort_order, updated_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
     on conflict (id) do update
       set name = excluded.name,
           image_url = excluded.image_url,
           required_directs = excluded.required_directs,
           required_lifetime_usd = excluded.required_lifetime_usd,
           team_requirements = excluded.team_requirements,
           active = excluded.active,
           sort_order = excluded.sort_order,
           updated_at = now()
     returning id, name, image_url, required_directs, required_lifetime_usd, team_requirements, active, sort_order`,
    [rank.id, rank.name, rank.image_url, rank.required_directs, rank.required_lifetime_usd, JSON.stringify(rank.team_requirements || {}), rank.active, rank.sort_order],
  );
  return normalizeFoxPayRank(result.rows[0]);
}

function removeSkinFromPlayerState(player = {}, skinId = '') {
  const owned = Array.isArray(player.owned_skins) ? player.owned_skins.filter((id) => id !== skinId) : [];
  const selected = Array.isArray(player.selected_skins) ? player.selected_skins.filter((id) => id !== skinId && owned.includes(id)) : [];
  const dailyTasks = parseJsonObject(player.daily_tasks || {});
  const claimed = Array.isArray(dailyTasks[foxpaySkinTapsClaimedSkinsFlag])
    ? dailyTasks[foxpaySkinTapsClaimedSkinsFlag].filter((id) => id !== skinId)
    : null;
  const nextDailyTasks = claimed ? { ...dailyTasks, [foxpaySkinTapsClaimedSkinsFlag]: claimed } : dailyTasks;
  const changed = owned.length !== (Array.isArray(player.owned_skins) ? player.owned_skins.length : 0)
    || selected.length !== (Array.isArray(player.selected_skins) ? player.selected_skins.length : 0)
    || Boolean(claimed && claimed.length !== dailyTasks[foxpaySkinTapsClaimedSkinsFlag].length);
  return {
    changed,
    player: {
      ...player,
      owned_skins: owned,
      selected_skins: selected.slice(0, 2),
      daily_tasks: nextDailyTasks,
    },
  };
}

async function deactivateAndRemoveFoxPaySkin(skinId = '') {
  const id = String(skinId || '').trim();
  if (!id) {
    const error = new Error('invalid_skin');
    error.code = 'invalid_skin';
    throw error;
  }
  const current = await getFoxPaySkin(id);
  if (!current) {
    const error = new Error('skin_not_found');
    error.code = 'skin_not_found';
    throw error;
  }
  const stats = {
    players_updated: 0,
    roulette_rewards_disabled: 0,
  };
  const skin = { ...current, active: false };

  if (!pool) {
    foxpaySkinsMemory.set(id, skin);
    for (const [playerId, player] of foxpayPlayers.entries()) {
      const next = removeSkinFromPlayerState(player, id);
      if (next.changed) {
        foxpayPlayers.set(playerId, next.player);
        stats.players_updated += 1;
      }
    }
    for (const [rewardId, reward] of foxpayRouletteRewardsMemory.entries()) {
      if (reward.reward_type === 'skin' && reward.item_id === id && reward.active !== false) {
        foxpayRouletteRewardsMemory.set(rewardId, { ...reward, active: false });
        stats.roulette_rewards_disabled += 1;
      }
    }
    return { skin: normalizeFoxPaySkin(skin), ...stats };
  }

  const result = await pool.query(
    `update foxpay_skins
     set active = false, updated_at = now()
     where id = $1
     returning id, name, image_url, price_usdt, tap_bonus_per_day, roulette_package_ids, active, sort_order`,
    [id],
  );
  const playerRows = await pool.query('select player_id, owned_skins, selected_skins, daily_tasks from foxpay_players');
  for (const row of playerRows.rows) {
    const next = removeSkinFromPlayerState(row, id);
    if (next.changed) {
      await pool.query(
        `update foxpay_players
         set owned_skins = $2::jsonb,
             selected_skins = $3::jsonb,
             daily_tasks = $4::jsonb,
             updated_at = now()
         where player_id = $1`,
        [
          row.player_id,
          JSON.stringify(next.player.owned_skins),
          JSON.stringify(next.player.selected_skins),
          JSON.stringify(next.player.daily_tasks || {}),
        ],
      );
      stats.players_updated += 1;
    }
  }
  const rewards = await pool.query(
    `update foxpay_roulette_rewards
     set active = false, updated_at = now()
     where reward_type = 'skin' and item_id = $1 and active = true
     returning id`,
    [id],
  );
  stats.roulette_rewards_disabled = rewards.rowCount || 0;
  return { skin: normalizeFoxPaySkin(result.rows[0] || skin), ...stats };
}

async function getFoxPayRouletteSettings() {
  if (!pool) {
    if (!foxpayRouletteSettingsMemory.size) {
      foxpayDefaultRouletteSettings.forEach((setting) => foxpayRouletteSettingsMemory.set(setting.package_id, { ...setting }));
    }
    return [...foxpayRouletteSettingsMemory.values()].map((row) => ({
      package_id: String(row.package_id || 'free'),
      ticket_cost: Math.max(1, Math.floor(toNumber(row.ticket_cost, 1))),
    }));
  }
  const result = await pool.query('select package_id, ticket_cost from foxpay_roulette_settings order by package_id');
  const byPack = new Map(foxpayDefaultRouletteSettings.map((row) => [row.package_id, { ...row }]));
  result.rows.forEach((row) => byPack.set(row.package_id, row));
  return [...byPack.values()].map((row) => ({
    package_id: String(row.package_id || 'free'),
    ticket_cost: Math.max(1, Math.floor(toNumber(row.ticket_cost, 1))),
  }));
}

async function getFoxPayRouletteSetting(packageId) {
  const settings = await getFoxPayRouletteSettings();
  return settings.find((row) => row.package_id === packageId) || settings.find((row) => row.package_id === 'free') || { package_id: packageId || 'free', ticket_cost: 1 };
}

function foxPayRouletteCycleIndex(now = Date.now()) {
  const day = Math.floor(Number(now || Date.now()) / 86400000);
  return Math.floor(day / 3);
}

function foxPayStableHash(text = '') {
  let hash = 0;
  for (let index = 0; index < String(text).length; index += 1) {
    hash = ((hash << 5) - hash) + String(text).charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rotateFoxPayRouletteItems(items = [], offset = 0) {
  if (items.length <= 1) return [...items];
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function selectFoxPayRouletteRewardsForCycle(rewards = [], packageId = '') {
  const normalized = rewards.map(normalizeRouletteReward).filter((reward) => reward.active && reward.weight > 0);
  const maxVisible = 12;
  if (normalized.length <= maxVisible) return normalized;
  const cycle = foxPayRouletteCycleIndex();
  const packageOffset = foxPayStableHash(`${packageId || 'free'}:${cycle}`);
  const byType = (type) => normalized.filter((reward) => reward.reward_type === type);
  const desired = [
    ['none', 4],
    ['tickets', 2],
    ['tokens', 3],
    ['skin', 2],
    ['avatar', 1],
  ];
  const selected = new Map();
  desired.forEach(([type, count], index) => {
    rotateFoxPayRouletteItems(byType(type), packageOffset + cycle + index).slice(0, count).forEach((reward) => selected.set(reward.id, reward));
  });
  rotateFoxPayRouletteItems(normalized, packageOffset + cycle).forEach((reward) => {
    if (selected.size < maxVisible) selected.set(reward.id, reward);
  });
  return [...selected.values()].sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label));
}

function foxPaySuggestedRouletteTicketCost(rewards = [], settings = {}) {
  const tokenPrice = toNumber(settings.token_price_usd, foxpayDefaultSettings.token_price_usd);
  const maxTokenUsdt = rewards
    .filter((reward) => reward.reward_type === 'tokens')
    .reduce((max, reward) => Math.max(max, toNumber(reward.amount) * tokenPrice), 0);
  const maxTicketPrize = rewards
    .filter((reward) => reward.reward_type === 'tickets')
    .reduce((max, reward) => Math.max(max, Math.floor(toNumber(reward.amount))), 0);
  let cost = 1;
  if (maxTokenUsdt >= 10) cost = 6;
  else if (maxTokenUsdt >= 3) cost = 4;
  else if (maxTokenUsdt >= 0.5) cost = 3;
  else if (maxTokenUsdt >= 0.05) cost = 2;
  if (maxTicketPrize >= 8) cost = Math.max(cost, 4);
  else if (maxTicketPrize >= 4) cost = Math.max(cost, 3);
  else if (maxTicketPrize >= 2) cost = Math.max(cost, 2);
  return Math.max(1, Math.min(12, cost));
}

function foxPayEffectiveRouletteTicketCost(setting = {}, rewards = [], settings = {}) {
  const configured = Math.max(1, Math.floor(toNumber(setting.ticket_cost, 1)));
  return Math.max(configured, foxPaySuggestedRouletteTicketCost(rewards, settings));
}

async function saveFoxPayRouletteSetting(packageId, ticketCost) {
  const item = {
    package_id: String(packageId || 'free').trim() || 'free',
    ticket_cost: Math.max(1, Math.min(100, Math.floor(toNumber(ticketCost, 1)))),
  };
  if (!pool) {
    foxpayRouletteSettingsMemory.set(item.package_id, item);
    return item;
  }
  const result = await pool.query(
    `insert into foxpay_roulette_settings (package_id, ticket_cost, updated_at)
     values ($1, $2, now())
     on conflict (package_id) do update set ticket_cost = excluded.ticket_cost, updated_at = now()
     returning package_id, ticket_cost`,
    [item.package_id, item.ticket_cost],
  );
  return result.rows[0] || item;
}

async function getFoxPayRouletteRewards(packageId = '', includeInactive = false) {
  if (!pool) {
    if (!foxpayRouletteRewardsMemory.size) {
      foxpayDefaultRouletteRewards.forEach((reward) => {
        const id = `roulette_${reward.package_id}_${md5(`${reward.label}:${reward.reward_type}:${reward.sort_order}`).slice(0, 10)}`;
        foxpayRouletteRewardsMemory.set(id, { id, ...reward });
      });
    }
    const rewards = [...foxpayRouletteRewardsMemory.values()]
      .filter((reward) => (!packageId || reward.package_id === packageId) && (includeInactive || reward.active))
      .map(normalizeRouletteReward)
      .sort((left, right) => left.package_id.localeCompare(right.package_id) || left.sort_order - right.sort_order || left.label.localeCompare(right.label));
    return (!includeInactive && packageId) ? selectFoxPayRouletteRewardsForCycle(rewards, packageId) : rewards;
  }
  const values = [];
  let where = '';
  if (packageId) {
    values.push(packageId);
    where = 'where package_id = $1';
  }
  if (!includeInactive) {
    where += where ? ' and active = true' : 'where active = true';
  }
  const result = await pool.query(
    `select id, package_id, label, reward_type, amount, item_id, weight, active, sort_order
     from foxpay_roulette_rewards
     ${where}
     order by package_id, sort_order, label`,
    values,
  );
  const rewards = result.rows.map(normalizeRouletteReward);
  return (!includeInactive && packageId) ? selectFoxPayRouletteRewardsForCycle(rewards, packageId) : rewards;
}

async function saveFoxPayRouletteReward(input = {}) {
  const reward = normalizeRouletteReward(input);
  reward.id = reward.id || `roulette_${reward.package_id}_${md5(`${reward.label}:${reward.reward_type}:${Date.now()}`).slice(0, 12)}`;
  if (!reward.package_id || !reward.label) {
    const error = new Error('invalid_roulette_reward');
    error.code = 'invalid_roulette_reward';
    throw error;
  }
  if (!pool) {
    foxpayRouletteRewardsMemory.set(reward.id, reward);
    return reward;
  }
  const result = await pool.query(
    `insert into foxpay_roulette_rewards (id, package_id, label, reward_type, amount, item_id, weight, active, sort_order, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (id) do update
       set package_id = excluded.package_id,
           label = excluded.label,
           reward_type = excluded.reward_type,
           amount = excluded.amount,
           item_id = excluded.item_id,
           weight = excluded.weight,
           active = excluded.active,
           sort_order = excluded.sort_order,
           updated_at = now()
     returning id, package_id, label, reward_type, amount, item_id, weight, active, sort_order`,
    [reward.id, reward.package_id, reward.label, reward.reward_type, reward.amount, reward.item_id || null, reward.weight, reward.active, reward.sort_order],
  );
  return normalizeRouletteReward(result.rows[0]);
}

function playerOwnsAvatar(player, avatar) {
  if (!player || !avatar) return false;
  if (avatar.is_free) return true;
  return Array.isArray(player.owned_avatars) && player.owned_avatars.includes(avatar.id);
}

function playerOwnsSkin(player, skin) {
  if (!player || !skin) return false;
  return Array.isArray(player.owned_skins) && player.owned_skins.includes(skin.id);
}

function skinAllowedForPackage(skin, packageId) {
  const packageIds = normalizePackageIdList(skin?.roulette_package_ids || []);
  return packageIds.length === 0 || packageIds.includes(packageId || 'free');
}

const foxPayPackageRank = (packageId = 'free') => ({
  free: 0,
  p30: 1,
  p60: 2,
  p120: 3,
  p480: 4,
  p960: 5,
}[packageId] ?? 0);

function foxPayCanUpgradePackage(currentPackageId = 'free', targetPackageId = 'free') {
  return foxPayPackageRank(targetPackageId) > foxPayPackageRank(currentPackageId);
}

function skinDirectBuyAllowedForPackage(skin, packageId) {
  const buyerRank = foxPayPackageRank(packageId);
  const packageIds = normalizePackageIdList(skin?.roulette_package_ids || []);
  if (buyerRank < foxPayPackageRank('p60')) {
    return packageIds.includes(packageId || 'free');
  }
  if (!packageIds.length) return true;
  const eligibleRanks = packageIds.map((id) => foxPayPackageRank(id));
  return buyerRank >= Math.min(...eligibleRanks);
}

function selectedPlayerSkins(player, skins = []) {
  const owned = new Set(Array.isArray(player?.owned_skins) ? player.owned_skins : []);
  const selected = Array.isArray(player?.selected_skins) ? player.selected_skins : [];
  return selected
    .map((skinId) => skins.find((skin) => skin.id === skinId && skin.active && owned.has(skin.id)))
    .filter(Boolean)
    .slice(0, 2);
}

function claimedPlayerSkinsForToday(player, skins = [], settings = foxpayDefaultSettings) {
  if (player?.skin_taps_daily_key !== foxpayTodayKey(settings)) return [];
  const claimedIds = normalizePackageIdList(player?.daily_tasks?.[foxpaySkinTapsClaimedSkinsFlag] || []);
  if (!claimedIds.length) return [];
  const owned = new Set(Array.isArray(player?.owned_skins) ? player.owned_skins : []);
  return claimedIds
    .map((skinId) => skins.find((skin) => skin.id === skinId && skin.active && owned.has(skin.id)))
    .filter(Boolean)
    .slice(0, 2);
}

function normalizeFoxPayPlayer(player, pack, settings = foxpayDefaultSettings) {
  const today = foxpayTodayKey(settings);
  const dailyTasks = player.daily_tasks && typeof player.daily_tasks === 'object' ? player.daily_tasks : {};
  const taskProgress = player.task_progress && typeof player.task_progress === 'object' ? player.task_progress : {};
  const referralTaskState = player.referral_task_state && typeof player.referral_task_state === 'object' ? player.referral_task_state : {};
  const isNewDay = player.daily_key !== today;
  return {
    ...player,
    token_balance: toNumber(player.token_balance),
    roulette_tickets: Math.max(0, Math.floor(toNumber(player.roulette_tickets, 0))),
    total_earned_usd: toNumber(player.total_earned_usd),
    lifetime_earned_usd: Math.max(0, toNumber(player.lifetime_earned_usd, toNumber(player.total_earned_usd, 0))),
    season_key: player.season_key || '',
    season_earned_tokens: Math.max(0, Math.floor(toNumber(player.season_earned_tokens, 0))),
    total_withdrawn_usd: toNumber(player.total_withdrawn_usd),
    email: normalizeFoxPayEmail(player.email || ''),
    password_hash: player.password_hash || '',
    password_salt: player.password_salt || '',
    account_token: player.account_token || '',
    registered_at: player.registered_at || null,
    last_login_at: player.last_login_at || null,
    signup_ip: player.signup_ip || '',
    country_code: player.country_code || '',
    country_name: player.country_name || '',
    device_key: player.device_key || '',
    device_label: player.device_label || detectDeviceLabel(player.user_agent || ''),
    user_agent: player.user_agent || '',
    selected_avatar_id: player.selected_avatar_id || 'fox-default',
    owned_avatars: Array.isArray(player.owned_avatars) ? player.owned_avatars : ['fox-default'],
    owned_skins: Array.isArray(player.owned_skins) ? player.owned_skins : [],
    selected_skins: Array.isArray(player.selected_skins) ? player.selected_skins.slice(0, 2) : [],
    skin_taps_daily_key: player.skin_taps_daily_key || '',
    referral_task_state: referralTaskState,
    account_status: String(player.account_status || 'active') === 'disabled' ? 'disabled' : 'active',
    withdrawal_wallet: player.withdrawal_wallet || '',
    withdrawal_network: normalizeWithdrawalNetwork(player.withdrawal_network) || 'bep20',
    streak_days: foxPayVisibleStreak(player, today),
    streak_last_key: player.streak_last_key || '',
    energy: isNewDay ? Number(pack.daily_energy || 300) : Number(player.energy || 0),
    max_energy: Number(pack.daily_energy || player.max_energy || 300),
    daily_key: today,
    daily_tasks: isNewDay ? {} : dailyTasks,
    task_progress: isNewDay ? { taps: 0 } : { ...taskProgress, taps: Number(taskProgress.taps || 0) },
  };
}

function hashFoxPayPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return { salt, hash };
}

function createFoxPayAccountToken() {
  return randomBytes(32).toString('hex');
}

function parseFoxPayAccountSessions(player = {}) {
  const raw = String(player.account_token || '').trim();
  if (!raw) return [];
  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    return [{
      token: raw,
      device_key: '',
      device_label: '',
      user_agent: '',
      created_at: player.last_login_at || player.registered_at || new Date(0).toISOString(),
      last_seen_at: player.last_login_at || player.registered_at || new Date(0).toISOString(),
      legacy: true,
    }];
  }
  const parsed = parseJsonObject(raw);
  const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.sessions) ? parsed.sessions : []);
  return rows
    .map((session) => ({
      token: String(session?.token || '').trim(),
      device_key: String(session?.device_key || '').trim(),
      device_label: String(session?.device_label || '').trim().slice(0, 120),
      user_agent: String(session?.user_agent || '').trim().slice(0, 500),
      created_at: session?.created_at || new Date().toISOString(),
      last_seen_at: session?.last_seen_at || session?.created_at || new Date().toISOString(),
    }))
    .filter((session) => session.token);
}

function serializeFoxPayAccountSessions(sessions = []) {
  return JSON.stringify({
    sessions: sessions
      .filter((session) => session?.token)
      .slice(0, 2)
      .map((session) => ({
        token: session.token,
        device_key: session.device_key || '',
        device_label: session.device_label || '',
        user_agent: session.user_agent || '',
        created_at: session.created_at || new Date().toISOString(),
        last_seen_at: session.last_seen_at || session.created_at || new Date().toISOString(),
      })),
  });
}

function foxPayAccountTokenMatches(player = {}, token = '') {
  const cleanToken = String(token || '').trim();
  return Boolean(cleanToken && parseFoxPayAccountSessions(player).some((session) => session.token === cleanToken));
}

function issueFoxPayAccountSession(player, payload = {}) {
  const now = new Date().toISOString();
  const token = createFoxPayAccountToken();
  const deviceKey = String(payload.device_key || player.device_key || '').trim();
  const sessions = parseFoxPayAccountSessions(player)
    .filter((session) => !deviceKey || session.device_key !== deviceKey)
    .map((session) => ({ ...session, legacy: undefined }));
  sessions.push({
    token,
    device_key: deviceKey,
    device_label: String(payload.device_label || player.device_label || '').trim().slice(0, 120),
    user_agent: String(payload.user_agent || player.user_agent || '').trim().slice(0, 500),
    created_at: now,
    last_seen_at: now,
  });
  sessions.sort((left, right) => String(right.last_seen_at || '').localeCompare(String(left.last_seen_at || '')));
  player.account_token = serializeFoxPayAccountSessions(sessions.slice(0, 2));
  return token;
}

function foxPaySessionPayloadFromParams(params = new URLSearchParams()) {
  return {
    device_key: params.get('device_key') || '',
    device_label: params.get('device_label') || '',
    user_agent: params.get('user_agent') || '',
  };
}

const foxPayCaptchaOptions = [
  { id: 'fox-coin', icon: 'fox-coin', label: 'FOX coin' },
  { id: 'star-token', icon: 'ph:star-four-fill', label: 'star token' },
  { id: 'shield-token', icon: 'ph:shield-check-fill', label: 'shield token' },
  { id: 'diamond-token', icon: 'ph:diamond-fill', label: 'diamond token' },
];

function shuffledCaptchaOptions(seed) {
  return [...foxPayCaptchaOptions]
    .map((item, index) => ({
      item,
      sort: md5(`${seed}:${item.id}:${index}`),
    }))
    .sort((left, right) => left.sort.localeCompare(right.sort))
    .map(({ item }) => item);
}

function createFoxPayRegisterCaptcha(playerId) {
  const now = Date.now();
  if (foxpayRegisterCaptchas.size > 500) {
    for (const [key, challenge] of foxpayRegisterCaptchas) {
      if (challenge.expiresAt < now) foxpayRegisterCaptchas.delete(key);
    }
  }
  const token = randomBytes(18).toString('hex');
  const target = foxPayCaptchaOptions[randomBytes(1)[0] % foxPayCaptchaOptions.length];
  const expiresAt = now + 5 * 60 * 1000;
  foxpayRegisterCaptchas.set(token, {
    playerId: String(playerId || ''),
    targetId: target.id,
    expiresAt,
  });
  return {
    token,
    prompt: `Tap the ${target.label}`,
    options: shuffledCaptchaOptions(token),
    expires_at: new Date(expiresAt).toISOString(),
  };
}

function verifyFoxPayRegisterCaptcha(playerId, token, choice) {
  const challenge = foxpayRegisterCaptchas.get(String(token || ''));
  foxpayRegisterCaptchas.delete(String(token || ''));
  if (!challenge) return false;
  if (challenge.expiresAt < Date.now()) return false;
  if (challenge.playerId !== String(playerId || '')) return false;
  return challenge.targetId === String(choice || '');
}

function defaultFoxPayUsername(playerId = '') {
  const hash = createHash('sha1').update(String(playerId || randomBytes(4).toString('hex'))).digest('hex');
  return `Fox ${hash.slice(0, 6).toUpperCase()}`;
}

function verifyFoxPayPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  const { hash } = hashFoxPayPassword(password, salt);
  const left = Buffer.from(hash);
  const right = Buffer.from(expectedHash);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeFoxPayEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  if (email.length > 160) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return '';
  return email;
}

function sanitizeFoxPayPlayer(player, settings = foxpayDefaultSettings) {
  const { password_hash: _passwordHash, password_salt: _passwordSalt, account_token: _accountToken, _package: _pack, ...safe } = player;
  return {
    ...safe,
    season_earned_tokens: foxPayPlayerSeasonEarned(player, settings),
    is_registered: Boolean(player.password_hash),
  };
}

function foxPayAccountEnabled(player = {}) {
  return String(player.account_status || 'active') !== 'disabled';
}

async function sendFoxPayAccountDisabled(response, playerId, status = 403) {
  return sendJson(response, status, {
    ok: false,
    error: 'account_disabled',
    dashboard: await buildFoxPayDashboard(playerId),
  });
}

const foxpaySupportCategories = new Set(['account', 'purchase', 'withdrawal', 'tasks', 'blocked', 'other']);

function normalizeFoxPaySupportCategory(value) {
  const key = String(value || '').trim().toLowerCase();
  return foxpaySupportCategories.has(key) ? key : 'other';
}

function normalizeFoxPaySupportStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  return ['open', 'waiting_admin', 'waiting_user', 'closed'].includes(key) ? key : 'open';
}

function normalizeFoxPaySupportMessage(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function normalizeFoxPaySupportImage(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (!image.startsWith('data:image/webp;base64,')) return '';
  return image.length <= 350000 ? image : '';
}

function foxPaySupportPublicTicket(row = {}, messages = []) {
  const lastAdmin = row.last_admin_message_at || '';
  const lastRead = row.last_player_read_at || '';
  const unread = Math.max(0, Math.floor(Number(row.player_unread_count || 0)));
  return {
    id: row.id,
    player_id: row.player_id,
    category: row.category,
    subject: row.subject || '',
    status: row.status,
    priority: row.priority || 'normal',
    unread_count: unread,
    has_unread: unread > 0 || (lastAdmin && (!lastRead || Date.parse(lastAdmin) > Date.parse(lastRead))),
    last_message_at: row.last_message_at || row.updated_at || row.created_at || '',
    created_at: row.created_at || '',
    closed_at: row.closed_at || '',
    rating: Number(row.rating || 0) || 0,
    rated_at: row.rated_at || '',
    messages: messages.map((message) => ({
      id: message.id,
      sender_type: message.sender_type,
      message: message.message,
      image_url: message.image_url || '',
      created_at: message.created_at || '',
    })),
  };
}

function foxPaySupportAdminTicket(row = {}, messages = []) {
  return {
    ...foxPaySupportPublicTicket(row, messages),
    username: row.username || '',
    admin_unread_count: Math.max(0, Math.floor(Number(row.admin_unread_count || 0))),
    device_key: row.device_key || '',
    signup_ip: row.signup_ip || '',
    user_agent: row.user_agent || '',
  };
}

async function listFoxPaySupportMessages(ticketId) {
  if (!pool) return (foxpaySupportMessagesMemory.get(ticketId) || []).slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const result = await pool.query(
    'select id, ticket_id, sender_type, sender_id, message, image_url, created_at from foxpay_support_messages where ticket_id = $1 order by created_at asc',
    [ticketId],
  );
  return result.rows;
}

async function listFoxPayPlayerSupportTickets(playerId, { includeMessages = false } = {}) {
  const safePlayerId = String(playerId || '').trim();
  if (!safePlayerId) return { tickets: [], unread_count: 0 };
  let rows;
  if (!pool) {
    rows = [...foxpaySupportTicketsMemory.values()]
      .filter((row) => row.player_id === safePlayerId)
      .sort((a, b) => Date.parse(b.last_message_at || b.updated_at || b.created_at) - Date.parse(a.last_message_at || a.updated_at || a.created_at))
      .slice(0, 20);
  } else {
    const result = await pool.query(
      `select * from foxpay_support_tickets
       where player_id = $1
       order by last_message_at desc
       limit 20`,
      [safePlayerId],
    );
    rows = result.rows;
  }
  const tickets = [];
  for (const row of rows) {
    const messages = includeMessages ? await listFoxPaySupportMessages(row.id) : [];
    tickets.push(foxPaySupportPublicTicket(row, messages));
  }
  return {
    tickets,
    unread_count: tickets.reduce((sum, ticket) => sum + Number(ticket.unread_count || 0), 0),
  };
}

async function listFoxPayAdminSupportTickets() {
  let rows;
  if (!pool) {
    rows = [...foxpaySupportTicketsMemory.values()]
      .sort((a, b) => Date.parse(b.last_message_at || b.updated_at || b.created_at) - Date.parse(a.last_message_at || a.updated_at || a.created_at))
      .slice(0, 200);
  } else {
    const result = await pool.query('select * from foxpay_support_tickets order by last_message_at desc limit 200');
    rows = result.rows;
  }
  const tickets = [];
  for (const row of rows) {
    tickets.push(foxPaySupportAdminTicket(row, await listFoxPaySupportMessages(row.id)));
  }
  return tickets;
}

async function findOpenFoxPaySupportTicket(playerId, category) {
  if (!pool) {
    return [...foxpaySupportTicketsMemory.values()]
      .find((row) => row.player_id === playerId && row.category === category && row.status !== 'closed') || null;
  }
  const result = await pool.query(
    `select * from foxpay_support_tickets
     where player_id = $1 and category = $2 and status <> 'closed'
     order by created_at desc
     limit 1`,
    [playerId, category],
  );
  return result.rows[0] || null;
}

async function findPendingFoxPaySupportRatingTicket(playerId) {
  const safePlayerId = String(playerId || '').trim();
  if (!safePlayerId) return null;
  if (!pool) {
    return [...foxpaySupportTicketsMemory.values()]
      .filter((row) => row.player_id === safePlayerId && row.status === 'closed' && !Number(row.rating || 0))
      .sort((a, b) => Date.parse(b.closed_at || b.updated_at || b.created_at) - Date.parse(a.closed_at || a.updated_at || a.created_at))[0] || null;
  }
  const result = await pool.query(
    `select * from foxpay_support_tickets
     where player_id = $1 and status = 'closed' and coalesce(rating, 0) = 0
     order by coalesce(closed_at, updated_at, created_at) desc
     limit 1`,
    [safePlayerId],
  );
  return result.rows[0] || null;
}

async function foxPaySupportRateLimit(playerId, payload = {}, options = {}) {
  const sinceDay = new Date(Date.now() - 86400000).toISOString();
  const sinceShort = new Date(Date.now() - 120000).toISOString();
  const deviceKey = String(payload.device_key || '').trim();
  const signupIp = String(payload.signup_ip || '').trim();
  let daily = 0;
  let dailyTickets = 0;
  let recent = 0;
  if (!pool) {
    const rows = [...foxpaySupportMessagesMemory.values()].flat().filter((message) => message.sender_type === 'player');
    daily = rows.filter((message) => message.sender_id === playerId && message.created_at >= sinceDay).length;
    recent = rows.filter((message) => message.sender_id === playerId && message.created_at >= sinceShort).length;
    const tickets = [...foxpaySupportTicketsMemory.values()].filter((ticket) => ticket.created_at >= sinceDay);
    dailyTickets = tickets.filter((ticket) => ticket.player_id === playerId).length;
    if (deviceKey) daily += tickets.filter((ticket) => ticket.device_key === deviceKey).length;
    if (signupIp) daily += tickets.filter((ticket) => ticket.signup_ip === signupIp).length;
  } else {
    const result = await pool.query(
      `select
        (select count(*) from foxpay_support_messages where sender_type = 'player' and sender_id = $1 and created_at >= $2) as daily_messages,
        (select count(*) from foxpay_support_messages where sender_type = 'player' and sender_id = $1 and created_at >= $3) as recent_messages,
        (select count(*) from foxpay_support_tickets where player_id = $1 and created_at >= $2) as player_tickets,
        (select count(*) from foxpay_support_tickets where $4 <> '' and device_key = $4 and created_at >= $2) as device_tickets,
        (select count(*) from foxpay_support_tickets where $5 <> '' and signup_ip = $5 and created_at >= $2) as ip_tickets`,
      [playerId, sinceDay, sinceShort, deviceKey, signupIp],
    );
    const row = result.rows[0] || {};
    daily = Number(row.daily_messages || 0) + Number(row.device_tickets || 0) + Number(row.ip_tickets || 0);
    dailyTickets = Number(row.player_tickets || 0);
    recent = Number(row.recent_messages || 0);
  }
  if (options.newTicket && dailyTickets >= 2) return { limited: true, error: 'support_daily_limited' };
  if (options.newTicket && dailyTickets < 2) return { limited: false };
  if (!options.allowQuickReply && recent >= 1) return { limited: true, error: 'support_rate_limited' };
  if (daily >= 12) return { limited: true, error: 'support_daily_limited' };
  return { limited: false };
}

async function saveFoxPaySupportTicket(row) {
  if (!pool) {
    foxpaySupportTicketsMemory.set(row.id, { ...foxpaySupportTicketsMemory.get(row.id), ...row });
    return foxpaySupportTicketsMemory.get(row.id);
  }
  const result = await pool.query(
    `insert into foxpay_support_tickets
       (id, player_id, username, category, subject, status, priority, last_message_at, last_player_message_at, admin_unread_count, device_key, signup_ip, user_agent)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $8, 0, $9, $10, $11)
     on conflict (id) do update set
       subject = excluded.subject,
       status = excluded.status,
       last_message_at = excluded.last_message_at,
       last_player_message_at = excluded.last_player_message_at,
       admin_unread_count = foxpay_support_tickets.admin_unread_count + 1,
       updated_at = now()
     returning *`,
    [row.id, row.player_id, row.username || '', row.category, row.subject || '', row.status, row.priority || 'normal', row.last_message_at, row.device_key || null, row.signup_ip || null, row.user_agent || null],
  );
  return result.rows[0] || row;
}

async function addFoxPaySupportMessage(ticketId, senderType, senderId, message, imageUrl = '') {
  const row = {
    id: `support_msg_${Date.now()}_${randomBytes(4).toString('hex')}`,
    ticket_id: ticketId,
    sender_type: senderType,
    sender_id: senderId,
    message,
    image_url: normalizeFoxPaySupportImage(imageUrl),
    created_at: new Date().toISOString(),
  };
  if (!pool) {
    const list = foxpaySupportMessagesMemory.get(ticketId) || [];
    list.push(row);
    foxpaySupportMessagesMemory.set(ticketId, list);
    return row;
  }
  const result = await pool.query(
    `insert into foxpay_support_messages (id, ticket_id, sender_type, sender_id, message, image_url)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [row.id, ticketId, senderType, senderId, message, row.image_url],
  );
  return result.rows[0] || row;
}

async function updateFoxPaySupportTicketAfterMessage(ticketId, senderType, status = '') {
  const now = new Date().toISOString();
  if (!pool) {
    const ticket = foxpaySupportTicketsMemory.get(ticketId);
    if (!ticket) return null;
    ticket.last_message_at = now;
    ticket.updated_at = now;
    if (senderType === 'admin') {
      ticket.last_admin_message_at = now;
      ticket.player_unread_count = Math.max(0, Number(ticket.player_unread_count || 0)) + 1;
      ticket.status = status || 'waiting_user';
    } else {
      ticket.last_player_message_at = now;
      ticket.admin_unread_count = Math.max(0, Number(ticket.admin_unread_count || 0)) + 1;
      ticket.status = status || 'waiting_admin';
    }
    foxpaySupportTicketsMemory.set(ticketId, ticket);
    return ticket;
  }
  const result = await pool.query(
    `update foxpay_support_tickets
     set status = $3,
         last_message_at = now(),
         last_admin_message_at = case when $2 = 'admin' then now() else last_admin_message_at end,
         last_player_message_at = case when $2 = 'player' then now() else last_player_message_at end,
         player_unread_count = case when $2 = 'admin' then player_unread_count + 1 else player_unread_count end,
         admin_unread_count = case when $2 = 'player' then admin_unread_count + 1 else admin_unread_count end,
         updated_at = now()
     where id = $1
     returning *`,
    [ticketId, senderType, status || (senderType === 'admin' ? 'waiting_user' : 'waiting_admin')],
  );
  return result.rows[0] || null;
}

async function markFoxPaySupportRead(ticketId, readerType) {
  if (!pool) {
    const ticket = foxpaySupportTicketsMemory.get(ticketId);
    if (!ticket) return null;
    if (readerType === 'player') {
      ticket.last_player_read_at = new Date().toISOString();
      ticket.player_unread_count = 0;
    } else {
      ticket.admin_unread_count = 0;
    }
    foxpaySupportTicketsMemory.set(ticketId, ticket);
    return ticket;
  }
  const field = readerType === 'player'
    ? 'last_player_read_at = now(), player_unread_count = 0'
    : 'admin_unread_count = 0';
  const result = await pool.query(`update foxpay_support_tickets set ${field}, updated_at = now() where id = $1 returning *`, [ticketId]);
  return result.rows[0] || null;
}

const foxpayAdminPermissionGroups = [
  { view: 'overview_view', edit: '', label: 'Resumen' },
  { view: 'users_view', edit: 'users_edit', label: 'Usuarios' },
  { view: 'support_view', edit: 'support_edit', label: 'Soporte' },
  { view: 'finance_view', edit: 'finance_edit', label: 'Finanzas' },
  { view: 'content_view', edit: 'content_edit', label: 'Contenido' },
  { view: 'settings_view', edit: 'settings_edit', label: 'Configuracion' },
  { view: 'admins_view', edit: 'admins_edit', label: 'Admins' },
  { view: '', edit: 'maintenance_edit', label: 'Mantenimiento' },
];

const foxpayAdminPermissionKeys = foxpayAdminPermissionGroups
  .flatMap((group) => [group.view, group.edit])
  .filter(Boolean);

const foxpayAdminRolePermissions = {
  super_admin: foxpayAdminPermissionKeys,
  finance: ['overview_view', 'finance_view', 'finance_edit', 'settings_view'],
  content: ['overview_view', 'content_view', 'content_edit'],
  support: ['overview_view', 'users_view', 'support_view', 'support_edit'],
  viewer: ['overview_view'],
  custom: ['overview_view'],
};

const foxpayLegacyAdminPermissionMap = {
  view: 'overview_view',
  users: 'users_edit',
  content: 'content_edit',
  finance: 'finance_edit',
  settings: 'settings_edit',
  admins: 'admins_edit',
};

const foxpayMaintenanceConfirmText = 'RESET FOXPAY';

function settingEnabled(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeYoutubeUrls(value) {
  const items = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]+/);
  return items
    .map((item) => String(item || '').trim())
    .filter((item) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(item))
    .slice(0, 12);
}

function normalizeUnilevelConfig(value) {
  const source = parseJsonObject(value);
  const fallback = foxpayDefaultSettings.unilevel_config;
  const next = {};
  const packageIds = ['free', 'p30', 'p60', 'p120', 'p480', 'p960'];
  packageIds.forEach((packId) => {
    const raw = Array.isArray(source[packId]) ? source[packId] : fallback[packId] || [];
    next[packId] = raw
      .map((rate) => Math.max(0, Math.min(100, toNumber(rate, 0))))
      .filter((rate) => rate > 0)
      .slice(0, 10);
  });
  return next;
}

function normalizeReferralTicketRewards(value) {
  const source = parseJsonObject(value);
  const next = {};
  Object.keys(foxpayDefaultReferralTicketRewards).forEach((packId) => {
    next[packId] = Math.max(0, Math.min(999, Math.floor(toNumber(source[packId], foxpayDefaultReferralTicketRewards[packId]))));
  });
  return next;
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeTaskUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url.slice(0, 500) : '';
}

function normalizeSocialPlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  if (['instagram', 'tiktok', 'telegram', 'youtube'].includes(platform)) return platform;
  return 'youtube';
}

function normalizePartnerTaskKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

function normalizeTaskLanguage(value = '') {
  const language = String(value || '').trim().toLowerCase();
  if (['es', 'en', 'pt'].includes(language)) return language;
  return 'all';
}

function normalizeClientLanguage(value = '') {
  const language = String(value || '').trim().toLowerCase();
  if (language.startsWith('es')) return 'es';
  if (language.startsWith('pt')) return 'pt';
  return 'en';
}

function normalizeRewardType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (['tokens', 'tickets', 'avatar', 'skin', 'none'].includes(type)) return type;
  return 'none';
}

function normalizeRouletteReward(row = {}) {
  return {
    id: String(row.id || '').trim(),
    package_id: String(row.package_id || 'free').trim() || 'free',
    label: String(row.label || 'Try again').trim().slice(0, 80),
    reward_type: normalizeRewardType(row.reward_type),
    amount: Math.max(0, toNumber(row.amount, 0)),
    item_id: String(row.item_id || '').trim().slice(0, 120),
    weight: Math.max(0, Math.floor(toNumber(row.weight, 1))),
    active: row.active === undefined ? true : settingEnabled(row.active),
    sort_order: Math.max(0, Math.floor(toNumber(row.sort_order, 0))),
  };
}

function normalizePackageIdList(value = []) {
  let items = Array.isArray(value) ? value : String(value || '').split(',');
  if (!Array.isArray(value)) {
    try {
      const parsed = JSON.parse(String(value || '[]'));
      if (Array.isArray(parsed)) items = parsed;
    } catch {}
  }
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 40);
}

function normalizeFoxPaySkin(row = {}) {
  return {
    id: String(row.id || '').trim().slice(0, 80),
    name: String(row.name || 'Fox skin').trim().slice(0, 80),
    image_url: String(row.image_url || '').trim().slice(0, 500),
    price_usdt: Math.max(0, toNumber(row.price_usdt, 0)),
    tap_bonus_per_day: Math.max(0, Math.floor(toNumber(row.tap_bonus_per_day, 0))),
    roulette_package_ids: normalizePackageIdList(row.roulette_package_ids || []),
    active: row.active === undefined ? true : settingEnabled(row.active),
    sort_order: Math.max(0, Math.floor(toNumber(row.sort_order, 0))),
  };
}

function normalizeRankId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeRankRequirements(value = {}) {
  const source = parseJsonObject(value);
  const next = {};
  Object.entries(source).forEach(([rankId, count]) => {
    const id = normalizeRankId(rankId);
    const amount = Math.max(0, Math.min(999, Math.floor(toNumber(count, 0))));
    if (id && amount > 0) next[id] = amount;
  });
  return next;
}

function normalizeFoxPayRank(row = {}) {
  const fallbackId = normalizeRankId(row.name || 'rank');
  const id = normalizeRankId(row.id || fallbackId || `rank-${Date.now()}`);
  return {
    id,
    name: String(row.name || id || 'Rank').trim().slice(0, 80),
    image_url: String(row.image_url || '').trim().slice(0, 450000),
    required_directs: Math.max(0, Math.min(999999, Math.floor(toNumber(row.required_directs, 0)))),
    required_lifetime_usd: Math.max(0, toNumber(row.required_lifetime_usd, 0)),
    team_requirements: normalizeRankRequirements(row.team_requirements || {}),
    active: row.active === undefined ? true : settingEnabled(row.active),
    sort_order: Math.max(0, Math.floor(toNumber(row.sort_order, 0))),
  };
}

function normalizePackageTaskConfig(value = {}) {
  const raw = parseJsonObject(value);
  const videos = Array.isArray(raw.videos) ? raw.videos : [];
  const socials = Array.isArray(raw.socials) ? raw.socials : [];
  const partners = Array.isArray(raw.partners) ? raw.partners : [];
  const dailyVideoMin = Math.max(0, Math.min(30, Math.floor(toNumber(raw.daily_video_min, 0))));
  const dailyVideoMax = Math.max(dailyVideoMin, Math.min(30, Math.floor(toNumber(raw.daily_video_max, dailyVideoMin))));
  return {
    daily_video_min: dailyVideoMin,
    daily_video_max: dailyVideoMax,
    referral_task: normalizeReferralTaskConfig(raw.referral_task),
    videos: videos.map((item, index) => ({
      id: `youtube_${index + 1}`,
      type: 'youtube',
      title: String(item.title || `Ver video ${index + 1}`).trim().slice(0, 80),
      description: String(item.description || '').trim().slice(0, 140),
      url: normalizeTaskUrl(item.url),
      language: normalizeTaskLanguage(item.language),
      active: item.active === undefined ? true : settingEnabled(item.active),
      watch_seconds: Math.max(10, Math.min(600, Math.floor(toNumber(item.watch_seconds, 30)))),
      reward_delay_seconds: Math.max(0, Math.min(3600, Math.floor(toNumber(item.reward_delay_seconds, 30)))),
      reward_tokens: 0,
    })).filter((item) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(item.url)).slice(0, 90),
    socials: socials.map((item, index) => ({
      id: `social_${index + 1}`,
      type: 'social',
      platform: normalizeSocialPlatform(item.platform),
      title: String(item.title || 'Seguir canal').trim().slice(0, 80),
      description: String(item.description || '').trim().slice(0, 140),
      url: normalizeTaskUrl(item.url),
      required: item.required === undefined ? true : settingEnabled(item.required),
      wait_seconds: Math.max(0, Math.min(600, Math.floor(toNumber(item.wait_seconds, 15)))),
      reward_delay_seconds: Math.max(0, Math.min(3600, Math.floor(toNumber(item.reward_delay_seconds, 0)))),
      reward_tokens: 0,
    })).filter((item) => item.url).slice(0, 12),
    partners: partners.map((item, index) => {
      const validationKey = normalizePartnerTaskKey(item.validation_key || item.sub2 || `partner_${index + 1}`);
      return {
        id: `partner_${index + 1}`,
        type: 'partner',
        provider: String(item.provider || 'gemiad').trim().toLowerCase().slice(0, 40) || 'gemiad',
        title: String(item.title || 'Complete partner task').trim().slice(0, 80),
        description: String(item.description || 'Complete the partner task and wait for verification.').trim().slice(0, 140),
        url: normalizeTaskUrl(item.url),
        required: item.required === undefined ? true : settingEnabled(item.required),
        active: item.active === undefined ? true : settingEnabled(item.active),
        validation_key: validationKey,
        offer_id: String(item.offer_id || '').trim().slice(0, 120),
        event_match: String(item.event_match || item.event_id || item.event_name || '').trim().slice(0, 160),
        reward_tokens: 0,
      };
    }).filter((item) => item.url && item.validation_key).slice(0, 12),
  };
}

function normalizeReferralTaskConfig(value = {}, packageId = 'free') {
  const raw = parseJsonObject(value);
  const defaults = defaultReferralTaskRule(packageId);
  const validation = String(raw.validation || defaults.validation || 'created').toLowerCase();
  return {
    enabled: raw.enabled === undefined ? Boolean(defaults.enabled) : settingEnabled(raw.enabled),
    required: raw.required === undefined ? Boolean(defaults.required) : settingEnabled(raw.required),
    probability: Math.max(0, Math.min(100, Math.floor(toNumber(raw.probability, defaults.probability)))),
    first_target: Math.max(1, Math.min(20, Math.floor(toNumber(raw.first_target, defaults.first_target)))),
    repeat_target: Math.max(1, Math.min(20, Math.floor(toNumber(raw.repeat_target, defaults.repeat_target)))),
    cooldown_days: Math.max(0, Math.min(30, Math.floor(toNumber(raw.cooldown_days, defaults.cooldown_days)))),
    validation: validation === 'registered' ? 'registered' : 'created',
  };
}

function legacyVideoUrlsToTaskConfig(videoUrls = []) {
  return {
    videos: normalizeYoutubeUrls(videoUrls).map((url, index) => ({
      id: `youtube_${index + 1}`,
      type: 'youtube',
      title: `Ver video ${index + 1}`,
      description: 'Mira al menos 30 segundos',
      url,
      language: 'all',
      active: true,
      watch_seconds: 30,
      reward_delay_seconds: 30,
      reward_tokens: 0,
    })),
    socials: [],
  };
}

function defaultDailyVideoRange(pack = {}) {
  const id = String(pack.id || '');
  const price = Number(pack.price_usdt || 0);
  if (id === 'free' || price <= 0) return { min: 4, max: 6 };
  if (price <= 30) return { min: 3, max: 5 };
  if (price <= 60) return { min: 2, max: 4 };
  if (price <= 120) return { min: 2, max: 3 };
  if (price <= 480) return { min: 1, max: 2 };
  return { min: 1, max: 1 };
}

function foxPayPlayerCreatedKey(player = {}, settings = foxpayDefaultSettings) {
  const createdAt = Date.parse(player.created_at || '');
  if (!Number.isFinite(createdAt)) return '';
  return foxpayCycleKeyForTime(settings, createdAt);
}

function foxPayIsFreeOnboardingDay(player = {}, settings = foxpayDefaultSettings, pack = player._package || {}) {
  const packageId = String(pack?.id || player.active_package_id || 'free');
  const isFreePack = packageId === 'free' || toNumber(pack?.price_usdt, 0) <= 0;
  if (!isFreePack) return false;
  const createdKey = foxPayPlayerCreatedKey(player, settings);
  if (!createdKey) return false;
  const today = player.daily_key || foxpayTodayKey(settings);
  return foxpayDayDiff(today, createdKey) === 0;
}

function seededInteger(seed, min, max) {
  const low = Math.floor(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  const value = parseInt(md5(seed).slice(0, 8), 16);
  return low + (value % ((high - low) + 1));
}

function seededShuffle(items = [], seed = '') {
  return items
    .map((item, index) => ({ item, order: md5(`${seed}:${index}:${item.url || item.title || ''}`) }))
    .sort((left, right) => left.order.localeCompare(right.order))
    .map((entry) => entry.item);
}

function packageVideoTemplates(pack = {}) {
  const taskConfig = normalizePackageTaskConfig(pack.task_config || {});
  const legacyConfig = legacyVideoUrlsToTaskConfig(pack.video_urls || []);
  return taskConfig.videos.length ? taskConfig.videos : legacyConfig.videos;
}

function applyFreeVideoFallback(packages = []) {
  const freePack = packages.find((pack) => pack.id === 'free') || {};
  const freeVideos = packageVideoTemplates(freePack);
  return packages.map((pack) => {
    const rawTaskConfig = parseJsonObject(pack.task_config || {});
    const currentConfig = normalizePackageTaskConfig(pack.task_config || {});
    currentConfig.referral_task = Object.keys(parseJsonObject(rawTaskConfig.referral_task || {})).length
      ? normalizeReferralTaskConfig(rawTaskConfig.referral_task, pack.id)
      : defaultReferralTaskRule(pack.id);
    if (!freeVideos.length || currentConfig.videos.length || normalizeYoutubeUrls(pack.video_urls || []).length) {
      return { ...pack, task_config: currentConfig };
    }
    return {
      ...pack,
      task_config: {
        ...currentConfig,
        videos: freeVideos.map((source, index) => {
          return {
            ...source,
            id: `youtube_${index + 1}`,
            title: source.title || `Ver video ${index + 1}`,
          };
        }),
      },
    };
  });
}

function normalizeSeasonDate(value, fallback = '') {
  if (value === undefined) return fallback || '';
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? (fallback || '') : date.toISOString();
}

function normalizeSeasonImage(value, fallback = '') {
  const image = String(value || '').trim();
  if (!image) return fallback || '';
  if (image === '__remove__') return '';
  if (image.startsWith('./images/') || image.startsWith('/images/')) return image.slice(0, 240);
  if (!image.startsWith('data:image/webp;base64,')) return fallback || '';
  return image.length <= 650000 ? image : fallback || '';
}

function normalizeFoxPaySeasonSchedule(value) {
  let items = value;
  if (typeof value === 'string') {
    try {
      items = JSON.parse(value);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items) || !items.length) items = foxPayDefaultSeasonSchedule(2026);
  return items
    .map((item, index) => {
      const id = String(item?.id || `season-${index + 1}`).trim().slice(0, 40);
      const startAt = normalizeSeasonDate(item?.start_at || item?.season_start_at || item?.start, '');
      const endAt = normalizeSeasonDate(item?.end_at || item?.season_end_at || item?.end, '');
      if (!id || !startAt || !endAt) return null;
      return {
        id,
        name: String(item?.name || item?.season_name || id).trim().slice(0, 80),
        start_at: startAt,
        end_at: endAt,
        winner_limit: Math.max(1, Math.min(100, Math.round(toNumber(item?.winner_limit ?? item?.season_winner_limit, 20)))),
        reward_tokens: Math.max(0, Math.floor(toNumber(
          item?.reward_tokens
            ?? item?.season_reward_tokens
            ?? (toNumber(item?.reward_per_winner, 0) * toNumber(item?.winner_limit ?? item?.season_winner_limit, 20)),
          0,
        ))),
        reward_mode: ['equal', 'competitive'].includes(String(item?.reward_mode || '').toLowerCase())
          ? String(item.reward_mode).toLowerCase()
          : 'competitive',
        image_url: normalizeSeasonImage(item?.image_url ?? item?.season_image_url, ''),
        active: item?.active === undefined ? true : settingEnabled(item.active),
      };
    })
    .filter(Boolean)
    .sort((left, right) => String(left.start_at).localeCompare(String(right.start_at)))
    .slice(0, 24);
}

function activeFoxPayScheduledSeason(settings = {}, now = new Date()) {
  const schedule = normalizeFoxPaySeasonSchedule(settings.season_schedule);
  const time = now.getTime();
  return schedule.find((item) => {
    if (!item.active) return false;
    const start = new Date(item.start_at).getTime();
    const end = new Date(item.end_at).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && time >= start && time <= end;
  }) || null;
}

function applyFoxPaySeasonSchedule(settings = {}, now = new Date()) {
  const schedule = normalizeFoxPaySeasonSchedule(settings.season_schedule);
  const active = activeFoxPayScheduledSeason({ ...settings, season_schedule: schedule }, now);
  const next = { ...settings, season_schedule: schedule };
  if (active) {
    next.season_name = active.name;
    next.season_start_at = active.start_at;
    next.season_end_at = active.end_at;
    next.season_winner_limit = active.winner_limit;
    next.season_reward_tokens = active.reward_tokens;
    next.season_reward_mode = active.reward_mode;
    next.season_image_url = active.image_url || '';
    next.season_schedule_active_id = active.id;
  } else {
    next.season_name = '';
    next.season_start_at = '';
    next.season_end_at = '';
    next.season_winner_limit = Math.max(1, Math.min(100, Math.round(toNumber(next.season_winner_limit, 20))));
    next.season_reward_tokens = 0;
    next.season_reward_mode = 'competitive';
    next.season_image_url = '';
    next.season_schedule_active_id = '';
  }
  const currentSeasonKey = foxPaySeasonPeriodKey(next);
  if (next.season_paid_key && next.season_paid_key !== currentSeasonKey) {
    next.season_paid_at = '';
    next.season_paid_key = '';
    next.season_paid_winners = [];
  }
  return next;
}

function foxPaySeasonPeriodKey(settings = {}) {
  return [
    settings.season_name || '',
    settings.season_start_at || '',
    settings.season_end_at || '',
  ].join('|');
}

function foxPaySeasonStatus(settings = {}, now = new Date()) {
  const start = settings.season_start_at ? new Date(settings.season_start_at) : null;
  const end = settings.season_end_at ? new Date(settings.season_end_at) : null;
  const hasStart = start && !Number.isNaN(start.getTime());
  const hasEnd = end && !Number.isNaN(end.getTime());
  if (!hasStart || !hasEnd) return 'none';
  if (now < start) return 'scheduled';
  if (now > end) return 'ended';
  return 'active';
}

function foxPayPlayerSeasonEarned(player = {}, settings = {}) {
  const seasonKey = foxPaySeasonPeriodKey(settings);
  if (!seasonKey || player.season_key !== seasonKey) return 0;
  return Math.max(0, Math.floor(toNumber(player.season_earned_tokens, 0)));
}

function foxPaySeasonRewardDistribution(poolTokens, winners = [], mode = 'competitive') {
  const pool = Math.max(0, Math.floor(toNumber(poolTokens, 0)));
  const count = Math.max(0, winners.length);
  if (!pool || !count) return [];
  if (mode === 'equal') {
    const base = Math.floor(pool / count);
    let remainder = pool - (base * count);
    return winners.map((winner, index) => {
      const tokens = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return { winner, position: index + 1, reward_tokens: tokens };
    });
  }
  const weights = winners.map((_, index) => {
    const position = index + 1;
    if (position === 1) return 25;
    if (position === 2) return 15;
    if (position === 3) return 10;
    if (position <= 10) return 5;
    return 1.5;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const rows = winners.map((winner, index) => ({
    winner,
    position: index + 1,
    reward_tokens: Math.floor((pool * weights[index]) / totalWeight),
  }));
  let remainder = pool - rows.reduce((sum, row) => sum + row.reward_tokens, 0);
  for (const row of rows) {
    if (remainder <= 0) break;
    row.reward_tokens += 1;
    remainder -= 1;
  }
  return rows;
}

function normalizeWithdrawalNetwork(value) {
  const network = String(value || '').trim().toLowerCase();
  if (['polygon', 'matic'].includes(network)) return 'polygon';
  if (['bep20', 'bsc', 'bnb'].includes(network)) return 'bep20';
  if (['tron', 'trc20', 'trx'].includes(network)) return 'tron';
  return '';
}

function normalizePaymentNetwork(value) {
  return normalizeWithdrawalNetwork(value) || 'bep20';
}

function nowPaymentsCurrencyForNetwork(network) {
  return {
    bep20: 'usdtbsc',
    polygon: 'usdtmatic',
    tron: 'usdttrc20',
  }[normalizePaymentNetwork(network)] || 'usdtbsc';
}

function paymentQrUrl(payment) {
  const address = String(payment?.pay_address || '').trim();
  if (!address) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(address)}`;
}

function isValidEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function isValidTronAddress(value) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value || '').trim());
}

function isValidWithdrawalAddress(value, network) {
  const safeNetwork = normalizeWithdrawalNetwork(network);
  if (safeNetwork === 'tron') return isValidTronAddress(value);
  if (['bep20', 'polygon'].includes(safeNetwork)) return isValidEvmAddress(value);
  return false;
}

function explorerTxUrl(network, txHash) {
  const hash = String(txHash || '').trim();
  if (/^https:\/\/(www\.)?(bscscan\.com|polygonscan\.com)\/tx\/0x[a-fA-F0-9]{64}(?:[/?#].*)?$/.test(hash)) {
    return hash;
  }
  if (/^https:\/\/(www\.)?tronscan\.org\/#\/transaction\/[a-fA-F0-9]{64}(?:[/?#].*)?$/.test(hash)) {
    return hash;
  }
  if (network === 'tron' && /^[a-fA-F0-9]{64}$/.test(hash)) return `https://tronscan.org/#/transaction/${hash}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return '';
  if (network === 'polygon') return `https://polygonscan.com/tx/${hash}`;
  if (network === 'bep20') return `https://bscscan.com/tx/${hash}`;
  return '';
}

function normalizeTxReference(value, network = '') {
  const raw = String(value || '').trim();
  const fullUrlMatch = raw.match(/^https:\/\/(?:www\.)?(bscscan\.com|polygonscan\.com)\/tx\/(0x[a-fA-F0-9]{64})(?:[/?#].*)?$/);
  if (fullUrlMatch) {
    const domain = fullUrlMatch[1];
    return {
      ok: true,
      value: raw,
      hash: fullUrlMatch[2],
      network: domain === 'polygonscan.com' ? 'polygon' : 'bep20',
      url: raw,
    };
  }
  const tronUrlMatch = raw.match(/^https:\/\/(?:www\.)?tronscan\.org\/#\/transaction\/([a-fA-F0-9]{64})(?:[/?#].*)?$/);
  if (tronUrlMatch) {
    return {
      ok: true,
      value: raw,
      hash: tronUrlMatch[1],
      network: 'tron',
      url: raw,
    };
  }
  if (normalizeWithdrawalNetwork(network) === 'tron' && /^[a-fA-F0-9]{64}$/.test(raw)) {
    return {
      ok: true,
      value: raw,
      hash: raw,
      network: 'tron',
      url: explorerTxUrl('tron', raw),
    };
  }
  if (/^0x[a-fA-F0-9]{64}$/.test(raw)) {
    const safeNetwork = normalizeWithdrawalNetwork(network) || 'bep20';
    return {
      ok: true,
      value: raw,
      hash: raw,
      network: safeNetwork,
      url: explorerTxUrl(safeNetwork, raw),
    };
  }
  if (
    raw.length >= 8
    && raw.length <= 140
    && /^[\p{L}\p{N}\s._:#/()\-]+$/u.test(raw)
    && /\d{6,}/.test(raw)
  ) {
    return {
      ok: true,
      value: raw,
      hash: raw,
      network: normalizeWithdrawalNetwork(network) || '',
      url: '',
    };
  }
  return { ok: false, value: raw, hash: '', network: normalizeWithdrawalNetwork(network) || '', url: '' };
}

function foxPayIdentityLockKeys(payload, settings) {
  const signupIp = String(payload.signup_ip || '').trim();
  const deviceKey = String(payload.device_key || '').trim();
  const locks = [];
  if (settingEnabled(settings.block_same_ip) && signupIp) {
    locks.push(`foxpay:signup_ip:${signupIp}`);
  }
  if (settingEnabled(settings.block_same_device)) {
    if (deviceKey) locks.push(`foxpay:device_key:${deviceKey}`);
  }
  return [...new Set(locks)];
}

async function lockFoxPayIdentity(client, payload, settings) {
  const locks = foxPayIdentityLockKeys(payload, settings);
  for (const key of locks) {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
  }
}

async function findFoxPayDuplicateIdentity(playerId, payload, settings, db = pool) {
  if (!settingEnabled(settings.block_same_ip) && !settingEnabled(settings.block_same_device)) {
    return null;
  }

  const signupIp = String(payload.signup_ip || '').trim();
  const deviceKey = String(payload.device_key || '').trim();

  if (!pool) {
    const rows = [...foxpayPlayers.values()].filter((row) => row.player_id !== playerId);
    if (settingEnabled(settings.block_same_ip) && signupIp && rows.some((row) => row.signup_ip === signupIp)) {
      return { reason: 'ip_already_used' };
    }
    if (settingEnabled(settings.block_same_device)) {
      const duplicateDevice = Boolean(deviceKey && rows.some((row) => row.device_key === deviceKey));
      if (duplicateDevice) return { reason: 'device_already_used' };
    }
    return null;
  }

  if (settingEnabled(settings.block_same_ip) && signupIp) {
    const duplicateIp = await db.query(
      'select player_id from foxpay_players where signup_ip = $1 and player_id <> $2 limit 1',
      [signupIp, playerId],
    );
    if (duplicateIp.rowCount) return { reason: 'ip_already_used' };
  }

  if (settingEnabled(settings.block_same_device)) {
    const duplicateDevice = await db.query(
      `select player_id from foxpay_players
       where player_id <> $2
         and (
           $1 <> '' and device_key = $1
         )
       limit 1`,
      [deviceKey, playerId],
    );
    if (duplicateDevice.rowCount) return { reason: 'device_already_used' };
  }

  return null;
}

async function ensureFoxPayPlayer(playerId, payload = {}) {
  const packageId = payload.package_id || 'free';
  const pack = await getFoxPayPackage(packageId);
  const settings = await getFoxPaySettings();
  const maintenanceReset = await getFoxPayMaintenanceState();

  if (!pool) {
    if (!foxpayPlayers.has(playerId)) {
      if (!foxPayPlayerIdMatchesReset(playerId, maintenanceReset)) {
        const error = new Error('stale_player_id_reset');
        error.code = 'stale_player_id_reset';
        error.maintenance_reset = maintenanceReset;
        error.reset_player_prefix = foxPayResetPlayerPrefix(maintenanceReset);
        throw error;
      }
      const existingPlayer = await findFoxPayDuplicateIdentity(playerId, payload, settings);
      if (existingPlayer) {
        const error = new Error(existingPlayer.reason);
        error.code = existingPlayer.reason;
        throw error;
      }
      foxpayPlayers.set(playerId, normalizeFoxPayPlayer({
        player_id: playerId,
        username: payload.username || defaultFoxPayUsername(playerId),
        email: '',
        password_hash: '',
        password_salt: '',
        account_token: '',
        registered_at: null,
        last_login_at: null,
        signup_ip: payload.signup_ip || '',
        country_code: payload.country_code || '',
        country_name: payload.country_name || '',
        device_key: payload.device_key || '',
        device_label: payload.device_label || detectDeviceLabel(payload.user_agent || ''),
        user_agent: payload.user_agent || '',
        selected_avatar_id: 'fox-default',
        owned_avatars: ['fox-default'],
        created_at: new Date().toISOString(),
        withdrawal_wallet: '',
        withdrawal_network: 'bep20',
        referrer_id: payload.referrer_id || '',
        account_status: 'active',
        token_balance: 0,
        roulette_tickets: 0,
        total_earned_usd: 0,
        lifetime_earned_usd: 0,
        season_key: '',
        season_earned_tokens: 0,
        total_withdrawn_usd: 0,
        active_package_id: 'free',
        energy: pack.daily_energy,
        max_energy: pack.daily_energy,
        daily_key: foxpayTodayKey(settings),
        streak_days: 0,
        streak_last_key: '',
        daily_tasks: {},
        task_progress: { taps: 0 },
        referral_task_state: {},
      }, pack, settings));
    }
    return normalizeFoxPayPlayer(foxpayPlayers.get(playerId), await getFoxPayPackage(foxpayPlayers.get(playerId).active_package_id), settings);
  }

  const existingById = await pool.query('select player_id from foxpay_players where player_id = $1 limit 1', [playerId]);
  if (!existingById.rowCount && !foxPayPlayerIdMatchesReset(playerId, maintenanceReset)) {
    const error = new Error('stale_player_id_reset');
    error.code = 'stale_player_id_reset';
    error.maintenance_reset = maintenanceReset;
    error.reset_player_prefix = foxPayResetPlayerPrefix(maintenanceReset);
    throw error;
  }
  if (!existingById.rowCount) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await lockFoxPayIdentity(client, payload, settings);
      const racedExisting = await client.query('select player_id from foxpay_players where player_id = $1 limit 1', [playerId]);
      if (!racedExisting.rowCount) {
        const existingPlayer = await findFoxPayDuplicateIdentity(playerId, payload, settings, client);
        if (existingPlayer) {
          const error = new Error(existingPlayer.reason);
          error.code = existingPlayer.reason;
          throw error;
        }
        await client.query(
          `insert into foxpay_players
           (player_id, username, referrer_id, active_package_id, energy, max_energy, daily_key, streak_days, streak_last_key, task_progress, signup_ip, country_code, country_name, device_key, device_label, user_agent, selected_avatar_id, owned_avatars, roulette_tickets, season_key, season_earned_tokens)
           values ($1, $2, $3, 'free', $4, $4, $5, 0, '', '{"taps":0}'::jsonb, $6, $7, $8, $9, $10, $11, 'fox-default', '["fox-default"]'::jsonb, 0, '', 0)`,
          [
            playerId,
            payload.username || defaultFoxPayUsername(playerId),
            payload.referrer_id || null,
            pack.daily_energy,
            foxpayTodayKey(settings),
            payload.signup_ip || null,
            payload.country_code || null,
            payload.country_name || null,
            payload.device_key || null,
            payload.device_label || detectDeviceLabel(payload.user_agent || '') || null,
            payload.user_agent || null,
          ],
        );
      }
      await client.query('commit');
    } catch (error) {
      try { await client.query('rollback'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  const result = await pool.query('select * from foxpay_players where player_id = $1', [playerId]);
  const player = result.rows[0];
  const activePack = await getFoxPayPackage(player.active_package_id);
  const normalized = normalizeFoxPayPlayer(player, activePack, settings);
  if (!normalized.signup_ip && payload.signup_ip) normalized.signup_ip = payload.signup_ip;
  if (!normalized.country_code && payload.country_code) normalized.country_code = payload.country_code;
  if (!normalized.country_name && payload.country_name) normalized.country_name = payload.country_name;
  if (!normalized.device_key && payload.device_key) normalized.device_key = payload.device_key;
  if (!normalized.device_label && payload.device_label) normalized.device_label = payload.device_label;
  if (!normalized.user_agent && payload.user_agent) normalized.user_agent = payload.user_agent;

  if (
    normalized.daily_key !== player.daily_key
    || normalized.signup_ip !== (player.signup_ip || '')
    || normalized.country_code !== (player.country_code || '')
    || normalized.device_key !== (player.device_key || '')
    || normalized.user_agent !== (player.user_agent || '')
    || normalized.streak_days !== Number(player.streak_days || 0)
  ) {
    await saveFoxPayPlayer(normalized);
  }

  return normalized;
}

async function saveFoxPayPlayer(player) {
  if (!pool) {
    foxpayPlayers.set(player.player_id, { ...player });
    return player;
  }

  await pool.query(
    `update foxpay_players
     set username = $2,
         referrer_id = $3,
         token_balance = $4,
         roulette_tickets = $5,
         total_earned_usd = $6,
         lifetime_earned_usd = $7,
         season_key = $8,
         season_earned_tokens = $9,
         total_withdrawn_usd = $10,
         active_package_id = $11,
         energy = $12,
         max_energy = $13,
         daily_key = $14,
         daily_tasks = $15::jsonb,
         task_progress = $16::jsonb,
         password_hash = $17,
         password_salt = $18,
         account_token = $19,
         registered_at = $20,
         last_login_at = $21,
         signup_ip = $22,
         country_code = $23,
         country_name = $24,
         device_key = $25,
         device_label = $26,
         user_agent = $27,
         selected_avatar_id = $28,
         owned_avatars = $29::jsonb,
         owned_skins = $30::jsonb,
         selected_skins = $31::jsonb,
         skin_taps_daily_key = $32,
         withdrawal_wallet = $33,
         withdrawal_network = $34,
         streak_days = $35,
         streak_last_key = $36,
         referral_task_state = $37::jsonb,
         account_status = $38,
         email = $39,
         game_fox_balance = $40,
         passive_income_per_hour = $41,
         last_passive_claim_timestamp = $42,
         upgrade_cards_levels = $43::jsonb,
         free_withdrawal_claimed = $44,
         updated_at = now()
     where player_id = $1`,
    [
      player.player_id,
      player.username,
      player.referrer_id || null,
      player.token_balance,
      Math.max(0, Math.floor(Number(player.roulette_tickets || 0))),
      player.total_earned_usd,
      Math.max(0, toNumber(player.lifetime_earned_usd, player.total_earned_usd || 0)),
      player.season_key || '',
      Math.max(0, Math.floor(Number(player.season_earned_tokens || 0))),
      player.total_withdrawn_usd,
      player.active_package_id,
      player.energy,
      player.max_energy,
      player.daily_key,
      JSON.stringify(player.daily_tasks || {}),
      JSON.stringify(player.task_progress || {}),
      player.password_hash || null,
      player.password_salt || null,
      player.account_token || null,
      player.registered_at || null,
      player.last_login_at || null,
      player.signup_ip || null,
      player.country_code || null,
      player.country_name || null,
      player.device_key || null,
      player.device_label || null,
      player.user_agent || null,
      player.selected_avatar_id || 'fox-default',
      JSON.stringify(Array.isArray(player.owned_avatars) ? player.owned_avatars : ['fox-default']),
      JSON.stringify(Array.isArray(player.owned_skins) ? player.owned_skins : []),
      JSON.stringify(Array.isArray(player.selected_skins) ? player.selected_skins.slice(0, 2) : []),
      player.skin_taps_daily_key || '',
      player.withdrawal_wallet || '',
      normalizeWithdrawalNetwork(player.withdrawal_network) || 'bep20',
      Math.max(0, Math.floor(Number(player.streak_days || 0))),
      player.streak_last_key || '',
      JSON.stringify(player.referral_task_state || {}),
      foxPayAccountEnabled(player) ? 'active' : 'disabled',
      normalizeFoxPayEmail(player.email || ''),
      toNumber(player.game_fox_balance, 0),
      toNumber(player.passive_income_per_hour, 0),
      player.last_passive_claim_timestamp || new Date().toISOString(),
      JSON.stringify(player.upgrade_cards_levels || {}),
      Boolean(player.free_withdrawal_claimed),
    ],
  );
  return player;
}

function foxPayDailyStatsMemoryKey(playerId, dailyKey) {
  return `${playerId}::${dailyKey}`;
}

function sanitizeFoxPayDailyStats(row = {}) {
  return {
    player_id: row.player_id || '',
    daily_key: row.daily_key || '',
    active_package_id: row.active_package_id || 'free',
    max_energy: Math.max(0, Math.floor(Number(row.max_energy || 0))),
    energy_used: Math.max(0, Math.floor(Number(row.energy_used || 0))),
    energy_remaining: Math.max(0, Math.floor(Number(row.energy_remaining || 0))),
    taps: Math.max(0, Math.floor(Number(row.taps || 0))),
    earned_tokens: Math.max(0, toNumber(row.earned_tokens)),
    earned_usd: Math.max(0, toNumber(row.earned_usd)),
    completed_task_count: Math.max(0, Math.floor(Number(row.completed_task_count || 0))),
    completed_tasks: Array.isArray(row.completed_tasks) ? row.completed_tasks : [],
    required_video_count: Math.max(0, Math.floor(Number(row.required_video_count || 0))),
    token_price_usd: Math.max(0, toNumber(row.token_price_usd)),
    last_activity_at: row.last_activity_at || '',
    updated_at: row.updated_at || '',
  };
}

function buildFoxPayDailyStatsSnapshot(player, settings, pack = player?._package || {}) {
  const dailyKey = player?.daily_key || foxpayTodayKey(settings);
  const maxEnergy = Math.max(0, Math.floor(Number(player?.max_energy || pack?.daily_energy || 0)));
  const energyRemaining = Math.max(0, Math.min(maxEnergy, Math.floor(Number(player?.energy ?? maxEnergy))));
  const taskProgress = player?.task_progress && typeof player.task_progress === 'object' ? player.task_progress : {};
  const taps = Math.max(0, Math.floor(Number(taskProgress.taps || 0)));
  const energyUsed = Math.max(taps, maxEnergy - energyRemaining);
  const tokenPrice = toNumber(settings?.token_price_usd, 0.0001);
  const tapReward = Math.max(0, toNumber(pack?.tap_reward_tokens, 1));
  const completedTasks = Object.keys(player?.daily_tasks || {})
    .filter((key) => player.daily_tasks[key] === true && !String(key).startsWith('__'))
    .sort();

  return sanitizeFoxPayDailyStats({
    player_id: player.player_id,
    daily_key: dailyKey,
    active_package_id: player.active_package_id || pack?.id || 'free',
    max_energy: maxEnergy,
    energy_used: energyUsed,
    energy_remaining: energyRemaining,
    taps,
    earned_tokens: taps * tapReward,
    earned_usd: taps * tapReward * tokenPrice,
    completed_task_count: completedTasks.length,
    completed_tasks: completedTasks,
    required_video_count: Math.max(0, Math.floor(Number(player.required_video_count || 0))),
    token_price_usd: tokenPrice,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function upsertFoxPayPlayerDailyStats(player, settings = foxpayDefaultSettings, pack = player?._package || {}) {
  if (!player?.player_id) return null;
  const snapshot = buildFoxPayDailyStatsSnapshot(player, settings, pack);
  if (!snapshot.daily_key) return null;

  if (!pool) {
    foxpayPlayerDailyStatsMemory.set(foxPayDailyStatsMemoryKey(snapshot.player_id, snapshot.daily_key), snapshot);
    return snapshot;
  }

  const result = await pool.query(
    `insert into foxpay_player_daily_stats
       (player_id, daily_key, active_package_id, max_energy, energy_used, energy_remaining, taps, earned_tokens, earned_usd,
        completed_task_count, completed_tasks, required_video_count, token_price_usd, last_activity_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, now(), now())
     on conflict (player_id, daily_key)
     do update set active_package_id = excluded.active_package_id,
                   max_energy = excluded.max_energy,
                   energy_used = excluded.energy_used,
                   energy_remaining = excluded.energy_remaining,
                   taps = excluded.taps,
                   earned_tokens = excluded.earned_tokens,
                   earned_usd = excluded.earned_usd,
                   completed_task_count = excluded.completed_task_count,
                   completed_tasks = excluded.completed_tasks,
                   required_video_count = excluded.required_video_count,
                   token_price_usd = excluded.token_price_usd,
                   last_activity_at = now(),
                   updated_at = now()
     returning *`,
    [
      snapshot.player_id,
      snapshot.daily_key,
      snapshot.active_package_id,
      snapshot.max_energy,
      snapshot.energy_used,
      snapshot.energy_remaining,
      snapshot.taps,
      snapshot.earned_tokens,
      snapshot.earned_usd,
      snapshot.completed_task_count,
      JSON.stringify(snapshot.completed_tasks),
      snapshot.required_video_count,
      snapshot.token_price_usd,
    ],
  );
  return sanitizeFoxPayDailyStats(result.rows[0]);
}

async function listFoxPayPlayerDailyStats(playerIds = [], perPlayerLimit = 7) {
  const ids = [...new Set((playerIds || []).filter(Boolean))];
  const limit = Math.max(1, Math.min(30, Math.floor(Number(perPlayerLimit || 7))));
  if (!ids.length) return [];

  if (!pool) {
    return [...foxpayPlayerDailyStatsMemory.values()]
      .filter((row) => ids.includes(row.player_id))
      .sort((a, b) => String(b.daily_key).localeCompare(String(a.daily_key)))
      .reduce((rows, row) => {
        const used = rows.filter((item) => item.player_id === row.player_id).length;
        if (used < limit) rows.push(sanitizeFoxPayDailyStats(row));
        return rows;
      }, []);
  }

  const result = await pool.query(
    `select *
     from (
       select stats.*,
              row_number() over (partition by player_id order by daily_key desc) as day_rank
       from foxpay_player_daily_stats stats
       where player_id = any($1)
     ) ranked
     where day_rank <= $2
     order by daily_key desc, player_id asc`,
    [ids, limit],
  );
  return result.rows.map(sanitizeFoxPayDailyStats);
}

function foxPayCapUsd(player, pack) {
  const price = toNumber(pack.price_usdt);
  return pack.id === 'free' || price <= 0 ? toNumber(pack.monthly_cap_usd, 3) : price * 3;
}

function enforceFoxPayCap(player, settings, pack = player._package) {
  if (!player || !pack) return { changed: false, lost_tokens: 0, lost_usd: 0 };
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const capUsd = foxPayCapUsd(player, pack);
  const beforeTokens = toNumber(player.token_balance);
  const beforeEarnedUsd = toNumber(player.total_earned_usd);
  const nextTokens = Math.max(0, Math.floor(beforeTokens));
  const nextEarnedUsd = Math.min(capUsd, Math.max(0, beforeEarnedUsd));

  player.token_balance = nextTokens;
  player.total_earned_usd = nextEarnedUsd;
  return {
    changed: player.token_balance !== beforeTokens || player.total_earned_usd !== beforeEarnedUsd,
    lost_tokens: Math.max(0, Math.floor((beforeEarnedUsd - nextEarnedUsd) / tokenPrice)),
    lost_usd: Math.max(0, beforeEarnedUsd - nextEarnedUsd),
  };
}

function foxPayCapReached(player, pack) {
  return toNumber(player.total_earned_usd) >= foxPayCapUsd(player, pack);
}

function resetFoxPayPlayerForPackage(player, pack, settings = foxpayDefaultSettings) {
  player.active_package_id = pack.id;
  player.roulette_tickets = 0;
  player.total_earned_usd = 0;
  player.max_energy = pack.daily_energy;
  player.energy = pack.daily_energy;
  player.daily_key = foxpayTodayKey(settings);
  player.daily_tasks = {};
  player.task_progress = { taps: 0 };
  player.referral_task_state = {};
  player.streak_days = 0;
  player.streak_last_key = '';
  return player;
}

function foxPayReferralTaskShouldAppear(player, settings = foxpayDefaultSettings, pack = player._package || {}) {
  const config = normalizeReferralTaskConfig(pack.task_config?.referral_task, pack.id);
  if (!config.enabled) return false;
  if (foxPayIsFreeOnboardingDay(player, settings, pack)) return true;
  if (config.probability <= 0) return false;
  const today = player.daily_key || foxpayTodayKey(settings);
  const state = player.referral_task_state || {};
  const todayProgress = player.task_progress?.referral_task;
  if (todayProgress?.daily_key === today) return true;
  const lastAssigned = state.last_assigned_key || '';
  const diff = foxpayDayDiff(today, lastAssigned);
  if (lastAssigned && diff !== null && diff >= 0 && diff <= config.cooldown_days) return false;
  const roll = seededInteger(`${player.player_id}:${today}:${pack.id}:referral_task`, 1, 100);
  return roll <= config.probability;
}

async function countFoxPayReferrals(playerId, validation = 'created') {
  if (!playerId) return 0;
  if (!pool) {
    return [...foxpayPlayers.values()].filter((player) => (
      player.referrer_id === playerId
      && (validation !== 'registered' || Boolean(player.password_hash))
    )).length;
  }
  const registeredOnly = validation === 'registered';
  const result = await pool.query(
    `select count(*)::int as total
     from foxpay_players
     where referrer_id = $1
       and ($2::boolean = false or password_hash is not null)`,
    [playerId, registeredOnly],
  );
  return Number(result.rows[0]?.total || 0);
}

async function foxPayReferralTask(player, settings = foxpayDefaultSettings, pack = player._package || {}) {
  const config = normalizeReferralTaskConfig(pack.task_config?.referral_task, pack.id);
  if (!foxPayReferralTaskShouldAppear(player, settings, pack)) return null;
  const today = player.daily_key || foxpayTodayKey(settings);
  const state = player.referral_task_state || {};
  const currentTotal = await countFoxPayReferrals(player.player_id, config.validation);
  let taskState = player.task_progress?.referral_task;
  let changed = false;
  if (!taskState || taskState.daily_key !== today) {
    const firstAssignment = !state.ever_assigned;
    taskState = {
      daily_key: today,
      baseline_count: currentTotal,
      target_count: firstAssignment ? config.first_target : config.repeat_target,
      validation: config.validation,
    };
    player.task_progress = {
      ...(player.task_progress || {}),
      referral_task: taskState,
    };
    player.referral_task_state = {
      ...state,
      ever_assigned: true,
      assigned_count: Math.max(0, Math.floor(Number(state.assigned_count || 0))) + 1,
      last_assigned_key: today,
      last_target_count: taskState.target_count,
      last_validation: config.validation,
    };
    changed = true;
  } else {
    const assignmentCount = Math.max(1, Math.floor(Number(state.assigned_count || 1)));
    const expectedTarget = assignmentCount <= 1 ? config.first_target : config.repeat_target;
    if (Math.floor(Number(taskState.target_count || 0)) !== expectedTarget || taskState.validation !== config.validation) {
      taskState = {
        ...taskState,
        target_count: expectedTarget,
        validation: config.validation,
      };
      player.task_progress = {
        ...(player.task_progress || {}),
        referral_task: taskState,
      };
      player.referral_task_state = {
        ...state,
        last_target_count: expectedTarget,
        last_validation: config.validation,
      };
      changed = true;
    }
  }
  const baseline = Math.max(0, Math.floor(Number(taskState.baseline_count || 0)));
  const goal = Math.max(1, Math.floor(Number(taskState.target_count || config.repeat_target || 1)));
  const progress = Math.max(0, currentTotal - baseline);
  return {
    id: 'referral_invites',
    type: 'referral',
    title: 'Invite friends',
    description: config.validation === 'registered'
      ? 'Share your link and get new registered referrals.'
      : 'Share your link and get new referrals.',
    required: config.required,
    progress: Math.min(goal, progress),
    goal,
    claimed: Boolean(player.daily_tasks?.referral_invites),
    ready: progress >= goal,
    referral_link: `https://foxpay.live/?ref=${encodeURIComponent(player.player_id)}`,
    baseline_count: baseline,
    current_count: currentTotal,
    validation: config.validation,
    changed,
  };
}

async function foxPayTasksReady(player, settings = foxpayDefaultSettings, pack = player._package || {}, context = {}) {
  if (player.active_package_id === 'free') {
    return true;
  }
  const tasks = player.daily_tasks || {};
  const requiredTaskIds = (await foxPayTaskPayload(player, settings, pack, context))
    .filter((task) => task.required !== false && task.id !== 'tap_goal')
    .map((task) => task.id);
  return Boolean(tasks.daily_check && requiredTaskIds.every((id) => tasks[id]));
}

async function foxPayDailyTicketReady(player, settings, pack, context = {}) {
  const tasks = player.daily_tasks || {};
  if (tasks[foxpayDailyTaskTicketFlag]) return false;
  const taskIds = (await foxPayTaskPayload(player, settings, pack, context))
    .filter((task) => task.required !== false)
    .map((task) => task.id);
  return taskIds.length > 0 && taskIds.every((id) => Boolean(tasks[id]));
}

function creditFoxPayPlayer(player, tokens, settings, options = {}) {
  const pack = player._package;
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const capUsd = foxPayCapUsd(player, pack);
  const remainingUsd = Math.max(0, capUsd - player.total_earned_usd);
  const requestedUsd = tokens * tokenPrice;
  const allowedUsd = Math.min(remainingUsd, requestedUsd);
  const allowedTokens = Math.floor((allowedUsd / tokenPrice) + 1e-9);
  player.token_balance += allowedTokens;
  player.total_earned_usd += allowedTokens * tokenPrice;
  player.lifetime_earned_usd = Math.max(0, toNumber(player.lifetime_earned_usd, 0)) + (allowedTokens * tokenPrice);
  const seasonStatus = foxPaySeasonStatus(settings);
  const seasonKey = foxPaySeasonPeriodKey(settings);
  if (options.season !== false && seasonStatus === 'active' && seasonKey && allowedTokens > 0) {
    if (player.season_key !== seasonKey) {
      player.season_key = seasonKey;
      player.season_earned_tokens = 0;
    }
    player.season_earned_tokens = Math.max(0, Math.floor(toNumber(player.season_earned_tokens, 0))) + allowedTokens;
  }
  return allowedTokens;
}

function foxPayPackageFoxContribution(player, pack, settings, requestedTokens = 0) {
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const priceUsdt = Math.max(0, toNumber(pack.price_usdt));
  const walletTokens = Math.max(0, Math.floor(toNumber(player.token_balance)));
  const requested = Math.max(0, Math.floor(toNumber(requestedTokens)));
  const maxTokensForPack = Math.ceil((priceUsdt / tokenPrice) - 1e-9);
  const canPayFullFox = walletTokens >= maxTokensForPack && requested >= maxTokensForPack;
  const minEffectiveTokens = tokenPrice > 0 ? Math.ceil(0.01 / tokenPrice) : 0;
  const maxPartialTokens = priceUsdt > foxPayMinPartialUsdt
    ? Math.floor(((priceUsdt - foxPayMinPartialUsdt) / tokenPrice) + 1e-9)
    : 0;
  const allowedTokens = canPayFullFox ? maxTokensForPack : maxPartialTokens;
  const rawTokens = Math.min(walletTokens, requested, maxTokensForPack, allowedTokens);
  const tokens = canPayFullFox || rawTokens >= minEffectiveTokens ? rawTokens : 0;
  const usdt = roundUsdtCents(Math.min(priceUsdt, tokens * tokenPrice));
  const remainingUsdt = canPayFullFox ? 0 : ceilUsdtCents(Math.max(0, priceUsdt - usdt));
  return {
    token_price_usd: tokenPrice,
    package_price_usdt: priceUsdt,
    fox_tokens: tokens,
    fox_usdt: usdt,
    remaining_usdt: remainingUsdt,
    is_full_fox: tokens > 0 && remainingUsdt <= 0.00000001,
  };
}

function foxPayPaymentRaw(payment) {
  if (!payment?.raw_payload) return {};
  if (typeof payment.raw_payload === 'string') {
    try {
      return JSON.parse(payment.raw_payload) || {};
    } catch {
      return {};
    }
  }
  return payment.raw_payload || {};
}

async function getFoxPayPurchase(id) {
  if (!id) return null;
  if (!pool) return foxpayPurchases.get(id) || null;
  const result = await pool.query('select * from foxpay_purchases where id = $1 limit 1', [id]);
  return result.rows[0] || null;
}

async function findPendingFoxPayPackagePurchase(playerId, packageId) {
  if (!playerId || !packageId) return null;
  if (!pool) {
    return [...foxpayPurchases.values()]
      .filter((purchase) => purchase.player_id === playerId && purchase.package_id === packageId && purchase.status === 'pending')
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
  }
  const result = await pool.query(
    `select * from foxpay_purchases
     where player_id = $1 and package_id = $2 and status = 'pending'
     order by created_at desc limit 1`,
    [playerId, packageId],
  );
  return result.rows[0] || null;
}

async function refundFoxPayPackageContribution(payment, purchase = null) {
  const raw = foxPayPaymentRaw(payment);
  const contribution = raw.package_payment || {};
  const fallbackPurchase = purchase || await getFoxPayPurchase(payment?.id);
  const tokens = Math.max(0, Math.floor(toNumber(contribution.fox_tokens || fallbackPurchase?.fox_tokens_paid)));
  if (!payment?.player_id || tokens <= 0 || contribution.fox_refunded_at) return false;
  const player = await ensureFoxPayPlayer(payment.player_id);
  player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance))) + tokens;
  await saveFoxPayPlayer(player);
  raw.package_payment = {
    ...contribution,
    fox_tokens: tokens,
    fox_usdt: toNumber(contribution.fox_usdt || fallbackPurchase?.fox_usdt_paid),
    usdt_due: toNumber(contribution.usdt_due || fallbackPurchase?.usdt_due),
    fox_refunded_at: new Date().toISOString(),
  };
  payment.raw_payload = raw;
  await saveFoxPayPayment(payment);
  return true;
}

function foxPayUsdtAmountsMatch(left, right) {
  return Math.abs(toNumber(left) - toNumber(right)) <= 0.000001;
}

function foxPayPendingPurchaseMatchesPack(purchase, pack, payment = null, expected = {}) {
  if (!purchase || !pack) return false;
  if (!foxPayUsdtAmountsMatch(purchase.amount_usdt, pack.price_usdt)) return false;
  if (expected.network && payment?.network && normalizePaymentNetwork(payment.network) !== normalizePaymentNetwork(expected.network)) return false;
  if (expected.usdtDue !== undefined && !foxPayUsdtAmountsMatch(purchase.usdt_due, expected.usdtDue)) return false;
  if (expected.foxTokens !== undefined && Math.floor(toNumber(purchase.fox_tokens_paid)) !== Math.floor(toNumber(expected.foxTokens))) return false;
  return true;
}

async function cancelFoxPayPendingPackagePayment(payment, purchase, reason = 'system_cancelled') {
  if (!payment || !purchase || purchase.status !== 'pending') return false;
  if (paymentIsPaid(payment.status) || paymentIsClosed(payment.status)) return false;
  await refundFoxPayPackageContribution(payment, purchase);
  const raw = foxPayPaymentRaw(payment);
  payment.status = 'cancelled';
  payment.raw_payload = {
    ...raw,
    cancelled_by_system_at: new Date().toISOString(),
    cancelled_reason: reason,
  };
  await saveFoxPayPayment(payment);
  if (!pool) {
    purchase.status = 'cancelled';
    purchase.reviewed_at = new Date().toISOString();
    foxpayPurchases.set(purchase.id, purchase);
  } else {
    await pool.query(
      `update foxpay_purchases set status = 'cancelled', reviewed_at = now()
       where id = $1 and status = 'pending'`,
      [purchase.id],
    );
  }
  return true;
}

async function expireFoxPayPaymentIfNeeded(payment, reason = 'payment_expired', options = {}) {
  if (!payment || paymentIsPaid(payment.status) || paymentIsClosed(payment.status) || !paymentIsExpiredByTime(payment)) {
    return payment;
  }

  if (payment.nowpayments_payment_id && options.checkProvider !== false) {
    try {
      const payload = await nowPaymentsRequest(`/payment/${encodeURIComponent(payment.nowpayments_payment_id)}`);
      payment = await updateFoxPayPaymentFromNow(payment, payload);
      if (!payment || paymentIsPaid(payment.status) || paymentIsClosed(payment.status) || !paymentIsExpiredByTime(payment)) {
        return payment;
      }
    } catch (error) {
      console.error('FoxPay expired payment provider check failed', error);
      return payment;
    }
  }

  if (payment.item_type === 'package') {
    const purchase = await getFoxPayPurchase(payment.id);
    if (purchase?.status === 'pending') {
      await cancelFoxPayPendingPackagePayment(payment, purchase, reason);
      return getFoxPayPayment(payment.id);
    }
  }

  const raw = foxPayPaymentRaw(payment);
  payment.status = 'expired';
  payment.raw_payload = {
    ...raw,
    expired_locally_at: raw.expired_locally_at || new Date().toISOString(),
    expired_reason: raw.expired_reason || reason,
  };
  await saveFoxPayPayment(payment);
  return payment;
}

async function expireFoxPayPlayerPendingPayments(playerId) {
  if (!playerId) return { expired: 0 };
  let payments;
  if (!pool) {
    payments = [...foxpayPayments.values()].filter((payment) => payment.player_id === playerId);
  } else {
    const result = await pool.query(
      `select *
       from foxpay_payments
       where player_id = $1
         and status not in ('confirmed', 'finished', 'failed', 'expired', 'refunded', 'underpaid', 'cancelled', 'canceled')
         and expires_at is not null
         and expires_at <= now()
       order by created_at desc
       limit 25`,
      [playerId],
    );
    payments = result.rows;
  }

  let expired = 0;
  for (const payment of payments) {
    if (paymentIsExpiredByTime(payment) && !paymentIsPaid(payment.status) && !paymentIsClosed(payment.status)) {
      await expireFoxPayPaymentIfNeeded(payment, 'dashboard_expired_cleanup');
      expired += 1;
    }
  }
  return { expired };
}

function pickRouletteReward(rewards = []) {
  const active = rewards.filter((reward) => reward.active && reward.weight > 0);
  const poolWeight = active.reduce((sum, reward) => sum + reward.weight, 0);
  if (!poolWeight) return null;
  let roll = randomInt(poolWeight);
  for (const reward of active) {
    roll -= reward.weight;
    if (roll < 0) return reward;
  }
  return active[active.length - 1] || null;
}

async function recordFoxPayRouletteSpin(entry) {
  if (!pool) {
    foxpayRouletteSpinsMemory.set(entry.id, entry);
    return entry;
  }
  await pool.query(
    `insert into foxpay_roulette_spins
     (id, player_id, package_id, ticket_cost, reward_id, reward_type, reward_label, reward_amount, reward_item_id, credited_tokens)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [entry.id, entry.player_id, entry.package_id, entry.ticket_cost, entry.reward_id || null, entry.reward_type, entry.reward_label, entry.reward_amount, entry.reward_item_id || null, entry.credited_tokens || 0],
  );
  return entry;
}

async function foxPayRouletteWonSkinIds(playerId) {
  if (!playerId) return [];
  if (!pool) {
    return [...foxpayRouletteSpinsMemory.values()]
      .filter((spin) => spin.player_id === playerId && spin.reward_type === 'skin' && spin.reward_item_id)
      .map((spin) => spin.reward_item_id);
  }
  const result = await pool.query(
    `select distinct reward_item_id
     from foxpay_roulette_spins
     where player_id = $1 and reward_type = 'skin' and coalesce(reward_item_id, '') <> ''`,
    [playerId],
  );
  return result.rows.map((row) => row.reward_item_id).filter(Boolean);
}

async function repairFoxPayRouletteSkins(player, skins = []) {
  const wonSkinIds = await foxPayRouletteWonSkinIds(player.player_id);
  if (!wonSkinIds.length) return false;
  const activeSkinIds = new Set(skins.filter((skin) => skin.active !== false).map((skin) => skin.id));
  const owned = new Set(Array.isArray(player.owned_skins) ? player.owned_skins : []);
  let changed = false;
  wonSkinIds.forEach((skinId) => {
    if (activeSkinIds.has(skinId) && !owned.has(skinId)) {
      owned.add(skinId);
      changed = true;
    }
  });
  if (!changed) return false;
  player.owned_skins = [...owned];
  const selected = Array.isArray(player.selected_skins) ? player.selected_skins.filter((skinId) => owned.has(skinId)) : [];
  wonSkinIds.forEach((skinId) => {
    if (owned.has(skinId) && !selected.includes(skinId) && selected.length < 2) selected.push(skinId);
  });
  player.selected_skins = selected.slice(0, 2);
  return true;
}

async function applyFoxPayRouletteReward(player, reward, settings) {
  const result = {
    reward,
    credited_tokens: 0,
  };
  if (!reward || reward.reward_type === 'none') return result;
  if (reward.reward_type === 'tickets') {
    player.roulette_tickets = Math.max(0, Math.floor(Number(player.roulette_tickets || 0))) + Math.floor(Number(reward.amount || 0));
    return result;
  }
  if (reward.reward_type === 'avatar' && reward.item_id) {
    const avatar = await getFoxPayAvatar(reward.item_id);
    if (avatar) {
      const owned = new Set(Array.isArray(player.owned_avatars) ? player.owned_avatars : []);
      owned.add(avatar.id);
      player.owned_avatars = [...owned];
      player.selected_avatar_id = avatar.id;
    }
    return result;
  }
  if (reward.reward_type === 'skin' && reward.item_id) {
    const skin = await getFoxPaySkin(reward.item_id);
    if (skin && skin.active) {
      const owned = new Set(Array.isArray(player.owned_skins) ? player.owned_skins : []);
      owned.add(skin.id);
      player.owned_skins = [...owned];
      const selected = Array.isArray(player.selected_skins) ? player.selected_skins.filter((skinId) => owned.has(skinId)) : [];
      if (!selected.includes(skin.id) && selected.length < 2) selected.push(skin.id);
      player.selected_skins = selected.slice(0, 2);
    }
    return result;
  }
  if (reward.reward_type === 'tokens') {
    result.credited_tokens = creditFoxPayPlayer(player, Math.floor(Number(reward.amount || 0)), settings);
  }
  return result;
}

function foxPaySimulatedRank(rankId, ranks = []) {
  const activeRanks = ranks.length ? ranks : foxpayDefaultRanks.map(normalizeFoxPayRank);
  const byId = new Map(activeRanks.map((rank) => [rank.id, rank]));
  if (byId.has(rankId)) return byId.get(rankId);
  return activeRanks.find((rank) => rank.active) || normalizeFoxPayRank(foxpayDefaultRanks[0]);
}

function foxPaySimulatedPackageCapUsd(packageId = 'free') {
  const id = String(packageId || 'free');
  if (id === 'free') return 3;
  const price = Number(id.replace(/^p/, ''));
  return Number.isFinite(price) && price > 0 ? price * 3 : 3;
}

function foxPaySimulatedVisualCapRatio(profile = {}, index = 0) {
  const ranges = {
    free: [0.32, 0.76],
    p30: [0.42, 0.82],
    p60: [0.55, 0.91],
    p120: [0.58, 0.93],
    p480: [0.48, 0.82],
    p960: [0.36, 0.72],
  };
  const [min, max] = ranges[profile.package_id] || [0.45, 0.85];
  return seededInteger(`${profile.id || index}:visual-cap`, Math.round(min * 1000), Math.round(max * 1000)) / 1000;
}

function buildFoxPaySimulatedLeaderboardRows(settings, ranks = []) {
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const seasonActive = foxPaySeasonStatus(settings) === 'active';
  const seasonKey = foxPaySeasonPeriodKey(settings);
  const start = Date.UTC(2026, 4, 28);
  const elapsedDays = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return foxpayLeaderboardSimulatedProfiles.map((profile, index) => {
    const packGrowth = foxpaySimulatedPackageGrowth[profile.package_id] || 1;
    const dailyRate = (Math.max(0, toNumber(profile.daily_pct)) * packGrowth) / 100;
    const wave = 1 + ((((elapsedDays + index) % 7) - 3) * 0.006);
    const rawTokens = Math.max(0, Math.floor(toNumber(profile.base_tokens) * (1 + dailyRate * elapsedDays) * wave));
    const capTokens = tokenPrice > 0
      ? Math.floor((foxPaySimulatedPackageCapUsd(profile.package_id) / tokenPrice) + 1e-9)
      : rawTokens;
    const visualCapTokens = Math.floor(capTokens * foxPaySimulatedVisualCapRatio(profile, index));
    const tokens = Math.min(rawTokens, capTokens, visualCapTokens);
    const rank = foxPaySimulatedRank(profile.rank_id, ranks);
    return {
      player_id: profile.id,
      username: profile.username,
      token_balance: tokens,
      wallet_tokens: tokens,
      season_key: seasonActive ? seasonKey : '',
      season_earned_tokens: seasonActive ? tokens : 0,
      total_earned_usd: tokens * tokenPrice,
      lifetime_earned_usd: tokens * tokenPrice,
      active_package_id: profile.package_id || 'p30',
      country_code: profile.country_code,
      country_name: profile.country_name,
      created_at: new Date(start + (index * 3600000)).toISOString(),
      simulated: true,
      player_rank: {
        ...rank,
        direct_count: Math.max(0, Math.floor(Number(rank.required_directs || 0))),
        lifetime_earned_usd: Math.max(Number(rank.required_lifetime_usd || 0), tokens * tokenPrice),
        team_rank_counts: {},
      },
    };
  });
}

async function buildFoxPayLeaderboard(settings) {
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const seasonActive = foxPaySeasonStatus(settings) === 'active';
  const seasonKey = foxPaySeasonPeriodKey(settings);
  const leaderboardLimit = 20;
  let rows = [];
  let totalPlayers = 0;
  let totalCoins = 0;

  if (!pool) {
    const players = [...foxpayPlayers.values()]
      .map((player) => normalizeFoxPayPlayer(player, player._package || { daily_energy: player.max_energy || 300 }, settings))
      .filter(foxPayAccountEnabled);
    totalPlayers = players.length;
    totalCoins = players.reduce((sum, player) => sum + (seasonActive ? foxPayPlayerSeasonEarned(player, settings) : toNumber(player.token_balance)), 0);
    rows = players
      .sort((a, b) => {
        const left = seasonActive ? foxPayPlayerSeasonEarned(b, settings) : toNumber(b.token_balance);
        const right = seasonActive ? foxPayPlayerSeasonEarned(a, settings) : toNumber(a.token_balance);
        return left - right;
      })
      .slice(0, leaderboardLimit);
  } else {
    const totals = await pool.query(
      `select count(*)::int as total_players,
              coalesce(sum(${seasonActive ? "case when season_key = $1 then season_earned_tokens else 0 end" : 'token_balance'}), 0) as total_coins
       from foxpay_players
       where account_status <> 'disabled'`,
      seasonActive ? [seasonKey] : [],
    );
    totalPlayers = Number(totals.rows[0]?.total_players || 0);
    totalCoins = toNumber(totals.rows[0]?.total_coins);
    const result = await pool.query(
      `select player_id, username, token_balance, total_earned_usd, active_package_id,
              season_key, season_earned_tokens,
              country_code, country_name, created_at
       from foxpay_players
       where account_status <> 'disabled'
       order by ${seasonActive ? 'case when season_key = $1 then season_earned_tokens else 0 end' : 'token_balance'} desc,
                total_earned_usd desc,
                created_at asc
       limit $${seasonActive ? 2 : 1}`,
      seasonActive ? [seasonKey, leaderboardLimit] : [leaderboardLimit],
    );
    rows = result.rows;
  }
  const ranks = await getFoxPayRanks();
  const simulatedRows = buildFoxPaySimulatedLeaderboardRows(settings, ranks);
  rows = [...rows, ...simulatedRows]
    .sort((left, right) => {
      const leftTokens = seasonActive ? foxPayPlayerSeasonEarned(left, settings) : toNumber(left.token_balance);
      const rightTokens = seasonActive ? foxPayPlayerSeasonEarned(right, settings) : toNumber(right.token_balance);
      return rightTokens - leftTokens || toNumber(right.total_earned_usd) - toNumber(left.total_earned_usd);
    })
    .slice(0, leaderboardLimit);
  const rankPlayers = await loadFoxPayRankPlayers();
  rows.forEach((row) => {
    if (!row.simulated && !rankPlayers.some((rankPlayer) => rankPlayer.player_id === row.player_id)) rankPlayers.push(row);
  });
  const rankMap = buildFoxPayRankMap(rankPlayers, ranks);

  return {
    total_players: totalPlayers,
    total_coins: Math.floor(totalCoins),
    total_usdt: totalCoins * tokenPrice,
    rows: rows.map((row, index) => ({
      position: index + 1,
      player_id: row.player_id,
      username: row.username || 'Fox player',
      token_balance: Math.floor(seasonActive ? foxPayPlayerSeasonEarned(row, settings) : toNumber(row.token_balance)),
      wallet_tokens: Math.floor(toNumber(row.token_balance)),
      season_earned_tokens: foxPayPlayerSeasonEarned(row, settings),
      total_earned_usd: toNumber(row.total_earned_usd),
      active_package_id: row.active_package_id || 'free',
      country_code: row.country_code || '',
      country_name: row.country_name || '',
      simulated: Boolean(row.simulated),
      player_rank: row.player_rank || rankMap.get(row.player_id) || ranks[0] || normalizeFoxPayRank(foxpayDefaultRanks[0]),
    })),
  };
}

async function buildFoxPayReferrals(playerId, settings) {
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  let rows = [];

  if (!pool) {
    rows = [...foxpayPlayers.values()]
      .filter((player) => player.referrer_id === playerId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  } else {
    const result = await pool.query(
      `select player_id, username, token_balance, total_earned_usd, active_package_id,
              country_code, country_name, created_at
       from foxpay_players
       where referrer_id = $1
       order by created_at desc
       limit 500`,
      [playerId],
    );
    rows = result.rows;
  }

  const normalizedRows = rows.map((row) => ({
    player_id: row.player_id,
    username: row.username || 'Fox player',
    token_balance: Math.floor(toNumber(row.token_balance)),
    total_earned_usd: toNumber(row.total_earned_usd),
    active_package_id: row.active_package_id || 'free',
    country_code: row.country_code || '',
    country_name: row.country_name || '',
    joined_at: row.created_at || null,
  }));

  return {
    total: normalizedRows.length,
    active: normalizedRows.filter((row) => row.active_package_id !== 'free').length,
    estimated_bonus_usdt: normalizedRows.reduce((sum, row) => sum + (row.total_earned_usd * toNumber(settings.referral_rate, 0.1)), 0),
    estimated_bonus_tokens: Math.floor(normalizedRows.reduce((sum, row) => sum + (row.total_earned_usd * toNumber(settings.referral_rate, 0.1)), 0) / tokenPrice),
    rows: normalizedRows,
  };
}

async function getFoxPayPlayerById(playerId) {
  if (!playerId) return null;
  const settings = await getFoxPaySettings();
  if (!pool) {
    const player = foxpayPlayers.get(playerId);
    if (!player) return null;
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    const normalized = normalizeFoxPayPlayer(player, pack, settings);
    normalized._package = pack;
    return normalized;
  }
  const result = await pool.query('select * from foxpay_players where player_id = $1 limit 1', [playerId]);
  if (!result.rows[0]) return null;
  const pack = await getFoxPayPackage(result.rows[0].active_package_id || 'free');
  const normalized = normalizeFoxPayPlayer(result.rows[0], pack, settings);
  normalized._package = pack;
  return normalized;
}

async function buildFoxPayUnilevelTree(playerId, settings, maxDepth = 10) {
  const allPlayers = pool
    ? (await pool.query(
      `select player_id, username, referrer_id, active_package_id, token_balance, total_earned_usd,
              country_code, country_name, created_at
       from foxpay_players
       limit 5000`,
    )).rows
    : [...foxpayPlayers.values()];
  const children = new Map();
  allPlayers.forEach((player) => {
    const ref = player.referrer_id || '';
    if (!ref) return;
    if (!children.has(ref)) children.set(ref, []);
    children.get(ref).push(player);
  });
  const ratesByPack = normalizeUnilevelConfig(settings.unilevel_config);
  const rows = [];
  const walk = (parentId, level) => {
    if (level > maxDepth) return;
    (children.get(parentId) || []).forEach((child) => {
      const rates = ratesByPack[child.active_package_id || 'free'] || [];
      rows.push({
        level,
        player_id: child.player_id,
        referrer_id: child.referrer_id || parentId,
        username: child.username || 'Fox player',
        active_package_id: child.active_package_id || 'free',
        token_balance: Math.floor(toNumber(child.token_balance)),
        total_earned_usd: toNumber(child.total_earned_usd),
        country_code: child.country_code || '',
        country_name: child.country_name || '',
        commission_rate: toNumber(rates[level - 1] || 0),
        joined_at: child.created_at || null,
      });
      walk(child.player_id, level + 1);
    });
  };
  walk(playerId, 1);
  return {
    rates: ratesByPack,
    total_network: rows.length,
    by_level: Array.from({ length: maxDepth }, (_, index) => ({
      level: index + 1,
      count: rows.filter((row) => row.level === index + 1).length,
    })),
    rows,
  };
}

async function loadFoxPayRankPlayers() {
  if (pool) {
    const result = await pool.query(
      `select players.player_id,
              players.username,
              players.referrer_id,
              players.active_package_id,
              players.lifetime_earned_usd,
              players.total_earned_usd,
              players.account_status,
              packages.price_usdt as active_package_price_usdt
       from foxpay_players players
       left join foxpay_packages packages on packages.id = players.active_package_id
       where account_status <> 'disabled'
       limit 10000`,
    );
    return result.rows;
  }
  const defaultPackagePrices = new Map(foxpayDefaultPackages.map((pack) => [pack.id, toNumber(pack.price_usdt, 0)]));
  return [...foxpayPlayers.values()]
    .filter(foxPayAccountEnabled)
    .map((player) => ({
      ...player,
      active_package_price_usdt: toNumber(
        foxpayPackagesMemory.get(player.active_package_id || 'free')?.price_usdt,
        defaultPackagePrices.get(player.active_package_id || 'free') || 0,
      ),
    }));
}

function buildFoxPayRankMap(players = [], ranks = []) {
  const activeRanks = ranks
    .filter((rank) => rank.active)
    .sort((left, right) => left.sort_order - right.sort_order || left.required_lifetime_usd - right.required_lifetime_usd);
  const baseRank = activeRanks[0] || normalizeFoxPayRank(foxpayDefaultRanks[0]);
  const children = new Map();
  players.forEach((player) => {
    const parentId = player.referrer_id || '';
    if (!parentId) return;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(player);
  });
  let rankByPlayer = new Map(players.map((player) => [player.player_id, baseRank.id]));
  const rankById = new Map(activeRanks.map((rank) => [rank.id, rank]));
  const networkDepthForRank = (rank = {}) => {
    const order = Math.max(0, Math.floor(toNumber(rank.sort_order, 0)));
    if (order <= 0) return 0;
    return 10 + ((order - 1) * 5);
  };
  const networkVolumeCache = new Map();
  const playerPackageVolume = (player = {}) => Math.max(0, toNumber(player.active_package_price_usdt, 0));
  const networkVolumeFor = (playerId, maxDepth = 0) => {
    const depthLimit = Math.max(0, Math.floor(toNumber(maxDepth, 0)));
    if (!playerId || depthLimit <= 0) return 0;
    const cacheKey = `${playerId}:${depthLimit}`;
    if (networkVolumeCache.has(cacheKey)) return networkVolumeCache.get(cacheKey);
    const visited = new Set([playerId]);
    const walk = (parentId, depth) => {
      if (depth > depthLimit) return 0;
      return (children.get(parentId) || []).reduce((sum, child) => {
        if (!child?.player_id || visited.has(child.player_id)) return sum;
        visited.add(child.player_id);
        return sum + playerPackageVolume(child) + walk(child.player_id, depth + 1);
      }, 0);
    };
    const total = walk(playerId, 1);
    networkVolumeCache.set(cacheKey, total);
    return total;
  };
  const rankCountsFor = (playerId) => {
    const counts = {};
    (children.get(playerId) || []).forEach((child) => {
      const childRankId = rankByPlayer.get(child.player_id) || baseRank.id;
      counts[childRankId] = (counts[childRankId] || 0) + 1;
    });
    return counts;
  };
  const qualifies = (player, rank) => {
    const directRows = children.get(player.player_id) || [];
    if (directRows.length < Number(rank.required_directs || 0)) return false;
    const networkVolume = networkVolumeFor(player.player_id, networkDepthForRank(rank));
    if (networkVolume < Number(rank.required_lifetime_usd || 0)) return false;
    const countAtOrAbove = (requiredRankId) => {
      const requiredRank = rankById.get(requiredRankId);
      if (!requiredRank) return 0;
      return directRows.filter((child) => {
        const childRank = rankById.get(rankByPlayer.get(child.player_id) || baseRank.id) || baseRank;
        return Number(childRank.sort_order || 0) >= Number(requiredRank.sort_order || 0);
      }).length;
    };
    return Object.entries(rank.team_requirements || {}).every(([requiredRankId, requiredCount]) => (
      countAtOrAbove(requiredRankId) >= Number(requiredCount || 0)
    ));
  };
  for (let pass = 0; pass < Math.max(2, activeRanks.length + 1); pass += 1) {
    let changed = false;
    const nextMap = new Map(rankByPlayer);
    players.forEach((player) => {
      const best = [...activeRanks].reverse().find((rank) => qualifies(player, rank)) || baseRank;
      if (nextMap.get(player.player_id) !== best.id) {
        nextMap.set(player.player_id, best.id);
        changed = true;
      }
    });
    rankByPlayer = nextMap;
    if (!changed) break;
  }
  const details = new Map();
  players.forEach((player) => {
    const rank = rankById.get(rankByPlayer.get(player.player_id)) || baseRank;
    const directRows = children.get(player.player_id) || [];
    const network_depth = networkDepthForRank(rank);
    const network_volume_usd = networkVolumeFor(player.player_id, network_depth);
    const network_volume_by_depth = {};
    activeRanks.forEach((item) => {
      const depth = networkDepthForRank(item);
      network_volume_by_depth[item.id] = networkVolumeFor(player.player_id, depth);
    });
    details.set(player.player_id, {
      ...rank,
      direct_count: directRows.length,
      lifetime_earned_usd: network_volume_usd,
      personal_lifetime_earned_usd: Math.max(0, toNumber(player.lifetime_earned_usd, player.total_earned_usd || 0)),
      personal_package_volume_usd: playerPackageVolume(player),
      network_volume_usd,
      network_depth,
      network_volume_by_depth,
      team_rank_counts: rankCountsFor(player.player_id),
    });
  });
  return details;
}

async function getFoxPayRankForPlayer(playerId, player = null) {
  const ranks = await getFoxPayRanks();
  const players = await loadFoxPayRankPlayers();
  if (player && !players.some((row) => row.player_id === player.player_id)) players.push(player);
  const rankMap = buildFoxPayRankMap(players, ranks);
  return rankMap.get(playerId) || ranks[0] || normalizeFoxPayRank(foxpayDefaultRanks[0]);
}

async function buildFoxPayDashboard(playerId, payload = {}) {
  let player = await ensureFoxPayPlayer(playerId, payload);
  const settings = await getFoxPaySettings();
  await expireFoxPayPlayerPendingPayments(player.player_id);
  const maintenanceReset = await getFoxPayMaintenanceState();
  if (!foxPayAccountEnabled(player)) {
    return {
      ok: true,
      blocked: true,
      reason: 'account_disabled',
      persistence: pool ? 'postgres' : 'memory',
      session_valid: false,
      maintenance_reset: maintenanceReset,
      player: sanitizeFoxPayPlayer(player, settings),
    };
  }
  const taskLanguage = normalizeClientLanguage(payload.language || payload.lang);
  const pack = await getFoxPayPackage(player.active_package_id);
  player._package = pack;
  const capRepair = enforceFoxPayCap(player, settings, pack);
  if (capRepair.changed) {
    await saveFoxPayPlayer(player);
  }
  player.required_video_count = foxPayVideoTasks(settings, pack, {
    player_id: player.player_id,
    daily_key: player.daily_key || foxpayTodayKey(settings),
    language: taskLanguage,
    free_onboarding_day: foxPayIsFreeOnboardingDay(player, settings, pack),
  }).length;
  const packages = await getFoxPayPackages();
  const avatars = await getFoxPayAvatars();
  const skins = await getFoxPaySkins();
  const skinRepairChanged = await repairFoxPayRouletteSkins(player, skins);
  if (skinRepairChanged) {
    await saveFoxPayPlayer(player);
  }
  const rouletteSettings = await getFoxPayRouletteSettings();
  const rouletteSetting = rouletteSettings.find((row) => row.package_id === pack.id) || { package_id: pack.id, ticket_cost: 1 };
  const rouletteRewards = await getFoxPayRouletteRewards(pack.id);
  const rouletteTicketCost = foxPayEffectiveRouletteTicketCost(rouletteSetting, rouletteRewards, settings);
  const ownedAvatars = Array.isArray(player.owned_avatars) ? player.owned_avatars : [];
  const ownedSkins = Array.isArray(player.owned_skins) ? player.owned_skins : [];
  const activeSkins = selectedPlayerSkins(player, skins);
  const todayKey = foxpayTodayKey(settings);
  const skinClaimedToday = player.skin_taps_daily_key === todayKey;
  const claimedSkinsToday = claimedPlayerSkinsForToday(player, skins, settings);
  const skinClaimSource = skinClaimedToday && claimedSkinsToday.length ? claimedSkinsToday : activeSkins;
  const skinDailyTokens = skinClaimSource.reduce((sum, skin) => sum + Math.floor(Number(skin.tap_bonus_per_day || 0)), 0);
  const selectedCandidate = avatars.find((avatar) => avatar.id === player.selected_avatar_id);
  const selectedAvatar = playerOwnsAvatar(player, selectedCandidate)
    ? selectedCandidate
    : avatars.find((avatar) => avatar.id === 'fox-default' && avatar.is_free)
      || avatars.find((avatar) => avatar.is_free)
      || await getFoxPayAvatar('fox-default');
  const sponsorId = player.referrer_id || '';
  const sponsor = sponsorId ? await getFoxPayPlayerById(sponsorId) : null;
  const sponsorRegistered = Boolean(sponsor?.password_hash);
  const rank = await getFoxPayRankForPlayer(player.player_id, player);
  const capUsd = foxPayCapUsd(player, pack);
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const walletTokens = Math.max(0, Math.floor(toNumber(player.token_balance)));
  const packCycleUsd = Math.max(0, toNumber(player.total_earned_usd));
  const packCycleTokens = Math.floor((packCycleUsd / tokenPrice) + 1e-9);
  const tasksPayload = await foxPayTaskPayload(player, settings, pack, { language: taskLanguage });
  if (tasksPayload.some((task) => task.changed)) await saveFoxPayPlayer(player);
  const tasksReady = await foxPayTasksReady(player, settings, pack, { language: taskLanguage });
  const support = await listFoxPayPlayerSupportTickets(player.player_id, { includeMessages: true });
  return {
    ok: true,
    persistence: pool ? 'postgres' : 'memory',
    session_valid: !player.password_hash || !Object.prototype.hasOwnProperty.call(payload, 'account_token') || foxPayAccountTokenMatches(player, payload.account_token),
    settings,
    maintenance_reset: maintenanceReset,
    packages,
    avatars,
    skins,
    ranks: await getFoxPayRanks(),
    roulette_settings: rouletteSettings,
    leaderboard: await buildFoxPayLeaderboard(settings),
    referrals: await buildFoxPayReferrals(player.player_id, settings),
    unilevel: await buildFoxPayUnilevelTree(player.player_id, settings),
    commissions: await listFoxPayCommissions(player.player_id),
    withdrawals: await listFoxPayWithdrawals(player.player_id),
    purchases: await listFoxPayPurchases(player.player_id),
    payments: await listFoxPayPayments(player.player_id),
    support,
    upgrade_cards: FOXPAY_UPGRADE_CARDS,
    roulette_rewards: rouletteRewards,
    register_captcha: player.password_hash ? null : createFoxPayRegisterCaptcha(player.player_id),
    player: {
      player_id: player.player_id,
      username: player.username,
      email: normalizeFoxPayEmail(player.email || ''),
      is_registered: Boolean(player.password_hash),
      registered_at: player.registered_at || null,
      signup_ip: player.signup_ip || '',
      country_code: player.country_code || '',
      country_name: player.country_name || '',
      selected_avatar_id: player.selected_avatar_id || 'fox-default',
      owned_avatars: ownedAvatars,
      owned_skins: ownedSkins,
      selected_skins: activeSkins.map((skin) => skin.id),
      active_skins: activeSkins,
      skin_taps: {
        daily_tokens: skinDailyTokens,
        claimed_today: skinClaimedToday,
        claimed_skin_ids: claimedSkinsToday.map((skin) => skin.id),
        can_claim: skinDailyTokens > 0 && !skinClaimedToday && player.total_earned_usd < capUsd,
      },
      avatar_url: selectedAvatar?.image_url || './images/fox.png',
      referrer_id: player.referrer_id || '',
      sponsor_id: sponsorId,
      sponsor_username: sponsorRegistered ? (sponsor.username || sponsorId) : '',
      sponsor_registered: sponsorRegistered,
      rank,
      token_balance: walletTokens,
      wallet_tokens: walletTokens,
      roulette_tickets: Math.max(0, Math.floor(Number(player.roulette_tickets || 0))),
      usdt_balance: walletTokens * tokenPrice,
      wallet_usdt: walletTokens * tokenPrice,
      pack_cycle_tokens: packCycleTokens,
      pack_cycle_usdt: packCycleUsd,
      season_earned_tokens: foxPayPlayerSeasonEarned(player, settings),
      total_earned_usd: packCycleUsd,
      lifetime_earned_usd: Math.max(0, toNumber(player.lifetime_earned_usd, packCycleUsd)),
      total_withdrawn_usd: player.total_withdrawn_usd,
      withdrawal_wallet: player.withdrawal_wallet || '',
      withdrawal_network: normalizeWithdrawalNetwork(player.withdrawal_network) || 'bep20',
      active_package_id: player.active_package_id,
      package: pack,
      roulette_ticket_cost: rouletteTicketCost,
      cap_usd: capUsd,
      remaining_cap_usd: Math.max(0, capUsd - player.total_earned_usd),
      energy: player.energy,
      max_energy: player.max_energy,
      daily_key: player.daily_key,
      streak_days: foxPayVisibleStreak(player, todayKey),
      streak_last_key: player.streak_last_key || '',
      daily_tasks: player.daily_tasks || {},
      task_progress: player.task_progress || { taps: 0 },
      required_video_count: player.required_video_count,
      can_tap: player.energy > 0 && tasksReady && player.total_earned_usd < capUsd,
      referral_link: `https://foxpay.live/?ref=${encodeURIComponent(player.player_id)}`,
      game_fox_balance: toNumber(player.game_fox_balance, 0),
      passive_income_per_hour: toNumber(player.passive_income_per_hour, 0),
      last_passive_claim_timestamp: player.last_passive_claim_timestamp || player.created_at || new Date().toISOString(),
      upgrade_cards_levels: typeof player.upgrade_cards_levels === 'string' ? JSON.parse(player.upgrade_cards_levels) : (player.upgrade_cards_levels || {}),
      free_withdrawal_claimed: Boolean(player.free_withdrawal_claimed),
      free_withdrawal_limit_usd: freeWithdrawalLimitUsd,
    },
    tasks: tasksPayload.map(({ changed, ...task }) => task),
  };
}

function foxPayVideoCount(pack) {
  const taskConfig = normalizePackageTaskConfig(pack?.task_config || {});
  if (taskConfig.daily_video_max > 0) return taskConfig.daily_video_max;
  return defaultDailyVideoRange(pack).max;
}

function foxPayVideoTasks(settings = foxpayDefaultSettings, pack = {}, context = {}) {
  const packTasks = normalizePackageTaskConfig(pack.task_config || {});
  const videoUrls = normalizeYoutubeUrls(settings.youtube_video_urls);
  const packVideoUrls = normalizeYoutubeUrls(pack.video_urls || []);
  const effectiveVideoUrls = packVideoUrls.length ? packVideoUrls : videoUrls;
  const configuredVideos = packTasks.videos.length
    ? packTasks.videos
    : effectiveVideoUrls.map((url, index) => ({
      id: `youtube_${index + 1}`,
      type: 'youtube',
      title: `Ver video ${index + 1}`,
      description: 'Mira al menos 30 segundos',
      url,
      language: 'all',
      active: true,
      watch_seconds: 30,
      reward_delay_seconds: 30,
      reward_tokens: 0,
    }));
  const language = normalizeClientLanguage(context.language);
  const activeVideos = configuredVideos.filter((task) => task.active !== false);
  const languageVideos = activeVideos.filter((task) => task.language === language || task.language === 'all');
  const candidates = languageVideos.length ? languageVideos : activeVideos;
  const fallbackRange = defaultDailyVideoRange(pack);
  const min = packTasks.daily_video_min > 0 ? packTasks.daily_video_min : fallbackRange.min;
  const max = packTasks.daily_video_max > 0 ? packTasks.daily_video_max : fallbackRange.max;
  const effectiveMin = context.free_onboarding_day ? 1 : min;
  const effectiveMax = context.free_onboarding_day ? 1 : max;
  const count = Math.min(candidates.length, seededInteger(
    `${context.player_id || ''}:${context.daily_key || foxpayTodayKey(settings)}:${pack.id || ''}:${language}:video_count`,
    Math.min(effectiveMin, effectiveMax),
    Math.max(effectiveMin, effectiveMax),
  ));
  const selected = seededShuffle(candidates, `${context.player_id || ''}:${context.daily_key || foxpayTodayKey(settings)}:${pack.id || ''}:${language}`).slice(0, count);
  return selected.map((task, index) => ({
    ...task,
    id: `youtube_${index + 1}`,
    title: task.title || `Ver video ${index + 1}`,
  }));
}

function foxPayFallbackVideoTasks(settings = foxpayDefaultSettings, pack = {}) {
  const videoUrls = normalizeYoutubeUrls(settings.youtube_video_urls);
  const packVideoUrls = normalizeYoutubeUrls(pack.video_urls || []);
  const effectiveVideoUrls = packVideoUrls.length ? packVideoUrls : videoUrls;
  return Array.from({ length: foxPayVideoCount(pack) }).map((_, index) => {
    const url = effectiveVideoUrls[index] || '';
    return {
      id: `youtube_${index + 1}`,
      type: 'youtube',
      title: `Ver video ${index + 1}`,
      description: url ? 'Mira al menos 30 segundos' : 'Video pendiente de configurar',
      url,
      watch_seconds: 30,
      reward_delay_seconds: 30,
      reward_tokens: 0,
    };
  });
}

async function foxPayTaskPayload(player, settings = foxpayDefaultSettings, pack = player._package || {}, context = {}) {
  const progress = player.task_progress || { taps: 0 };
  const tasks = player.daily_tasks || {};
  const packTasks = normalizePackageTaskConfig(pack.task_config || {});
  const taskContext = {
    player_id: player.player_id,
    daily_key: player.daily_key || foxpayTodayKey(settings),
    language: context.language,
    free_onboarding_day: foxPayIsFreeOnboardingDay(player, settings, pack),
  };
  const referralTask = await foxPayReferralTask(player, settings, pack);
  const dynamicTasks = [
    foxpayDailyTaskDefinitions[0],
    ...foxPayVideoTasks(settings, pack, taskContext),
    ...packTasks.socials,
    ...packTasks.partners.filter((task) => task.active !== false),
    ...(referralTask ? [referralTask] : []),
    foxpayDailyTaskDefinitions[1],
  ];
  return dynamicTasks.map((task) => {
    const goal = task.goal || 1;
    const current = task.type === 'referral'
      ? Number(task.progress || 0)
      : (task.id === 'tap_goal' ? Number(progress.taps || 0) : (tasks[task.id] ? 1 : 0));
    return {
      ...task,
      progress: Math.min(goal, current),
      goal,
      claimed: Boolean(tasks[task.id]),
      ready: task.type === 'referral'
        ? current >= goal
        : (task.type === 'youtube' ? Boolean(task.url) : (task.id === 'tap_goal' ? current >= goal : true)),
    };
  });
}

async function handleFoxPayMe(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }

  try {
    const meta = await getFoxPayRequestMeta(request);
    return sendJson(response, 200, await buildFoxPayDashboard(playerId, {
      username: params.get('username') || undefined,
      referrer_id: params.get('referrer_id') || undefined,
      language: params.get('language') || params.get('lang') || '',
      account_token: params.get('account_token') || '',
      device_key: params.get('device_key') || '',
      device_label: params.get('device_label') || meta.device_label,
      ...meta,
    }));
  } catch (error) {
    if (error.code === 'stale_player_id_reset') {
      return sendJson(response, 409, {
        ok: false,
        error: 'stale_player_id_reset',
        maintenance_reset: error.maintenance_reset || await getFoxPayMaintenanceState(),
        reset_player_prefix: error.reset_player_prefix || foxPayResetPlayerPrefix(await getFoxPayMaintenanceState()),
      });
    }
    if (['ip_already_used', 'device_already_used'].includes(error.code || error.message)) {
      return sendJson(response, 409, { ok: false, error: error.code || error.message });
    }
    console.error('FoxPay me failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_me_failed' });
  }
}

async function handleFoxPayRegister(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const username = (params.get('username') || '').trim();
  const email = normalizeFoxPayEmail(params.get('email') || '');
  const password = params.get('password') || '';

  if (!playerId || username.length < 3 || password.length < 6) {
    return sendJson(response, 400, { ok: false, error: 'invalid_register_params' });
  }
  if (!email) {
    return sendJson(response, 400, { ok: false, error: 'invalid_email' });
  }
  if (!verifyFoxPayRegisterCaptcha(playerId, params.get('captcha_token'), params.get('captcha_choice'))) {
    return sendJson(response, 400, { ok: false, error: 'invalid_register_captcha', message: 'Completa el captcha de seguridad.' });
  }

  try {
    let player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    if (player.password_hash) {
      return sendJson(response, 409, { ok: false, error: 'device_already_registered' });
    }

    if (!pool) {
      const duplicate = [...foxpayPlayers.values()].find((row) => row.player_id !== playerId && row.password_hash && row.username.toLowerCase() === username.toLowerCase());
      if (duplicate) return sendJson(response, 409, { ok: false, error: 'username_taken' });
      const duplicateEmail = [...foxpayPlayers.values()].find((row) => row.player_id !== playerId && row.password_hash && normalizeFoxPayEmail(row.email || '') === email);
      if (duplicateEmail) return sendJson(response, 409, { ok: false, error: 'email_taken' });
    } else {
      const duplicate = await pool.query(
        'select player_id from foxpay_players where lower(username) = lower($1) and password_hash is not null and player_id <> $2 limit 1',
        [username, playerId],
      );
      if (duplicate.rowCount) return sendJson(response, 409, { ok: false, error: 'username_taken' });
      const duplicateEmail = await pool.query(
        "select player_id from foxpay_players where lower(email) = lower($1) and email <> '' and password_hash is not null and player_id <> $2 limit 1",
        [email, playerId],
      );
      if (duplicateEmail.rowCount) return sendJson(response, 409, { ok: false, error: 'email_taken' });
    }

    const passwordData = hashFoxPayPassword(password);
    player.username = username;
    player.email = email;
    player.password_hash = passwordData.hash;
    player.password_salt = passwordData.salt;
    const accountToken = issueFoxPayAccountSession(player, foxPaySessionPayloadFromParams(params));
    player.registered_at = new Date().toISOString();
    player.last_login_at = player.registered_at;
    await saveFoxPayPlayer(player);

    return sendJson(response, 200, {
      ok: true,
      account_token: accountToken,
      player: sanitizeFoxPayPlayer(player),
      dashboard: await buildFoxPayDashboard(playerId, { account_token: accountToken }),
    });
  } catch (error) {
    console.error('FoxPay register failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_register_failed' });
  }
}

async function handleFoxPayLogin(request, response, url) {
  const params = await readRequestParams(request, url);
  const username = (params.get('username') || '').trim();
  const password = params.get('password') || '';

  if (username.length < 3 || password.length < 6) {
    return sendJson(response, 400, { ok: false, error: 'invalid_login_params' });
  }

  try {
    const settings = await getFoxPaySettings();
    let player;
    if (!pool) {
      player = [...foxpayPlayers.values()].find((row) => row.password_hash && (
        row.username.toLowerCase() === username.toLowerCase()
        || normalizeFoxPayEmail(row.email || '') === normalizeFoxPayEmail(username)
      ));
    } else {
      const result = await pool.query(
        "select * from foxpay_players where (lower(username) = lower($1) or (email <> '' and lower(email) = lower($1))) and password_hash is not null limit 1",
        [username],
      );
      player = result.rows[0];
    }

    if (!player || !verifyFoxPayPassword(password, player.password_salt, player.password_hash)) {
      return sendJson(response, 401, { ok: false, error: 'invalid_credentials' });
    }
    if (!foxPayAccountEnabled(player)) {
      return sendJson(response, 403, { ok: false, error: 'account_disabled' });
    }

    const pack = await getFoxPayPackage(player.active_package_id);
    player = normalizeFoxPayPlayer(player, pack, settings);
    const accountToken = issueFoxPayAccountSession(player, foxPaySessionPayloadFromParams(params));
    player.last_login_at = new Date().toISOString();
    await saveFoxPayPlayer(player);

    return sendJson(response, 200, {
      ok: true,
      player_id: player.player_id,
      account_token: accountToken,
      player: sanitizeFoxPayPlayer(player),
      dashboard: await buildFoxPayDashboard(player.player_id, { account_token: accountToken }),
    });
  } catch (error) {
    console.error('FoxPay login failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_login_failed' });
  }
}

async function handleFoxPayEmailUpdate(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = String(params.get('player_id') || '').trim();
  const email = normalizeFoxPayEmail(params.get('email') || '');
  const accountToken = String(params.get('account_token') || '').trim();
  const password = String(params.get('password') || '');

  if (!playerId || !email) {
    return sendJson(response, 400, { ok: false, error: 'invalid_email' });
  }

  try {
    let player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    if (!player.password_hash) {
      return sendJson(response, 403, { ok: false, error: 'account_registration_required' });
    }
    const accountTokenMatches = foxPayAccountTokenMatches(player, accountToken);
    const passwordMatches = Boolean(password && verifyFoxPayPassword(password, player.password_salt, player.password_hash));
    if (!accountTokenMatches && !passwordMatches) {
      return sendJson(response, 401, { ok: false, error: 'account_login_required' });
    }

    if (!pool) {
      const duplicate = [...foxpayPlayers.values()].find((row) => row.player_id !== playerId && row.password_hash && normalizeFoxPayEmail(row.email || '') === email);
      if (duplicate) return sendJson(response, 409, { ok: false, error: 'email_taken' });
    } else {
      const duplicate = await pool.query(
        "select player_id from foxpay_players where lower(email) = lower($1) and email <> '' and password_hash is not null and player_id <> $2 limit 1",
        [email, playerId],
      );
      if (duplicate.rowCount) return sendJson(response, 409, { ok: false, error: 'email_taken' });
    }

    const refreshedAccountToken = accountTokenMatches ? '' : issueFoxPayAccountSession(player, foxPaySessionPayloadFromParams(params));
    player.email = email;
    await saveFoxPayPlayer(player);

    return sendJson(response, 200, {
      ok: true,
      ...(refreshedAccountToken ? { account_token: refreshedAccountToken } : {}),
      player: sanitizeFoxPayPlayer(player),
      dashboard: await buildFoxPayDashboard(playerId, {
        account_token: refreshedAccountToken || accountToken,
      }),
    });
  } catch (error) {
    console.error('FoxPay email update failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_email_failed' });
  }
}

async function handleFoxPaySupportTicket(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = String(params.get('player_id') || '').trim();
  const ticketId = String(params.get('ticket_id') || '').trim();
  const category = normalizeFoxPaySupportCategory(params.get('category'));
  const message = normalizeFoxPaySupportMessage(params.get('message'));
  const imageUrl = normalizeFoxPaySupportImage(params.get('image_url'));
  const subject = String(params.get('subject') || '').trim().slice(0, 140) || category;
  if (!playerId) return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  if (message.length < 10 && !imageUrl) return sendJson(response, 400, { ok: false, error: 'support_message_too_short' });
  if (params.get('image_url') && !imageUrl) return sendJson(response, 400, { ok: false, error: 'support_image_invalid' });
  if ((message.match(/https?:\/\//gi) || []).length > 2) return sendJson(response, 400, { ok: false, error: 'support_too_many_links' });
  const payload = {
    signup_ip: getClientIp(request),
    device_key: params.get('device_key') || '',
    user_agent: request.headers['user-agent'] || '',
  };
  try {
    const player = await getFoxPayPlayerById(playerId).catch(() => null);
    const now = new Date().toISOString();
    let ticket = null;
    if (ticketId) {
      const tickets = await listFoxPayPlayerSupportTickets(playerId, { includeMessages: false });
      if (!tickets.tickets.some((item) => item.id === ticketId)) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
      ticket = pool
        ? (await pool.query('select * from foxpay_support_tickets where id = $1 limit 1', [ticketId])).rows[0]
        : foxpaySupportTicketsMemory.get(ticketId);
    }
    if (!ticketId) {
      const pendingRatingTicket = await findPendingFoxPaySupportRatingTicket(playerId);
      if (pendingRatingTicket) {
        return sendJson(response, 409, {
          ok: false,
          error: 'support_rating_required',
          ticket: foxPaySupportPublicTicket(pendingRatingTicket, await listFoxPaySupportMessages(pendingRatingTicket.id)),
          support: await listFoxPayPlayerSupportTickets(playerId, { includeMessages: true }),
        });
      }
    }
    if (!ticket) ticket = await findOpenFoxPaySupportTicket(playerId, category);
    if (!ticket) {
      const limit = await foxPaySupportRateLimit(playerId, payload, { newTicket: true });
      if (limit.limited) return sendJson(response, 429, { ok: false, error: limit.error });
      ticket = await saveFoxPaySupportTicket({
        id: `support_${Date.now()}_${randomBytes(4).toString('hex')}`,
        player_id: playerId,
        username: player?.username || defaultFoxPayUsername(playerId),
        category,
        subject,
        status: 'waiting_admin',
        priority: category === 'blocked' || category === 'withdrawal' ? 'high' : 'normal',
        last_message_at: now,
        device_key: payload.device_key,
        signup_ip: payload.signup_ip,
        user_agent: payload.user_agent,
        created_at: now,
        updated_at: now,
      });
    } else if (ticket.status === 'closed') {
      return sendJson(response, 409, { ok: false, error: 'support_ticket_closed' });
    } else if (ticket.status !== 'waiting_user') {
      return sendJson(response, 409, {
        ok: false,
        error: 'support_wait_admin_reply',
        ticket: foxPaySupportPublicTicket(ticket, await listFoxPaySupportMessages(ticket.id)),
      });
    } else {
      const limit = await foxPaySupportRateLimit(playerId, payload, { allowQuickReply: true });
      if (limit.limited) return sendJson(response, 429, { ok: false, error: limit.error });
    }
    await addFoxPaySupportMessage(ticket.id, 'player', playerId, message, imageUrl);
    ticket = await updateFoxPaySupportTicketAfterMessage(ticket.id, 'player', 'waiting_admin') || ticket;
    const support = await listFoxPayPlayerSupportTickets(playerId, { includeMessages: true });
    return sendJson(response, 200, { ok: true, support, ticket: foxPaySupportPublicTicket(ticket, await listFoxPaySupportMessages(ticket.id)) });
  } catch (error) {
    console.error('FoxPay support ticket failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_support_failed' });
  }
}

async function handleFoxPaySupportRate(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = String(params.get('player_id') || '').trim();
  const ticketId = String(params.get('ticket_id') || '').trim();
  const rating = Math.max(1, Math.min(5, Math.floor(Number(params.get('rating') || 0))));
  if (!playerId || !ticketId || !rating) return sendJson(response, 400, { ok: false, error: 'invalid_support_rating' });
  try {
    const tickets = await listFoxPayPlayerSupportTickets(playerId, { includeMessages: false });
    const ticket = tickets.tickets.find((item) => item.id === ticketId);
    if (!ticket) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
    if (ticket.status !== 'closed') return sendJson(response, 409, { ok: false, error: 'support_ticket_not_closed' });
    if (!pool) {
      const current = foxpaySupportTicketsMemory.get(ticketId);
      if (!current) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
      current.rating = rating;
      current.rated_at = new Date().toISOString();
      current.last_player_read_at = current.last_player_read_at || current.rated_at;
      current.player_unread_count = 0;
      current.updated_at = current.rated_at;
      foxpaySupportTicketsMemory.set(ticketId, current);
    } else {
      const result = await pool.query(
        `update foxpay_support_tickets
         set rating = $2,
             rated_at = coalesce(rated_at, now()),
             last_player_read_at = coalesce(last_player_read_at, now()),
             player_unread_count = 0,
             updated_at = now()
         where id = $1 and player_id = $3 and status = 'closed'
         returning id`,
        [ticketId, rating, playerId],
      );
      if (!result.rowCount) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
    }
    return sendJson(response, 200, {
      ok: true,
      support: await listFoxPayPlayerSupportTickets(playerId, { includeMessages: true }),
      ticket: foxPaySupportPublicTicket(
        pool ? (await pool.query('select * from foxpay_support_tickets where id = $1 limit 1', [ticketId])).rows[0] : foxpaySupportTicketsMemory.get(ticketId),
        await listFoxPaySupportMessages(ticketId),
      ),
    });
  } catch (error) {
    console.error('FoxPay support rating failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_support_rating_failed' });
  }
}

async function handleFoxPaySupportRead(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = String(params.get('player_id') || '').trim();
  const ticketId = String(params.get('ticket_id') || '').trim();
  if (!playerId || !ticketId) return sendJson(response, 400, { ok: false, error: 'missing_support_read_params' });
  const tickets = await listFoxPayPlayerSupportTickets(playerId, { includeMessages: false });
  if (!tickets.tickets.some((ticket) => ticket.id === ticketId)) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
  await markFoxPaySupportRead(ticketId, 'player');
  return sendJson(response, 200, { ok: true, support: await listFoxPayPlayerSupportTickets(playerId, { includeMessages: true }) });
}

async function handleFoxPayAdminSupportReply(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'support_edit');
  if (!admin) return;
  const params = await readRequestParams(request, url);
  const ticketId = String(params.get('ticket_id') || '').trim();
  const message = normalizeFoxPaySupportMessage(params.get('message'));
  const imageUrl = normalizeFoxPaySupportImage(params.get('image_url'));
  if (!ticketId || (message.length < 2 && !imageUrl)) return sendJson(response, 400, { ok: false, error: 'invalid_support_reply' });
  if (params.get('image_url') && !imageUrl) return sendJson(response, 400, { ok: false, error: 'support_image_invalid' });
  const tickets = await listFoxPayAdminSupportTickets();
  const ticket = tickets.find((item) => item.id === ticketId);
  if (!ticket) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
  if (ticket.status === 'closed') return sendJson(response, 409, { ok: false, error: 'support_ticket_closed' });
  await addFoxPaySupportMessage(ticketId, 'admin', admin.username || admin.role || 'admin', message, imageUrl);
  await updateFoxPaySupportTicketAfterMessage(ticketId, 'admin', 'waiting_user');
  await markFoxPaySupportRead(ticketId, 'admin');
  return sendJson(response, 200, { ok: true, support_tickets: await listFoxPayAdminSupportTickets() });
}

async function handleFoxPayAdminSupportStatus(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'support_edit');
  if (!admin) return;
  const params = await readRequestParams(request, url);
  const ticketId = String(params.get('ticket_id') || '').trim();
  const status = normalizeFoxPaySupportStatus(params.get('status'));
  if (!ticketId) return sendJson(response, 400, { ok: false, error: 'missing_support_ticket' });
  if (!pool) {
    const ticket = foxpaySupportTicketsMemory.get(ticketId);
    if (!ticket) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
    ticket.status = status;
    ticket.updated_at = new Date().toISOString();
    ticket.closed_at = status === 'closed' ? ticket.updated_at : '';
    ticket.admin_unread_count = 0;
    foxpaySupportTicketsMemory.set(ticketId, ticket);
  } else {
    const result = await pool.query(
      `update foxpay_support_tickets
       set status = $2,
           closed_at = case when $2 = 'closed' then now() else null end,
           admin_unread_count = 0,
           updated_at = now()
       where id = $1
       returning id`,
      [ticketId, status],
    );
    if (!result.rowCount) return sendJson(response, 404, { ok: false, error: 'support_ticket_not_found' });
  }
  return sendJson(response, 200, { ok: true, support_tickets: await listFoxPayAdminSupportTickets() });
}

async function handleFoxPayTap(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const taps = Math.max(1, Math.min(100, Number(params.get('taps') || 1)));
  const taskLanguage = normalizeClientLanguage(params.get('language') || params.get('lang') || '');

  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }

  try {
    let player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendJson(response, 403, { ok: false, error: 'account_disabled', dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }) });
    }
    const settings = await getFoxPaySettings();
    const pack = await getFoxPayPackage(player.active_package_id);
    player._package = pack;
    player.required_video_count = foxPayVideoTasks(settings, pack, {
      player_id: player.player_id,
      daily_key: player.daily_key || foxpayTodayKey(settings),
      language: taskLanguage,
      free_onboarding_day: foxPayIsFreeOnboardingDay(player, settings, pack),
    }).length;
    enforceFoxPayCap(player, settings, pack);

    if (foxPayCapReached(player, pack)) {
      await saveFoxPayPlayer(player);
      return sendJson(response, 403, {
        ok: false,
        error: 'package_cap_reached',
        message: 'Package earning cap reached. Buy another pack to start a new cycle.',
        dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
      });
    }

    if (!(await foxPayTasksReady(player, settings, pack, { language: taskLanguage }))) {
      return sendJson(response, 403, {
        ok: false,
        error: 'daily_tasks_required',
        message: 'Complete daily check-in and video task before tapping.',
        dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
      });
    }

    if (player.energy <= 0) {
      return sendJson(response, 403, {
        ok: false,
        error: 'energy_empty',
        message: 'Energy is empty for today.',
        dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
      });
    }

    const validTaps = Math.min(taps, player.energy);
    let earnedTokens = 0;
    let earnedPoints = 0;

    if (player.active_package_id === 'free') {
      earnedPoints = validTaps * 1;
      player.game_fox_balance = toNumber(player.game_fox_balance, 0) + earnedPoints;
    } else {
      earnedTokens = creditFoxPayPlayer(player, validTaps * Number(pack.tap_reward_tokens || 1), settings);
    }

    player.energy -= validTaps;
    player.task_progress = {
      ...(player.task_progress || {}),
      taps: Number(player.task_progress?.taps || 0) + validTaps,
    };
    await saveFoxPayPlayer(player);
    await upsertFoxPayPlayerDailyStats(player, settings, pack);

    return sendJson(response, 200, {
      ok: true,
      earned_tokens: earnedTokens,
      earned_points: earnedPoints,
      dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
    });

  } catch (error) {
    console.error('FoxPay tap failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_tap_failed' });
  }
}

async function handleFoxPayClaimTask(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const taskId = params.get('task_id') || '';
  const taskLanguage = normalizeClientLanguage(params.get('language') || params.get('lang') || '');

  if (!playerId || !taskId) {
    return sendJson(response, 400, { ok: false, error: 'missing_task_params' });
  }

  try {
    let player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendJson(response, 403, { ok: false, error: 'account_disabled', dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }) });
    }
    const settings = await getFoxPaySettings();
    const pack = await getFoxPayPackage(player.active_package_id);
    player._package = pack;
    player.required_video_count = foxPayVideoTasks(settings, pack, {
      player_id: player.player_id,
      daily_key: player.daily_key || foxpayTodayKey(settings),
      language: taskLanguage,
      free_onboarding_day: foxPayIsFreeOnboardingDay(player, settings, pack),
    }).length;
    enforceFoxPayCap(player, settings, pack);

    if (foxPayCapReached(player, pack)) {
      await saveFoxPayPlayer(player);
      return sendJson(response, 403, {
        ok: false,
        error: 'package_cap_reached',
        message: 'Package earning cap reached. Buy another pack to start a new cycle.',
        dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
      });
    }

    const task = (await foxPayTaskPayload(player, settings, pack, { language: taskLanguage })).find((item) => item.id === taskId);

    if (!task) {
      return sendJson(response, 404, { ok: false, error: 'task_not_found' });
    }

    if (player.daily_tasks?.[taskId]) {
      return sendJson(response, 409, { ok: false, error: 'task_already_claimed' });
    }

    if (task.id === 'tap_goal' && Number(player.task_progress?.taps || 0) < Number(task.goal || 0)) {
      return sendJson(response, 403, { ok: false, error: 'task_not_ready' });
    }

    if (task.type === 'referral' && !task.ready) {
      return sendJson(response, 403, {
        ok: false,
        error: 'referral_task_not_ready',
        progress: task.progress,
        goal: task.goal,
        dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
      });
    }

    if (task.type === 'youtube' && Number(params.get('watched_seconds') || 0) < Number(task.watch_seconds || 30)) {
      return sendJson(response, 403, { ok: false, error: 'watch_time_required' });
    }

    if (task.type === 'social') {
      if (params.get('visited') !== 'true') {
        return sendJson(response, 403, { ok: false, error: 'social_visit_required' });
      }
      if (Number(params.get('visited_seconds') || 0) < Number(task.wait_seconds || 0)) {
        return sendJson(response, 403, { ok: false, error: 'social_wait_required' });
      }
    }

    if (task.type === 'partner') {
      return sendJson(response, 202, {
        ok: false,
        error: 'partner_task_waiting_postback',
        dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
      });
    }

    player.daily_tasks = {
      ...(player.daily_tasks || {}),
      [taskId]: true,
    };
    let earnedPoints = 0;
    let streakTickets = 0;
    if (taskId === 'daily_check') {
      const currentStreak = markFoxPayDailyStreak(player, foxpayTodayKey(settings));
      if (player.active_package_id === 'free') {
        const streakDay = ((currentStreak - 1) % 7) + 1;
        const rewards = [
          { points: 10, tickets: 0 },
          { points: 25, tickets: 0 },
          { points: 50, tickets: 1 },
          { points: 100, tickets: 0 },
          { points: 250, tickets: 0 },
          { points: 500, tickets: 2 },
          { points: 1500, tickets: 5 }
        ];
        const reward = rewards[streakDay - 1] || { points: 10, tickets: 0 };
        earnedPoints = reward.points;
        streakTickets = reward.tickets;
        player.game_fox_balance = toNumber(player.game_fox_balance, 0) + earnedPoints;
        if (streakTickets > 0) {
          player.roulette_tickets = Math.max(0, Math.floor(Number(player.roulette_tickets || 0))) + streakTickets;
        }
      }
    }
    const requestedTokens = 0;
    const earnedTokens = 0;
    const earnedTickets = (await foxPayDailyTicketReady(player, settings, pack, { language: taskLanguage })) ? 1 : 0;
    if (earnedTickets > 0) {
      player.roulette_tickets = Math.max(0, Math.floor(Number(player.roulette_tickets || 0))) + earnedTickets;
      player.daily_tasks[foxpayDailyTaskTicketFlag] = true;
    }
    await saveFoxPayPlayer(player);
    await upsertFoxPayPlayerDailyStats(player, settings, pack);

    return sendJson(response, 200, {
      ok: true,
      earned_tokens: earnedTokens,
      lost_tokens: Math.max(0, requestedTokens - earnedTokens),
      earned_tickets: earnedTickets + streakTickets,
      earned_points: earnedPoints,
      dashboard: await buildFoxPayDashboard(playerId, { language: taskLanguage }),
    });
  } catch (error) {
    console.error('FoxPay task failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_task_failed' });
  }
}

async function handleFoxPayRouletteSpin(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  if (!playerId) return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  try {
    const player = await ensureFoxPayPlayer(playerId);
    const settings = await getFoxPaySettings();
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    player._package = pack;
    player.required_video_count = foxPayVideoCount(pack);
    enforceFoxPayCap(player, settings, pack);
    if (foxPayCapReached(player, pack)) {
      await saveFoxPayPlayer(player);
      return sendJson(response, 403, { ok: false, error: 'package_cap_reached', dashboard: await buildFoxPayDashboard(playerId) });
    }
    const rouletteSetting = await getFoxPayRouletteSetting(pack.id);
    const rewards = await getFoxPayRouletteRewards(pack.id);
    const ticketCost = foxPayEffectiveRouletteTicketCost(rouletteSetting, rewards, settings);
    if (Math.floor(Number(player.roulette_tickets || 0)) < ticketCost) {
      return sendJson(response, 403, { ok: false, error: 'insufficient_tickets', dashboard: await buildFoxPayDashboard(playerId) });
    }
    const reward = pickRouletteReward(rewards);
    if (!reward) {
      return sendJson(response, 400, { ok: false, error: 'roulette_not_configured' });
    }
    player.roulette_tickets = Math.max(0, Math.floor(Number(player.roulette_tickets || 0)) - ticketCost);
    const applied = await applyFoxPayRouletteReward(player, reward, settings);
    await saveFoxPayPlayer(player);
    const spin = await recordFoxPayRouletteSpin({
      id: `spin_${Date.now()}_${randomBytes(4).toString('hex')}`,
      player_id: player.player_id,
      package_id: pack.id,
      ticket_cost: ticketCost,
      reward_id: reward.id,
      reward_type: reward.reward_type,
      reward_label: reward.label,
      reward_amount: reward.amount,
      reward_item_id: reward.item_id || '',
      credited_tokens: applied.credited_tokens || 0,
      created_at: new Date().toISOString(),
    });
    return sendJson(response, 200, {
      ok: true,
      spin,
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay roulette spin failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_roulette_spin_failed' });
  }
}

async function handleFoxPayTasks(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';
  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }
  try {
    const player = await ensureFoxPayPlayer(playerId);
    const settings = await getFoxPaySettings();
    const pack = await getFoxPayPackage(player.active_package_id);
    player._package = pack;
    const tasks = await foxPayTaskPayload(player, settings, pack);
    if (tasks.some((task) => task.changed)) await saveFoxPayPlayer(player);
    return sendJson(response, 200, { ok: true, tasks: tasks.map(({ changed, ...task }) => task) });
  } catch (error) {
    console.error('FoxPay tasks failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_tasks_failed' });
  }
}

async function creditFoxPayUnilevel(buyerPlayer, amountUsdt, settings, sourceId, sourceType = 'package') {
  const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
  const config = normalizeUnilevelConfig(settings.unilevel_config);
  const credits = [];
  let current = buyerPlayer;
  for (let level = 1; level <= 10; level += 1) {
    const uplineId = current?.referrer_id || '';
    if (!uplineId) break;
    const upline = await getFoxPayPlayerById(uplineId);
    if (!upline) break;
    if (!foxPayAccountEnabled(upline)) {
      current = upline;
      continue;
    }
    const rates = config[upline.active_package_id || 'free'] || config.free || [];
    const rate = toNumber(rates[level - 1] || 0);
    if (rate > 0) {
      const usd = toNumber(amountUsdt) * (rate / 100);
      const tokens = Math.floor((usd / tokenPrice) + 1e-9);
      if (tokens > 0) {
        const credited = creditFoxPayPlayer(upline, tokens, settings);
        const lost = Math.max(0, tokens - credited);
        await saveFoxPayPlayer(upline);
        const entry = {
          id: `comm_${sourceId}_${level}_${upline.player_id}`.slice(0, 180),
          level,
          buyer_player_id: buyerPlayer.player_id,
          referrer_id: upline.player_id,
          referrer_player_id: upline.player_id,
          source_id: sourceId,
          source_type: sourceType,
          rate,
          amount_usdt: toNumber(amountUsdt),
          expected_tokens: tokens,
          credited_tokens: credited,
          lost_tokens: lost,
          credited_usd: credited * tokenPrice,
          lost_usd: lost * tokenPrice,
          referrer_package_id: upline.active_package_id || 'free',
          status: lost > 0 ? (credited > 0 ? 'partial_cap' : 'lost_cap') : 'credited',
          created_at: new Date().toISOString(),
        };
        await saveFoxPayCommission(entry);
        credits.push(entry);
      }
    }
    current = upline;
  }
  return credits;
}

async function creditFoxPayReferralTickets(buyerPlayer, pack, settings = foxpayDefaultSettings) {
  const referrerId = buyerPlayer?.referrer_id || '';
  const rewards = normalizeReferralTicketRewards(settings.referral_ticket_rewards);
  const tickets = Math.max(0, Math.floor(Number(rewards[pack?.id] || 0)));
  if (!referrerId || tickets <= 0) return { credited: false, tickets: 0 };
  const referrer = await getFoxPayPlayerById(referrerId);
  if (!referrer) return { credited: false, tickets: 0 };
  referrer.roulette_tickets = Math.max(0, Math.floor(Number(referrer.roulette_tickets || 0))) + tickets;
  await saveFoxPayPlayer(referrer);
  return { credited: true, tickets, referrer_player_id: referrer.player_id };
}

function foxpayPaymentId() {
  return `fpay_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function verifyNowPaymentsSignature(rawBody, signature) {
  if (!nowPaymentsIpnSecret) {
    return process.env.NODE_ENV !== 'production';
  }
  if (!signature) return false;
  try {
    const payload = JSON.parse(rawBody || '{}');
    const expected = createHmac('sha512', nowPaymentsIpnSecret).update(stableJson(payload)).digest('hex');
    const left = Buffer.from(String(signature).trim(), 'hex');
    const right = Buffer.from(expected, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function paymentIsPaid(status) {
  return ['confirmed', 'finished'].includes(String(status || '').toLowerCase());
}

function paymentAmountIsAcceptable(payment) {
  const expected = Math.max(0, toNumber(payment?.amount_usdt));
  const received = Math.max(0, toNumber(payment?.pay_amount));
  if (expected <= 0) return true;
  if (received <= 0) return false;
  const tolerance = Math.max(0.05, expected * 0.02);
  return received + tolerance >= expected;
}

function paymentIsClosed(status) {
  return ['failed', 'expired', 'refunded', 'underpaid', 'cancelled', 'canceled'].includes(String(status || '').toLowerCase());
}

function paymentIsExpiredByTime(payment = {}, graceMs = foxpayPaymentExpirationGraceMs) {
  if (!payment?.expires_at) return false;
  const expiresAt = new Date(payment.expires_at).getTime();
  return !Number.isNaN(expiresAt) && expiresAt + Math.max(0, Number(graceMs || 0)) <= Date.now();
}

function normalizeNowPaymentPayload(payload = {}) {
  return {
    nowpayments_payment_id: String(payload.payment_id || payload.id || ''),
    status: String(payload.payment_status || payload.status || 'waiting').toLowerCase(),
    pay_amount: toNumber(payload.pay_amount || payload.actually_paid || 0),
    pay_address: String(payload.pay_address || ''),
    payment_url: String(payload.invoice_url || payload.payment_url || ''),
    expires_at: payload.expiration_estimate_date || payload.valid_until || null,
    raw_payload: payload,
  };
}

async function nowPaymentsRequest(path, payload = null) {
  if (!nowPaymentsApiKey) {
    const error = new Error('NOWPayments API key is not configured');
    error.code = 'nowpayments_not_configured';
    throw error;
  }
  const response = await fetch(`${nowPaymentsApiUrl}${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: {
      'x-api-key': nowPaymentsApiKey,
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(data.message || data.error || 'NOWPayments request failed');
    error.code = 'nowpayments_request_failed';
    error.data = data;
    throw error;
  }
  return data;
}

function sanitizeFoxPayPayment(payment) {
  if (!payment) return null;
  const raw = foxPayPaymentRaw(payment);
  const foxTokensPaid = Math.max(0, Math.floor(toNumber(raw.fox_tokens_paid || raw.package_payment?.fox_tokens)));
  const foxUsdtPaid = toNumber(raw.fox_usdt_paid || raw.package_payment?.fox_usdt);
  const creditedTokens = Math.max(0, Math.floor(toNumber(raw.credited_tokens)));
  const lostTokens = Math.max(0, Math.floor(toNumber(raw.lost_tokens)));
  const secondsLeft = payment.expires_at ? Math.max(0, Math.floor((new Date(payment.expires_at).getTime() - Date.now()) / 1000)) : 20 * 60;
  return {
    id: payment.id,
    item_type: payment.item_type,
    item_id: payment.item_id,
    amount_usdt: toNumber(payment.amount_usdt),
    network: payment.network,
    pay_currency: payment.pay_currency,
    status: payment.status,
    pay_amount: toNumber(payment.pay_amount),
    pay_address: payment.pay_address || '',
    payment_url: payment.payment_url || '',
    fox_tokens_paid: foxTokensPaid,
    fox_usdt_paid: foxUsdtPaid,
    credited_tokens: creditedTokens,
    lost_tokens: lostTokens,
    source: String(raw.source || ''),
    qr_url: paymentQrUrl(payment),
    expires_at: payment.expires_at || '',
    created_at: payment.created_at || '',
    updated_at: payment.updated_at || '',
    activated_at: payment.activated_at || '',
    seconds_left: secondsLeft,
  };
}

async function saveFoxPayPayment(payment) {
  if (!pool) {
    foxpayPayments.set(payment.id, payment);
    return payment;
  }
  await pool.query(
    `insert into foxpay_payments
      (id, player_id, item_type, item_id, amount_usdt, network, pay_currency, nowpayments_payment_id, order_id, status, pay_amount, pay_address, payment_url, raw_payload, expires_at, activated_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, now())
     on conflict (id) do update set
       nowpayments_payment_id = excluded.nowpayments_payment_id,
       status = excluded.status,
       pay_amount = excluded.pay_amount,
       pay_address = excluded.pay_address,
       payment_url = excluded.payment_url,
       raw_payload = excluded.raw_payload,
       expires_at = excluded.expires_at,
       activated_at = excluded.activated_at,
       updated_at = now()`,
    [
      payment.id,
      payment.player_id,
      payment.item_type,
      payment.item_id,
      payment.amount_usdt,
      payment.network,
      payment.pay_currency,
      payment.nowpayments_payment_id || null,
      payment.order_id,
      payment.status,
      payment.pay_amount || null,
      payment.pay_address || null,
      payment.payment_url || null,
      JSON.stringify(payment.raw_payload || {}),
      payment.expires_at || null,
      payment.activated_at || null,
    ],
  );
  return payment;
}

async function getFoxPayPayment(id) {
  if (!pool) return foxpayPayments.get(id) || null;
  const result = await pool.query('select * from foxpay_payments where id = $1 limit 1', [id]);
  return result.rows[0] || null;
}

async function getFoxPayPaymentByNowId(paymentId) {
  if (!paymentId) return null;
  if (!pool) return [...foxpayPayments.values()].find((payment) => String(payment.nowpayments_payment_id) === String(paymentId)) || null;
  const result = await pool.query('select * from foxpay_payments where nowpayments_payment_id = $1 limit 1', [String(paymentId)]);
  return result.rows[0] || null;
}

async function activateFoxPayPayment(payment) {
  if (!payment || payment.activated_at) return payment;
  if (!paymentAmountIsAcceptable(payment)) {
    payment.status = 'underpaid';
    await saveFoxPayPayment(payment);
    return payment;
  }
  const paymentPlayer = await ensureFoxPayPlayer(payment.player_id);
  if (!foxPayAccountEnabled(paymentPlayer)) {
    const raw = foxPayPaymentRaw(payment);
    payment.raw_payload = {
      ...raw,
      activation_blocked_reason: 'account_disabled',
      activation_blocked_at: raw.activation_blocked_at || new Date().toISOString(),
    };
    await saveFoxPayPayment(payment);
    return payment;
  }
  if (payment.item_type === 'package') {
    const purchase = await getFoxPayPurchase(payment.id);
    if (['rejected', 'cancelled', 'canceled'].includes(String(purchase?.status || '').toLowerCase())) return payment;
    await approveFoxPayPurchase(payment.id, true);
  }
  if (payment.item_type === 'avatar') {
    const player = await ensureFoxPayPlayer(payment.player_id);
    const avatar = await getFoxPayAvatar(payment.item_id);
    if (!avatar) return payment;
    const owned = new Set(Array.isArray(player.owned_avatars) ? player.owned_avatars : ['fox-default']);
    owned.add(avatar.id);
    player.owned_avatars = [...owned];
    player.selected_avatar_id = avatar.id;
    await saveFoxPayPlayer(player);
    const settings = await getFoxPaySettings();
    await creditFoxPayUnilevel(player, payment.amount_usdt, settings, payment.id, 'avatar');
  }
  if (payment.item_type === 'skin') {
    const player = await ensureFoxPayPlayer(payment.player_id);
    const skin = await getFoxPaySkin(payment.item_id);
    if (!skin) return payment;
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    if (!skinDirectBuyAllowedForPackage(skin, pack.id)) return payment;
    const owned = new Set(Array.isArray(player.owned_skins) ? player.owned_skins : []);
    owned.add(skin.id);
    player.owned_skins = [...owned];
    const selected = Array.isArray(player.selected_skins) ? player.selected_skins.filter((skinId) => owned.has(skinId)) : [];
    if (selected.length < 2 && !selected.includes(skin.id)) selected.push(skin.id);
    player.selected_skins = selected.slice(0, 2);
    await saveFoxPayPlayer(player);
    const settings = await getFoxPaySettings();
    await creditFoxPayUnilevel(player, payment.amount_usdt, settings, payment.id, 'skin');
  }
  payment.activated_at = new Date().toISOString();
  const savedPayment = await saveFoxPayPayment(payment);
  const player = await ensureFoxPayPlayer(payment.player_id);
  const itemLabel = payment.item_type === 'package'
    ? `pack ${payment.item_id}`
    : `${payment.item_type} ${payment.item_id}`;
  void notifyFoxPayAdmins('payment_approved', {
    eventKey: `payment_approved:${payment.id}`,
    title: 'FoxPay',
    message: 'Actividad administrativa disponible.',
    url: foxpayAdminUrl,
    data: {
      payment_id: payment.id,
      player_id: payment.player_id,
      username: player.username || '',
      item_type: payment.item_type,
      item_id: payment.item_id,
      amount_usdt: toNumber(payment.amount_usdt),
    },
  });
  return savedPayment;
}

async function updateFoxPayPaymentFromNow(payment, payload) {
  if (!payment) return null;
  const normalized = normalizeNowPaymentPayload(payload);
  const purchase = payment.item_type === 'package' ? await getFoxPayPurchase(payment.id) : null;
  const locallyClosed = ['rejected', 'cancelled', 'canceled'].includes(String(purchase?.status || '').toLowerCase());
  payment.nowpayments_payment_id = normalized.nowpayments_payment_id || payment.nowpayments_payment_id;
  payment.status = locallyClosed ? payment.status : (normalized.status || payment.status);
  payment.pay_amount = normalized.pay_amount || payment.pay_amount;
  payment.pay_address = normalized.pay_address || payment.pay_address;
  payment.payment_url = normalized.payment_url || payment.payment_url;
  payment.expires_at = normalized.expires_at || payment.expires_at;
  const currentRaw = foxPayPaymentRaw(payment);
  payment.raw_payload = {
    ...currentRaw,
    nowpayments: normalized.raw_payload || currentRaw.nowpayments || {},
    late_nowpayments_status: locallyClosed ? normalized.status : currentRaw.late_nowpayments_status,
  };
  await saveFoxPayPayment(payment);
  if (locallyClosed) return payment;
  if (paymentIsPaid(payment.status)) {
    await activateFoxPayPayment(payment);
  }
  if (payment.item_type === 'package' && paymentIsClosed(payment.status)) {
    if (purchase?.status === 'pending') {
      await refundFoxPayPackageContribution(payment, purchase);
    }
    if (!pool) {
      const purchase = foxpayPurchases.get(payment.id);
      if (purchase && purchase.status === 'pending') {
        purchase.status = 'rejected';
        purchase.reviewed_at = new Date().toISOString();
        foxpayPurchases.set(payment.id, purchase);
      }
    } else {
      await pool.query(
        `update foxpay_purchases set status = 'rejected', reviewed_at = now()
         where id = $1 and status = 'pending'`,
        [payment.id],
      );
    }
  }
  return payment;
}

async function createFoxPayCryptoPayment({ playerId, itemType, itemId, amountUsdt, network, description }) {
  const paymentId = foxpayPaymentId();
  const payNetwork = normalizePaymentNetwork(network);
  const payCurrency = nowPaymentsCurrencyForNetwork(payNetwork);
  const orderId = `${paymentId}_${itemType}_${itemId}`.slice(0, 120);
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const callbackUrl = nowPaymentsIpnUrl || `${nowPaymentsSuccessUrl.replace(/\/+$/, '')}/api/foxpay/nowpayments/ipn`;
  let payment = {
    id: paymentId,
    player_id: playerId,
    item_type: itemType,
    item_id: itemId,
    amount_usdt: amountUsdt,
    network: payNetwork,
    pay_currency: payCurrency,
    order_id: orderId,
    status: 'waiting',
    pay_amount: 0,
    pay_address: '',
    payment_url: '',
    expires_at: expiresAt,
    raw_payload: {},
  };
  await saveFoxPayPayment(payment);

  const nowPayload = await nowPaymentsRequest('/payment', {
    price_amount: Number(amountUsdt),
    price_currency: 'usd',
    pay_currency: payCurrency,
    ipn_callback_url: callbackUrl,
    order_id: orderId,
    order_description: description,
  });
  payment = {
    ...payment,
    ...normalizeNowPaymentPayload(nowPayload),
    raw_payload: nowPayload,
    expires_at: normalizeNowPaymentPayload(nowPayload).expires_at || expiresAt,
  };
  return saveFoxPayPayment(payment);
}

async function handleFoxPayPurchase(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const packageId = params.get('package_id') || '';
  const network = normalizePaymentNetwork(params.get('network') || 'bep20');
  const requestedFoxTokens = params.get('fox_tokens') || params.get('use_fox_tokens') || 0;

  if (!playerId || !packageId) {
    return sendJson(response, 400, { ok: false, error: 'missing_purchase_params' });
  }

  let purchaseLockKey = '';
  try {
    let player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const pack = await getFoxPayPackage(packageId);
    const settings = await getFoxPaySettings();
    if (!pack || !pack.active) {
      return sendJson(response, 404, { ok: false, error: 'package_not_found' });
    }
    if (!foxPayCanUpgradePackage(player.active_package_id || 'free', pack.id)) {
      return sendJson(response, 409, {
        ok: false,
        error: 'package_not_upgrade',
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }
    if (pack.price_usdt <= 0) {
      const id = foxpayPurchaseId();
      const purchase = {
        id,
        player_id: playerId,
        package_id: pack.id,
        amount_usdt: pack.price_usdt,
        status: 'approved',
        tx_hash: '',
        created_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      };
      if (!pool) {
        foxpayPurchases.set(id, purchase);
      } else {
        await pool.query(
          `insert into foxpay_purchases
             (id, player_id, package_id, amount_usdt, status, tx_hash, reviewed_at, fox_tokens_paid, fox_usdt_paid, usdt_due)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, playerId, pack.id, pack.price_usdt, purchase.status, null, purchase.reviewed_at, 0, 0, 0],
        );
      }
      resetFoxPayPlayerForPackage(player, pack, settings);
      await saveFoxPayPlayer(player);
      await creditFoxPayReferralTickets(player, pack, settings);
      await creditFoxPayUnilevel(player, pack.price_usdt, settings, id, 'package');
      return sendJson(response, 200, {
        ok: true,
        purchase,
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }

    purchaseLockKey = `${playerId}:${pack.id}`;
    if (foxpayPurchaseLocks.has(purchaseLockKey)) {
      await delay(800);
      const pendingPurchase = await findPendingFoxPayPackagePurchase(playerId, pack.id);
      const pendingPayment = pendingPurchase ? await getFoxPayPayment(pendingPurchase.id) : null;
      if (pendingPurchase && pendingPayment && !paymentIsClosed(pendingPayment.status)) {
        const expectedContribution = foxPayPackageFoxContribution(
          {
            ...player,
            token_balance: Math.max(0, Math.floor(toNumber(player.token_balance))) + Math.max(0, Math.floor(toNumber(pendingPurchase.fox_tokens_paid))),
          },
          pack,
          settings,
          requestedFoxTokens,
        );
        const expectedPendingPayment = {
          network,
          usdtDue: expectedContribution.remaining_usdt,
          foxTokens: expectedContribution.fox_tokens,
        };
        if (!paymentIsPaid(pendingPayment.status) && !foxPayPendingPurchaseMatchesPack(pendingPurchase, pack, pendingPayment, expectedPendingPayment)) {
          await cancelFoxPayPendingPackagePayment(pendingPayment, pendingPurchase, 'package_payment_changed');
          return sendJson(response, 409, {
            ok: false,
            error: 'payment_in_progress',
            dashboard: await buildFoxPayDashboard(playerId),
          });
        }
        return sendJson(response, 200, {
          ok: true,
          purchase: pendingPurchase,
          payment: sanitizeFoxPayPayment(pendingPayment),
          dashboard: await buildFoxPayDashboard(playerId),
        });
      }
      return sendJson(response, 409, {
        ok: false,
        error: 'payment_in_progress',
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }
    foxpayPurchaseLocks.add(purchaseLockKey);

    const pendingPurchase = await findPendingFoxPayPackagePurchase(playerId, pack.id);
    if (pendingPurchase) {
      const pendingPayment = await refreshFoxPayPayment(await getFoxPayPayment(pendingPurchase.id));
      if (pendingPayment && !paymentIsPaid(pendingPayment.status) && !paymentIsClosed(pendingPayment.status)) {
        const expectedContribution = foxPayPackageFoxContribution(
          {
            ...player,
            token_balance: Math.max(0, Math.floor(toNumber(player.token_balance))) + Math.max(0, Math.floor(toNumber(pendingPurchase.fox_tokens_paid))),
          },
          pack,
          settings,
          requestedFoxTokens,
        );
        const expectedPendingPayment = {
          network,
          usdtDue: expectedContribution.remaining_usdt,
          foxTokens: expectedContribution.fox_tokens,
        };
        if (foxPayPendingPurchaseMatchesPack(pendingPurchase, pack, pendingPayment, expectedPendingPayment)) {
          foxpayPurchaseLocks.delete(purchaseLockKey);
          purchaseLockKey = '';
          return sendJson(response, 200, {
            ok: true,
            purchase: pendingPurchase,
            payment: sanitizeFoxPayPayment(pendingPayment),
            dashboard: await buildFoxPayDashboard(playerId),
          });
        }
        await cancelFoxPayPendingPackagePayment(pendingPayment, pendingPurchase, 'package_payment_changed');
      }
      if (pendingPayment && paymentIsPaid(pendingPayment.status)) {
        foxpayPurchaseLocks.delete(purchaseLockKey);
        purchaseLockKey = '';
        return sendJson(response, 200, {
          ok: true,
          purchase: await getFoxPayPurchase(pendingPurchase.id) || pendingPurchase,
          payment: sanitizeFoxPayPayment(pendingPayment),
          dashboard: await buildFoxPayDashboard(playerId),
        });
      }
      player = await ensureFoxPayPlayer(playerId);
    }

    const contribution = foxPayPackageFoxContribution(player, pack, settings, requestedFoxTokens);
    const contributionPayload = {
      package_price_usdt: contribution.package_price_usdt,
      fox_tokens: contribution.fox_tokens,
      fox_usdt: contribution.fox_usdt,
      usdt_due: contribution.remaining_usdt,
      token_price_usd: contribution.token_price_usd,
      fox_deducted_at: contribution.fox_tokens > 0 ? new Date().toISOString() : '',
    };
    if (contribution.fox_tokens > 0) {
      player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance))) - contribution.fox_tokens;
      await saveFoxPayPlayer(player);
    }

    if (contribution.is_full_fox) {
      const id = foxpayPurchaseId();
      const purchase = {
        id,
        player_id: playerId,
        package_id: pack.id,
        amount_usdt: pack.price_usdt,
        status: 'approved',
        tx_hash: `fox_wallet:${contribution.fox_tokens}`,
        created_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        fox_tokens_paid: contribution.fox_tokens,
        fox_usdt_paid: contribution.fox_usdt,
      };
      if (!pool) {
        foxpayPurchases.set(id, purchase);
      } else {
        await pool.query(
          `insert into foxpay_purchases
             (id, player_id, package_id, amount_usdt, status, tx_hash, reviewed_at, fox_tokens_paid, fox_usdt_paid, usdt_due)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, playerId, pack.id, pack.price_usdt, purchase.status, purchase.tx_hash, purchase.reviewed_at, contribution.fox_tokens, contribution.fox_usdt, 0],
        );
      }
      resetFoxPayPlayerForPackage(player, pack, settings);
      await saveFoxPayPlayer(player);
      await creditFoxPayReferralTickets(player, pack, settings);
      await creditFoxPayUnilevel(player, pack.price_usdt, settings, id, 'package');
      foxpayPurchaseLocks.delete(purchaseLockKey);
      purchaseLockKey = '';
      return sendJson(response, 200, {
        ok: true,
        purchase,
        fox_payment: contributionPayload,
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }

    let payment;
    try {
      payment = await createFoxPayCryptoPayment({
      playerId,
      itemType: 'package',
      itemId: pack.id,
      amountUsdt: contribution.remaining_usdt,
      network,
      description: `FoxPay ${pack.name}`,
      });
    } catch (error) {
      if (contribution.fox_tokens > 0) {
        player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance))) + contribution.fox_tokens;
        await saveFoxPayPlayer(player);
      }
      throw error;
    }
    payment.raw_payload = {
      ...(foxPayPaymentRaw(payment) || {}),
      package_payment: contributionPayload,
    };
    await saveFoxPayPayment(payment);
    const purchase = {
      id: payment.id,
      player_id: playerId,
      package_id: pack.id,
      amount_usdt: pack.price_usdt,
      status: 'pending',
      tx_hash: contribution.fox_tokens > 0
        ? `${payment.nowpayments_payment_id || payment.order_id}:fox_${contribution.fox_tokens}`
        : payment.nowpayments_payment_id || payment.order_id,
      created_at: new Date().toISOString(),
      reviewed_at: null,
      fox_tokens_paid: contribution.fox_tokens,
      fox_usdt_paid: contribution.fox_usdt,
      usdt_due: contribution.remaining_usdt,
    };

    if (!pool) {
      foxpayPurchases.set(payment.id, purchase);
    } else {
      await pool.query(
        `insert into foxpay_purchases
           (id, player_id, package_id, amount_usdt, status, tx_hash, reviewed_at, fox_tokens_paid, fox_usdt_paid, usdt_due)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [payment.id, playerId, pack.id, pack.price_usdt, purchase.status, purchase.tx_hash || null, null, contribution.fox_tokens, contribution.fox_usdt, contribution.remaining_usdt],
      );
    }

    foxpayPurchaseLocks.delete(purchaseLockKey);
    purchaseLockKey = '';
    return sendJson(response, 200, {
      ok: true,
      purchase,
      payment: sanitizeFoxPayPayment(payment),
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    if (purchaseLockKey) foxpayPurchaseLocks.delete(purchaseLockKey);
    console.error('FoxPay purchase failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_purchase_failed' });
  }
}

async function listFoxPayPurchases(playerId = '') {
  const normalize = (rows) => rows.map((row) => ({
    ...row,
    amount_usdt: toNumber(row.amount_usdt),
    fox_tokens_paid: Math.max(0, Math.floor(toNumber(row.fox_tokens_paid))),
    fox_usdt_paid: toNumber(row.fox_usdt_paid),
    usdt_due: toNumber(row.usdt_due),
  }));
  if (!pool) {
    return normalize([...foxpayPurchases.values()]
      .filter((row) => !playerId || row.player_id === playerId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  }
  const result = await pool.query(
    `select * from foxpay_purchases
     ${playerId ? 'where player_id = $1' : ''}
     order by created_at desc limit 500`,
    playerId ? [playerId] : [],
  );
  return normalize(result.rows);
}

async function listFoxPayWithdrawals(playerId = '') {
  const withLinks = (rows) => rows.map((row) => ({
    ...row,
    network: row.network || '',
    tx_hash: row.tx_hash || '',
    tx_url: explorerTxUrl(row.network, row.tx_hash),
  }));
  if (!pool) {
    return withLinks([...foxpayWithdrawals.values()]
      .filter((row) => !playerId || row.player_id === playerId)
      .map((row) => {
        const player = foxpayPlayers.get(row.player_id) || {};
        return {
          ...row,
          username: player.username || '',
          email: player.email || '',
        };
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  }
  const result = await pool.query(
    `select w.*, p.username, p.email
     from foxpay_withdrawals w
     left join foxpay_players p on p.player_id = w.player_id
     ${playerId ? 'where w.player_id = $1' : ''}
     order by w.created_at desc limit 500`,
    playerId ? [playerId] : [],
  );
  return withLinks(result.rows);
}

async function listFoxPayPayments(playerId = '') {
  const normalize = (rows) => rows.map((row) => sanitizeFoxPayPayment(row));
  if (!pool) {
    return normalize([...foxpayPayments.values()]
      .filter((row) => !playerId || row.player_id === playerId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))));
  }
  const result = await pool.query(
    `select * from foxpay_payments
     ${playerId ? 'where player_id = $1' : ''}
     order by created_at desc limit 100`,
    playerId ? [playerId] : [],
  );
  return normalize(result.rows);
}

async function saveFoxPayCommission(entry) {
  if (!pool) {
    foxpayCommissions.set(entry.id, entry);
    return entry;
  }
  await pool.query(
    `insert into foxpay_commissions
      (id, source_id, source_type, buyer_player_id, referrer_player_id, level, rate, amount_usdt,
       expected_tokens, credited_tokens, lost_tokens, credited_usd, lost_usd, referrer_package_id, status, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     on conflict (id) do nothing`,
    [
      entry.id,
      entry.source_id,
      entry.source_type,
      entry.buyer_player_id,
      entry.referrer_player_id,
      entry.level,
      entry.rate,
      entry.amount_usdt,
      entry.expected_tokens,
      entry.credited_tokens,
      entry.lost_tokens,
      entry.credited_usd,
      entry.lost_usd,
      entry.referrer_package_id,
      entry.status,
      entry.created_at,
    ],
  );
  return entry;
}

async function listFoxPayCommissions(playerId = '') {
  if (!pool) {
    return [...foxpayCommissions.values()]
      .filter((row) => !playerId || row.referrer_player_id === playerId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 500);
  }
  const result = await pool.query(
    `select * from foxpay_commissions
     ${playerId ? 'where referrer_player_id = $1' : ''}
     order by created_at desc limit 500`,
    playerId ? [playerId] : [],
  );
  return result.rows;
}

async function handleFoxPayPassiveClaim(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const accountToken = params.get('account_token') || '';

  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    if (player.password_hash && !foxPayAccountTokenMatches(player, accountToken)) {
      return sendJson(response, 401, { ok: false, error: 'account_login_required' });
    }

    const now = new Date();
    const lastClaim = new Date(player.last_passive_claim_timestamp || player.created_at || now);
    const msDiff = now.getTime() - lastClaim.getTime();
    const hoursDiff = Math.max(0, msDiff / (1000 * 60 * 60));
    
    const cappedHours = Math.min(3.0, hoursDiff);
    const passiveIncomePerHour = toNumber(player.passive_income_per_hour, 0);
    const earned = cappedHours * passiveIncomePerHour;

    const beforeBalance = toNumber(player.game_fox_balance, 0);
    const nextBalance = beforeBalance + earned;

    player.game_fox_balance = nextBalance;
    player.last_passive_claim_timestamp = now.toISOString();

    if (!pool) {
      await saveFoxPayPlayer(player);
    } else {
      await pool.query(
        `update foxpay_players 
         set game_fox_balance = $2, last_passive_claim_timestamp = $3, updated_at = now()
         where player_id = $1`,
        [playerId, nextBalance, now.toISOString()]
      );
    }

    return sendJson(response, 200, {
      ok: true,
      earned,
      game_fox_balance: nextBalance,
      last_passive_claim_timestamp: player.last_passive_claim_timestamp,
      dashboard: await buildFoxPayDashboard(playerId)
    });
  } catch (error) {
    console.error('FoxPay passive claim failed', error);
    return sendJson(response, 500, { ok: false, error: 'internal_server_error' });
  }
}

async function handleFoxPayPassiveUpgrade(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const accountToken = params.get('account_token') || '';
  const cardId = params.get('card_id') || '';

  if (!playerId || !cardId) {
    return sendJson(response, 400, { ok: false, error: 'missing_upgrade_params' });
  }

  const cardConfig = FOXPAY_UPGRADE_CARDS.find(c => c.id === cardId);
  if (!cardConfig) {
    return sendJson(response, 404, { ok: false, error: 'card_not_found' });
  }

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    if (player.password_hash && !foxPayAccountTokenMatches(player, accountToken)) {
      return sendJson(response, 401, { ok: false, error: 'account_login_required' });
    }

    let cardsLevels = {};
    try {
      cardsLevels = typeof player.upgrade_cards_levels === 'string' 
        ? JSON.parse(player.upgrade_cards_levels) 
        : (player.upgrade_cards_levels || {});
    } catch (e) {
      cardsLevels = {};
    }

    const currentLevel = Number(cardsLevels[cardId] || 0);
    const nextLevel = currentLevel + 1;

    if (cardConfig.requires) {
      const req = cardConfig.requires;
      if (req.type === 'card') {
        const requiredCardLevel = Number(cardsLevels[req.id] || 0);
        if (requiredCardLevel < req.level) {
          return sendJson(response, 403, { 
            ok: false, 
            error: 'prerequisite_card_not_met', 
            message: `Requiere ${req.id} a Nivel ${req.level}.` 
          });
        }
      } else if (req.type === 'invites') {
        let inviteCount = 0;
        if (!pool) {
          inviteCount = [...friendProgress.values()].filter(f => f.referrer_id === playerId).length;
        } else {
          const invQuery = await pool.query('select count(1) as cnt from foxpay_players where referrer_id = $1', [playerId]);
          inviteCount = Number(invQuery.rows[0]?.cnt || 0);
        }
        if (inviteCount < req.count) {
          return sendJson(response, 403, { 
            ok: false, 
            error: 'prerequisite_invites_not_met', 
            message: `Requiere invitar a ${req.count} amigos.` 
          });
        }
      } else if (req.type === 'card_and_invites') {
        const requiredCardLevel = Number(cardsLevels[req.id] || 0);
        if (requiredCardLevel < req.level) {
          return sendJson(response, 403, { 
            ok: false, 
            error: 'prerequisite_card_not_met', 
            message: `Requiere ${req.id} a Nivel ${req.level}.` 
          });
        }
        let inviteCount = 0;
        if (!pool) {
          inviteCount = [...friendProgress.values()].filter(f => f.referrer_id === playerId).length;
        } else {
          const invQuery = await pool.query('select count(1) as cnt from foxpay_players where referrer_id = $1', [playerId]);
          inviteCount = Number(invQuery.rows[0]?.cnt || 0);
        }
        if (inviteCount < req.invites) {
          return sendJson(response, 403, { 
            ok: false, 
            error: 'prerequisite_invites_not_met', 
            message: `Requiere invitar a ${req.invites} amigos.` 
          });
        }
      } else if (req.type === 'card_and_premium') {
        const requiredCardLevel = Number(cardsLevels[req.id] || 0);
        if (requiredCardLevel < req.level) {
          return sendJson(response, 403, { 
            ok: false, 
            error: 'prerequisite_card_not_met', 
            message: `Requiere ${req.id} a Nivel ${req.level}.` 
          });
        }
        if (player.active_package_id === 'free') {
          return sendJson(response, 403, { 
            ok: false, 
            error: 'paid_package_required', 
            message: 'Requiere tener un paquete de pago activo.' 
          });
        }
      }
    }

    const cost = Math.floor(cardConfig.baseCost * Math.pow(cardConfig.costMultiplier, nextLevel - 1));
    const currentBalance = toNumber(player.game_fox_balance, 0);

    if (currentBalance < cost) {
      return sendJson(response, 400, { ok: false, error: 'insufficient_game_fox' });
    }

    const newBalance = currentBalance - cost;
    cardsLevels[cardId] = nextLevel;
    
    const extraProfitPerHour = cardConfig.baseProfit;
    const newPassiveIncome = toNumber(player.passive_income_per_hour, 0) + extraProfitPerHour;

    player.game_fox_balance = newBalance;
    player.upgrade_cards_levels = cardsLevels;
    player.passive_income_per_hour = newPassiveIncome;

    if (!pool) {
      await saveFoxPayPlayer(player);
    } else {
      await pool.query(
        `update foxpay_players 
         set game_fox_balance = $2, upgrade_cards_levels = $3, passive_income_per_hour = $4, updated_at = now()
         where player_id = $1`,
        [playerId, newBalance, JSON.stringify(cardsLevels), newPassiveIncome]
      );
    }

    return sendJson(response, 200, {
      ok: true,
      card_id: cardId,
      new_level: nextLevel,
      cost,
      game_fox_balance: newBalance,
      passive_income_per_hour: newPassiveIncome,
      upgrade_cards_levels: cardsLevels,
      dashboard: await buildFoxPayDashboard(playerId)
    });
  } catch (error) {
    console.error('FoxPay passive upgrade failed', error);
    return sendJson(response, 500, { ok: false, error: 'internal_server_error' });
  }
}

async function handleFoxPayWithdrawal(request, response, url) {
  const params = await readRequestParams(request, url);

  const playerId = params.get('player_id') || '';
  const accountToken = params.get('account_token') || '';
  const wallet = String(params.get('wallet') || '').trim();
  const network = normalizeWithdrawalNetwork(params.get('network'));
  const password = params.get('password') || '';
  const tokens = Math.floor(Number(params.get('tokens') || 0));

  if (!playerId || !wallet || tokens <= 0 || !network) {
    return sendJson(response, 400, { ok: false, error: 'missing_withdrawal_params' });
  }

  if (!isValidWithdrawalAddress(wallet, network)) {
    return sendJson(response, 400, { ok: false, error: 'invalid_wallet_address', message: 'La direccion de wallet no coincide con la red seleccionada.' });
  }

  try {
    const settings = await getFoxPaySettings();
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const usdtAmount = tokens * toNumber(settings.token_price_usd, 0.0001);
    const minimumUsdt = Math.max(0.01, toNumber(settings.withdrawal_min_usdt, 10));
    const previousWithdrawals = await listFoxPayWithdrawals(playerId);

    if (!player.password_hash) {
      return sendJson(response, 403, { ok: false, error: 'account_registration_required' });
    }

    const hasPassword = Boolean(password);
    const accountTokenMatches = foxPayAccountTokenMatches(player, accountToken);
    const passwordMatches = Boolean(hasPassword && verifyFoxPayPassword(password, player.password_salt, player.password_hash));
    const refreshedAccountToken = !accountTokenMatches && passwordMatches ? issueFoxPayAccountSession(player, foxPaySessionPayloadFromParams(params)) : '';
    if (!accountTokenMatches && !passwordMatches) {
      if (hasPassword) {
        return sendJson(response, 403, { ok: false, error: 'invalid_wallet_password', message: 'Contrasena incorrecta.' });
      }
      return sendJson(response, 401, { ok: false, error: 'account_login_required' });
    }
    if (!normalizeFoxPayEmail(player.email || '')) {
      return sendJson(response, 403, {
        ok: false,
        error: 'email_required_for_withdrawal',
        message: 'Agrega tu correo electronico antes de solicitar retiros.',
      });
    }

    const savedWallet = String(player.withdrawal_wallet || '').trim();
    const savedNetwork = normalizeWithdrawalNetwork(player.withdrawal_network);
    const changesSavedWallet = Boolean(savedWallet && savedNetwork && (savedWallet !== wallet || savedNetwork !== network));
    if (changesSavedWallet && !passwordMatches) {
      return sendJson(response, 403, {
        ok: false,
        error: hasPassword ? 'invalid_wallet_password' : 'wallet_change_password_required',
        message: hasPassword ? 'Contrasena incorrecta.' : 'Confirma tu contrasena para cambiar la wallet guardada.',
      });
    }

    if (player.active_package_id === 'free') {
      if (player.free_withdrawal_claimed) {
        return sendJson(response, 403, { 
          ok: false, 
          error: 'free_withdrawal_limit_exceeded', 
          message: 'Ya has reclamado tu retiro unico del plan gratuito.' 
        });
      }
      const hasPriorWithdrawals = previousWithdrawals.length > 0;
      if (hasPriorWithdrawals) {
        return sendJson(response, 403, { 
          ok: false, 
          error: 'free_withdrawal_limit_exceeded', 
          message: 'Ya posees solicitudes de retiro registradas en tu historial.' 
        });
      }
      if (usdtAmount > freeWithdrawalLimitUsd) {
        return sendJson(response, 403, { 
          ok: false, 
          error: 'free_withdrawal_amount_limit', 
          message: `El limite maximo de retiro para el plan gratuito es de ${freeWithdrawalLimitUsd} USDT.` 
        });
      }
    }

    if (player.token_balance < tokens) {
      return sendJson(response, 403, { ok: false, error: 'insufficient_tokens' });
    }

    if (previousWithdrawals.some((row) => row.status === 'pending')) {
      return sendJson(response, 409, { ok: false, error: 'pending_withdrawal_exists', message: 'Ya tienes un retiro pendiente. Espera aprobacion del admin antes de solicitar otro.' });
    }

    if (player.active_package_id !== 'free' && usdtAmount < minimumUsdt) {
      return sendJson(response, 403, { ok: false, error: 'minimum_withdrawal_usdt', message: `El retiro minimo es ${minimumUsdt} USDT.` });
    }

    const withdrawal = {
      id: foxpayPurchaseId(),
      player_id: playerId,
      tokens,
      usdt_amount: usdtAmount,
      wallet,
      network,
      tx_hash: '',
      status: 'pending',
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };

    if (!pool) {
      if (player.active_package_id === 'free') {
        player.free_withdrawal_claimed = true;
      }
      player.token_balance -= tokens;
      player.withdrawal_wallet = wallet;
      player.withdrawal_network = network;
      await saveFoxPayPlayer(player);
      foxpayWithdrawals.set(withdrawal.id, withdrawal);
    } else {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const balanceResult = await client.query(
          `update foxpay_players
           set token_balance = token_balance - $2,
               withdrawal_wallet = $3,
               withdrawal_network = $4,
               account_token = case when $5 <> '' then $5 else account_token end,
               free_withdrawal_claimed = case when active_package_id = 'free' then true else free_withdrawal_claimed end,
               updated_at = now()
           where player_id = $1 and token_balance >= $2
           returning token_balance`,
          [playerId, tokens, wallet, network, refreshedAccountToken ? player.account_token : ''],
        );

        if (!balanceResult.rowCount) {
          await client.query('rollback');
          return sendJson(response, 403, { ok: false, error: 'insufficient_tokens' });
        }
        await client.query(
          `insert into foxpay_withdrawals (id, player_id, tokens, usdt_amount, wallet, network, status)
           values ($1, $2, $3, $4, $5, $6, 'pending')`,
          [withdrawal.id, playerId, tokens, usdtAmount, wallet, network],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        if (error.code === '23505') {
          return sendJson(response, 409, { ok: false, error: 'pending_withdrawal_exists', message: 'Ya tienes un retiro pendiente. Espera aprobacion del admin antes de solicitar otro.' });
        }
        throw error;
      } finally {
        client.release();
      }
    }

    void notifyFoxPayAdmins('withdrawal_requested', {
      eventKey: `withdrawal_requested:${withdrawal.id}`,
      title: 'FoxPay',
      message: 'Actividad administrativa disponible.',
      url: foxpayAdminUrl,
      data: {
        withdrawal_id: withdrawal.id,
        player_id: playerId,
        username: player.username || '',
        usdt_amount: toNumber(usdtAmount),
        tokens: toNumber(tokens),
        network,
      },
    });

    return sendJson(response, 200, {
      ok: true,
      ...(refreshedAccountToken ? { account_token: refreshedAccountToken } : {}),
      withdrawal,
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay withdrawal failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_withdrawal_failed' });
  }
}

function signFoxPayAdminSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', foxpayAdminSessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyFoxPayAdminSession(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', foxpayAdminSessionSecret).update(body).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.username || !payload?.role || Date.now() > Number(payload.exp || 0)) return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeFoxPayAdminPermissions(value, role = 'viewer') {
  const safeRole = foxpayAdminRolePermissions[role] ? role : 'viewer';
  const raw = parseJsonObject(value);
  const hasCustomPermissions = foxpayAdminPermissionKeys.some((key) => raw[key] !== undefined);
  const allowed = new Set(safeRole === 'super_admin' || !hasCustomPermissions
    ? foxpayAdminRolePermissions[safeRole] || foxpayAdminRolePermissions.viewer
    : []);
  foxpayAdminPermissionKeys.forEach((key) => {
    if (raw[key] === true || raw[key] === 'true' || raw[key] === 1 || raw[key] === '1') allowed.add(key);
    if (raw[key] === false || raw[key] === 'false' || raw[key] === 0 || raw[key] === '0') allowed.delete(key);
  });
  foxpayAdminPermissionGroups.forEach((group) => {
    if (group.edit && allowed.has(group.edit) && group.view) allowed.add(group.view);
  });
  allowed.add('overview_view');
  if (safeRole === 'super_admin') foxpayAdminPermissionKeys.forEach((key) => allowed.add(key));
  return Object.fromEntries(foxpayAdminPermissionKeys.map((key) => [key, allowed.has(key)]));
}

function simpleFoxPayAdminPermissions(canEdit = false) {
  return Object.fromEntries(foxpayAdminPermissionKeys.map((key) => [
    key,
    key.endsWith('_view') || (canEdit && key.endsWith('_edit')),
  ]));
}

function foxPayAdminWithPermissions(admin) {
  if (!admin) return null;
  const realSuperAdmin = isRealFoxPaySuperAdmin(admin);
  const canEdit = realSuperAdmin || admin.can_edit === true || admin.can_edit === 'true' || admin.can_edit === 1;
  const permissions = simpleFoxPayAdminPermissions(canEdit);
  permissions.maintenance_edit = realSuperAdmin;
  return {
    ...admin,
    role: foxpayAdminRolePermissions[admin.role] ? admin.role : 'viewer',
    approved: realSuperAdmin || admin.approved !== false,
    can_edit: canEdit,
    permissions,
  };
}

function isRealFoxPaySuperAdmin(admin) {
  return admin?.role === 'super_admin' && ['env', 'legacy'].includes(admin?.source);
}

function adminHasPermission(admin, permission) {
  if (!permission || permission === 'view') return true;
  const effective = foxPayAdminWithPermissions(admin);
  if (isRealFoxPaySuperAdmin(effective)) return true;
  const required = foxpayLegacyAdminPermissionMap[permission] || permission;
  if (required === 'maintenance_edit') return false;
  if (String(required).endsWith('_view')) return true;
  return Boolean(effective?.can_edit);
}

function sanitizeFoxPayAdminUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    approved: user.approved !== false,
    can_edit: user.can_edit === true,
    push_enabled: user.push_enabled !== false,
    permissions: simpleFoxPayAdminPermissions(user.can_edit === true),
    created_by: user.created_by || '',
    active: user.active !== false,
    created_at: user.created_at || '',
    updated_at: user.updated_at || '',
    last_login_at: user.last_login_at || null,
  };
}

async function listFoxPayAdminUsers() {
  if (!pool) {
    return [...foxpayAdminUsersMemory.values()].map(sanitizeFoxPayAdminUser);
  }
  const result = await pool.query(
    `select id, username, role, permissions, created_by, approved, can_edit, push_enabled, active, created_at, updated_at, last_login_at
     from foxpay_admin_users order by created_at desc`,
  );
  return result.rows.map(sanitizeFoxPayAdminUser);
}

async function findFoxPayAdminUser(username) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!pool) {
    return foxpayAdminUsersMemory.get(normalized) || null;
  }
  const result = await pool.query('select * from foxpay_admin_users where lower(username) = $1', [normalized]);
  return result.rows[0] || null;
}

async function saveFoxPayAdminUser({ username, password, role = 'viewer', active = true, approved = false, canEdit = false, pushEnabled = true, createdBy = '', allowPrivilegedPermissions = false }) {
  const normalized = String(username || '').trim();
  const safeRole = allowPrivilegedPermissions && role === 'super_admin' ? 'super_admin' : 'viewer';
  const existing = await findFoxPayAdminUser(normalized);
  const passwordValue = String(password || '');
  if (!normalized || (!existing && passwordValue.length < 8) || (passwordValue && passwordValue.length < 8)) {
    const error = new Error('invalid_admin_user');
    error.code = 'invalid_admin_user';
    throw error;
  }
  const passwordData = passwordValue
    ? hashFoxPayPassword(passwordValue)
    : { hash: existing.password_hash, salt: existing.password_salt };
  const normalizedCreatedBy = String(existing?.created_by || createdBy || '').trim().slice(0, 80);
  const safeApproved = allowPrivilegedPermissions ? settingEnabled(approved) : Boolean(existing?.approved) && existing.created_by === normalizedCreatedBy;
  const safeCanEdit = allowPrivilegedPermissions ? settingEnabled(canEdit) : false;
  const safePushEnabled = allowPrivilegedPermissions ? settingEnabled(pushEnabled) : existing?.push_enabled !== false;
  const normalizedPermissions = simpleFoxPayAdminPermissions(safeCanEdit);
  const id = `admin_${md5(normalized.toLowerCase()).slice(0, 14)}`;
  if (!pool) {
    const item = {
      ...(existing || {}),
      id,
      username: normalized,
      password_hash: passwordData.hash,
      password_salt: passwordData.salt,
      role: safeRole,
      permissions: normalizedPermissions,
      created_by: normalizedCreatedBy,
      approved: safeApproved,
      can_edit: safeCanEdit,
      push_enabled: safePushEnabled,
      active,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: existing?.last_login_at || null,
    };
    foxpayAdminUsersMemory.set(normalized.toLowerCase(), item);
    return sanitizeFoxPayAdminUser(item);
  }
  const result = await pool.query(
    `insert into foxpay_admin_users (id, username, password_hash, password_salt, role, permissions, created_by, approved, can_edit, push_enabled, active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (username) do update
       set password_hash = excluded.password_hash,
           password_salt = excluded.password_salt,
           role = excluded.role,
           permissions = excluded.permissions,
           created_by = coalesce(foxpay_admin_users.created_by, excluded.created_by),
           approved = excluded.approved,
           can_edit = excluded.can_edit,
           push_enabled = excluded.push_enabled,
           active = excluded.active,
           updated_at = now()
     returning id, username, role, permissions, created_by, approved, can_edit, push_enabled, active, created_at, updated_at, last_login_at`,
    [id, normalized, passwordData.hash, passwordData.salt, safeRole, JSON.stringify(normalizedPermissions), normalizedCreatedBy, safeApproved, safeCanEdit, safePushEnabled, active],
  );
  return sanitizeFoxPayAdminUser(result.rows[0]);
}

async function updateFoxPayAdminPassword(username, password) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized || String(password || '').length < 8) {
    const error = new Error('invalid_admin_password');
    error.code = 'invalid_admin_password';
    throw error;
  }
  const passwordData = hashFoxPayPassword(password);
  if (!pool) {
    const item = foxpayAdminUsersMemory.get(normalized);
    if (!item) return false;
    item.password_hash = passwordData.hash;
    item.password_salt = passwordData.salt;
    item.updated_at = new Date().toISOString();
    foxpayAdminUsersMemory.set(normalized, item);
    return true;
  }
  const result = await pool.query(
    `update foxpay_admin_users
     set password_hash = $2, password_salt = $3, updated_at = now()
     where lower(username) = $1 and active = true`,
    [normalized, passwordData.hash, passwordData.salt],
  );
  return Boolean(result.rowCount);
}

async function deleteFoxPayAdminUser(username) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return false;
  if (!pool) {
    return foxpayAdminUsersMemory.delete(normalized);
  }
  const result = await pool.query('delete from foxpay_admin_users where lower(username) = $1', [normalized]);
  return Boolean(result.rowCount);
}

async function touchFoxPayAdminLogin(username) {
  if (!pool) {
    const item = foxpayAdminUsersMemory.get(String(username || '').toLowerCase());
    if (item) item.last_login_at = new Date().toISOString();
    return;
  }
  await pool.query('update foxpay_admin_users set last_login_at = now() where lower(username) = lower($1)', [username]);
}

function foxPayAdminLoginAttemptKey(request, username, legacyKey) {
  const ip = getClientIp(request) || 'unknown-ip';
  const identity = String(username || (legacyKey ? 'legacy-key' : 'unknown-admin')).trim().toLowerCase() || 'unknown-admin';
  return `${ip}:${identity}`;
}

function foxPayAdminLoginLimit(key) {
  const now = Date.now();
  const entry = foxpayAdminLoginAttempts.get(key);
  if (!entry) return null;
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
    };
  }
  if ((now - entry.firstFailedAt) > foxpayAdminLoginWindowMs) {
    foxpayAdminLoginAttempts.delete(key);
  }
  return null;
}

function recordFoxPayAdminLoginFailure(key) {
  const now = Date.now();
  const current = foxpayAdminLoginAttempts.get(key);
  const entry = current && (now - current.firstFailedAt) <= foxpayAdminLoginWindowMs
    ? current
    : { failures: 0, firstFailedAt: now, blockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= foxpayAdminLoginMaxFailures) {
    entry.blockedUntil = now + foxpayAdminLoginBlockMs;
  }
  foxpayAdminLoginAttempts.set(key, entry);
  return entry;
}

function clearFoxPayAdminLoginFailures(key) {
  foxpayAdminLoginAttempts.delete(key);
}

function sendFoxPayAdminLoginFailed(response, key) {
  const entry = recordFoxPayAdminLoginFailure(key);
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.blockedUntil - Date.now()) / 1000));
    response.setHeader('retry-after', String(retryAfterSeconds));
    return sendJson(response, 429, {
      ok: false,
      error: 'admin_login_rate_limited',
      message: 'Demasiados intentos fallidos. Espera unos minutos e intenta otra vez.',
      retry_after_seconds: retryAfterSeconds,
    });
  }
  return sendJson(response, 401, { ok: false, error: 'invalid_admin_login' });
}

async function handleFoxPayAdminLogin(request, response, url) {
  const params = await readRequestParams(request, url);
  const username = String(params.get('username') || '').trim();
  const password = String(params.get('password') || '');
  const legacyKey = String(params.get('admin_key') || '').trim();
  const attemptKey = foxPayAdminLoginAttemptKey(request, username, legacyKey);
  const limit = foxPayAdminLoginLimit(attemptKey);
  if (limit) {
    response.setHeader('retry-after', String(limit.retryAfterSeconds));
    return sendJson(response, 429, {
      ok: false,
      error: 'admin_login_rate_limited',
      message: 'Demasiados intentos fallidos. Espera unos minutos e intenta otra vez.',
      retry_after_seconds: limit.retryAfterSeconds,
    });
  }

  if (legacyKey && foxpayAdminKey && legacyKey === foxpayAdminKey) {
    const admin = foxPayAdminWithPermissions({ username: 'legacy-key', role: 'super_admin', source: 'legacy' });
    const token = signFoxPayAdminSession({ ...admin, exp: Date.now() + 12 * 60 * 60 * 1000 });
    clearFoxPayAdminLoginFailures(attemptKey);
    return sendJson(response, 200, { ok: true, token, admin });
  }

  const dbAdmin = await findFoxPayAdminUser(username);
  if (dbAdmin && dbAdmin.active !== false && dbAdmin.approved !== false) {
    const passwordData = hashFoxPayPassword(password, dbAdmin.password_salt);
    if (passwordData.hash === dbAdmin.password_hash) {
      await touchFoxPayAdminLogin(username);
      const admin = foxPayAdminWithPermissions({
        username: dbAdmin.username,
        role: dbAdmin.role,
        approved: dbAdmin.approved,
        can_edit: dbAdmin.can_edit,
        push_enabled: dbAdmin.push_enabled,
        created_by: dbAdmin.created_by || '',
        source: 'db',
      });
      const token = signFoxPayAdminSession({ ...admin, exp: Date.now() + 12 * 60 * 60 * 1000 });
      clearFoxPayAdminLoginFailures(attemptKey);
      return sendJson(response, 200, { ok: true, token, admin });
    }
    return sendFoxPayAdminLoginFailed(response, attemptKey);
  }
  if (dbAdmin && dbAdmin.active !== false && dbAdmin.approved === false) {
    return sendJson(response, 403, { ok: false, error: 'admin_pending_approval', message: 'Tu acceso admin esta pendiente de aprobacion.' });
  }

  if (foxpaySuperAdminUser && foxpaySuperAdminPassword && username === foxpaySuperAdminUser && password === foxpaySuperAdminPassword) {
    const admin = foxPayAdminWithPermissions({ username, role: 'super_admin', source: 'env' });
    const token = signFoxPayAdminSession({ ...admin, exp: Date.now() + 12 * 60 * 60 * 1000 });
    clearFoxPayAdminLoginFailures(attemptKey);
    return sendJson(response, 200, { ok: true, token, admin });
  }

  return sendFoxPayAdminLoginFailed(response, attemptKey);
}

async function verifyFoxPayAdminPassword(admin, password) {
  const value = String(password || '');
  if (!admin || !value) return false;
  if (admin.source === 'legacy') return Boolean(foxpayAdminKey && value === foxpayAdminKey);
  if (admin.source === 'env') return Boolean(foxpaySuperAdminPassword && value === foxpaySuperAdminPassword);
  const dbAdmin = await findFoxPayAdminUser(admin.username);
  if (!dbAdmin || dbAdmin.active === false) return false;
  return hashFoxPayPassword(value, dbAdmin.password_salt).hash === dbAdmin.password_hash;
}

function adminPushSubscriptionId(subscriptionId) {
  return `admin_push_${md5(String(subscriptionId || '')).slice(0, 24)}`;
}

async function saveFoxPayAdminPushSubscription({ admin, subscriptionId, active, userAgent }) {
  const cleanSubscriptionId = String(subscriptionId || '').trim();
  if (!admin?.username || !cleanSubscriptionId) return null;
  const row = {
    id: adminPushSubscriptionId(cleanSubscriptionId),
    admin_username: String(admin.username || 'admin'),
    subscription_id: cleanSubscriptionId,
    active: active !== false,
    user_agent: String(userAgent || '').slice(0, 500),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };
  if (!pool) {
    foxpayAdminPushSubscriptionsMemory.set(row.subscription_id, {
      ...foxpayAdminPushSubscriptionsMemory.get(row.subscription_id),
      ...row,
      created_at: foxpayAdminPushSubscriptionsMemory.get(row.subscription_id)?.created_at || new Date().toISOString(),
    });
    return row;
  }
  const result = await pool.query(
    `insert into foxpay_admin_push_subscriptions
       (id, admin_username, subscription_id, active, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (subscription_id) do update set
       admin_username = excluded.admin_username,
       active = excluded.active,
       user_agent = excluded.user_agent,
       updated_at = now(),
       last_seen_at = now()
     returning *`,
    [row.id, row.admin_username, row.subscription_id, row.active, row.user_agent],
  );
  return result.rows[0] || row;
}

async function listFoxPayActiveAdminPushSubscriptionIds() {
  if (!pool) {
    return [...foxpayAdminPushSubscriptionsMemory.values()]
      .filter((row) => {
        if (!row.active || !row.subscription_id) return false;
        const admin = foxpayAdminUsersMemory.get(String(row.admin_username || '').toLowerCase());
        return !admin || (admin.active !== false && admin.approved !== false && admin.push_enabled !== false);
      })
      .map((row) => row.subscription_id);
  }
  const result = await pool.query(
    `select distinct s.subscription_id
     from foxpay_admin_push_subscriptions s
     left join foxpay_admin_users a on lower(a.username) = lower(s.admin_username)
     where s.active = true
       and s.subscription_id <> ''
       and (
         a.username is null
         or (a.active = true and a.approved = true and a.push_enabled = true)
       )
     order by s.subscription_id`,
  );
  return result.rows.map((row) => row.subscription_id).filter(Boolean);
}

async function recordFoxPayAdminNotificationEvent(eventType, eventKey, payload = {}) {
  const cleanKey = String(eventKey || '').trim();
  if (!cleanKey) return false;
  if (!pool) {
    if (foxpayAdminNotificationEventsMemory.has(cleanKey)) return false;
    foxpayAdminNotificationEventsMemory.add(cleanKey);
    return true;
  }
  const result = await pool.query(
    `insert into foxpay_admin_notification_events (event_key, event_type, payload)
     values ($1, $2, $3::jsonb)
     on conflict (event_key) do nothing`,
    [cleanKey, eventType, JSON.stringify(payload || {})],
  );
  return result.rowCount > 0;
}

async function recordFoxPayAdminPushLog({ eventType, eventKey = '', status, subscriptionCount = 0, response = {}, error = '' }) {
  const row = {
    event_type: String(eventType || 'push').slice(0, 80),
    event_key: String(eventKey || '').slice(0, 180),
    status: String(status || 'unknown').slice(0, 40),
    subscription_count: Math.max(0, Math.floor(Number(subscriptionCount || 0))),
    response: response || {},
    error: String(error || '').slice(0, 500),
    created_at: new Date().toISOString(),
  };
  if (!pool) {
    foxpayAdminPushLogsMemory.unshift(row);
    foxpayAdminPushLogsMemory.splice(30);
    return row;
  }
  await pool.query(
    `insert into foxpay_admin_push_logs
       (event_type, event_key, status, subscription_count, response, error)
     values ($1, $2, $3, $4, $5::jsonb, $6)`,
    [row.event_type, row.event_key, row.status, row.subscription_count, JSON.stringify(row.response), row.error],
  );
  return row;
}

async function listFoxPayAdminPushLogs(limit = 12) {
  const safeLimit = Math.max(1, Math.min(30, Math.floor(Number(limit || 12))));
  if (!pool) return foxpayAdminPushLogsMemory.slice(0, safeLimit);
  const result = await pool.query(
    `select event_type, event_key, status, subscription_count, response, error, created_at
     from foxpay_admin_push_logs
     order by created_at desc
     limit $1`,
    [safeLimit],
  );
  return result.rows;
}

async function sendOneSignalAdminPush({ title, message, url, data = {}, subscriptionIds = [], eventKey = '' }) {
  const ids = [...new Set(subscriptionIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!oneSignalAppId || !oneSignalRestApiKey || !ids.length) {
    return { ok: false, skipped: true };
  }
  const clickUrl = String(url || foxpayAdminUrl || '').trim() || foxpayAdminUrl;
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Key ${oneSignalRestApiKey}`,
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      target_channel: 'push',
      include_subscription_ids: ids,
      headings: { en: title, es: title },
      contents: { en: message, es: message },
      chrome_web_icon: foxpayPushIconUrl,
      chrome_web_badge: foxpayPushBadgeUrl,
      url: clickUrl,
      data,
    }),
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(body.errors?.[0] || body.error || 'onesignal_request_failed');
    error.data = body;
    throw error;
  }
  return body;
}

async function notifyFoxPayAdmins(eventType, { eventKey, title, message, url = '', data = {} }) {
  let subscriptionIds = [];
  try {
    const isNew = await recordFoxPayAdminNotificationEvent(eventType, eventKey, data);
    if (!isNew) return;
    subscriptionIds = await listFoxPayActiveAdminPushSubscriptionIds();
    const result = await sendOneSignalAdminPush({
      title,
      message,
      url,
      data: { event_type: eventType, ...data },
      subscriptionIds,
      eventKey,
    });
    await recordFoxPayAdminPushLog({
      eventType,
      eventKey,
      status: result?.skipped ? 'skipped' : 'sent',
      subscriptionCount: subscriptionIds.length,
      response: result,
    });
  } catch (error) {
    void recordFoxPayAdminPushLog({
      eventType,
      eventKey,
      status: 'failed',
      subscriptionCount: subscriptionIds.length,
      response: error.data || {},
      error: error.message,
    });
    console.error('FoxPay admin push notification failed', error);
  }
}

async function handleFoxPayAdminPushSubscription(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'view');
  if (!admin) return;
  const params = await readRequestParams(request, url);
  const action = params.get('action') || 'subscribe';
  const subscriptionId = params.get('subscription_id') || params.get('subscriptionId') || '';
  if (!subscriptionId) return sendJson(response, 400, { ok: false, error: 'missing_subscription_id' });
  if (!['subscribe', 'unsubscribe'].includes(action)) {
    return sendJson(response, 400, { ok: false, error: 'invalid_push_action' });
  }
  try {
    const subscription = await saveFoxPayAdminPushSubscription({
      admin,
      subscriptionId,
      active: action === 'subscribe',
      userAgent: request.headers['user-agent'] || '',
    });
    return sendJson(response, 200, { ok: true, subscription });
  } catch (error) {
    console.error('FoxPay admin push subscription failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_admin_push_subscription_failed' });
  }
}

async function handleFoxPayAdminPushDiagnostics(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'view');
  if (!admin) return;
  try {
    const subscriptionIds = await listFoxPayActiveAdminPushSubscriptionIds();
    return sendJson(response, 200, {
      ok: true,
      app_id_configured: Boolean(oneSignalAppId),
      api_key_configured: Boolean(oneSignalRestApiKey),
      active_subscriptions: subscriptionIds.length,
      active_subscription_ids: subscriptionIds.map((id) => `${id.slice(0, 8)}...${id.slice(-6)}`),
      logs: await listFoxPayAdminPushLogs(),
    });
  } catch (error) {
    console.error('FoxPay admin push diagnostics failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_admin_push_diagnostics_failed' });
  }
}

async function handleFoxPayAdminPushTest(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'view');
  if (!admin) return;
  const eventKey = `admin_push_test:${Date.now()}:${md5(admin.username || 'admin').slice(0, 8)}`;
  let subscriptionIds = [];
  try {
    subscriptionIds = await listFoxPayActiveAdminPushSubscriptionIds();
    const result = await sendOneSignalAdminPush({
      title: 'FoxPay Admin',
      message: `Prueba operativa enviada por ${admin.username || 'admin'}.`,
      url: foxpayAdminUrl,
      data: { event_type: 'admin_push_test', admin: admin.username || '' },
      subscriptionIds,
      eventKey,
    });
    await recordFoxPayAdminPushLog({
      eventType: 'admin_push_test',
      eventKey,
      status: result?.skipped ? 'skipped' : 'sent',
      subscriptionCount: subscriptionIds.length,
      response: result,
    });
    return sendJson(response, 200, {
      ok: true,
      status: result?.skipped ? 'skipped' : 'sent',
      subscription_count: subscriptionIds.length,
      result,
      diagnostics: {
        app_id_configured: Boolean(oneSignalAppId),
        api_key_configured: Boolean(oneSignalRestApiKey),
      },
    });
  } catch (error) {
    await recordFoxPayAdminPushLog({
      eventType: 'admin_push_test',
      eventKey,
      status: 'failed',
      subscriptionCount: subscriptionIds.length,
      response: error.data || {},
      error: error.message,
    });
    console.error('FoxPay admin push test failed', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'foxpay_admin_push_test_failed',
      message: error.message,
      data: error.data || {},
      subscription_count: subscriptionIds.length,
    });
  }
}

function requireFoxPayAdmin(request, response, permission = 'view') {
  const sessionToken = request.headers['x-admin-session'] || '';
  const sessionAdmin = verifyFoxPayAdminSession(sessionToken);
  if (sessionAdmin) {
    const effectiveAdmin = foxPayAdminWithPermissions(sessionAdmin);
    if (effectiveAdmin.source === 'db' && effectiveAdmin.approved === false) {
      sendJson(response, 403, { ok: false, error: 'admin_pending_approval' });
      return false;
    }
    if (!adminHasPermission(effectiveAdmin, permission)) {
      sendJson(response, 403, { ok: false, error: 'admin_permission_denied' });
      return false;
    }
    return effectiveAdmin;
  }
  const provided = request.headers['x-admin-key'] || '';
  if (foxpayAdminKey && provided === foxpayAdminKey) {
    return foxPayAdminWithPermissions({ username: 'legacy-key', role: 'super_admin', source: 'legacy' });
  }
  if (!foxpayAdminKey && !sessionToken) {
    sendJson(response, 503, { ok: false, error: 'admin_key_not_configured' });
    return false;
  }
  sendJson(response, 401, { ok: false, error: 'invalid_admin_key' });
  return false;
}

async function handleFoxPayAdminOverview(request, response) {
  const admin = requireFoxPayAdmin(request, response, 'overview_view');
  if (!admin) return;
  try {
    await ensureWorldCupMatchesSeeded();
    const canUsers = adminHasPermission(admin, 'users_view');
    const canSupport = adminHasPermission(admin, 'support_view');
    const canFinance = adminHasPermission(admin, 'finance_view');
    const canContent = adminHasPermission(admin, 'content_view');
    const canSettings = adminHasPermission(admin, 'settings_view') || adminHasPermission(admin, 'settings_edit');
    const settings = await getFoxPaySettings();
    const packages = await getFoxPayPackages(true);
    const avatars = await getFoxPayAvatars(true);
    const skins = await getFoxPaySkins(true);
    const ranks = await getFoxPayRanks(true);
    const purchases = await listFoxPayPurchases();
    const withdrawals = await listFoxPayWithdrawals();
    const commissions = await listFoxPayCommissions();
    const rouletteRewards = await getFoxPayRouletteRewards('', true);
    const rouletteSettings = await getFoxPayRouletteSettings();
    let players;
    if (!pool) {
      players = [...foxpayPlayers.values()];
    } else {
      const result = await pool.query('select * from foxpay_players order by updated_at desc limit 500');
      players = result.rows;
    }
    players = await enrichFoxPayPlayersForAdmin(players);
    const dailyStats = await listFoxPayPlayerDailyStats(players.map((player) => player.player_id), 7);
    const dailyStatsByPlayer = new Map();
    dailyStats.forEach((row) => {
      if (!dailyStatsByPlayer.has(row.player_id)) dailyStatsByPlayer.set(row.player_id, []);
      dailyStatsByPlayer.get(row.player_id).push(row);
    });
    players = players.map((player) => {
      const playerStats = dailyStatsByPlayer.get(player.player_id) || [];
      return {
        ...player,
        today_stats: playerStats.find((row) => row.daily_key === player.daily_key) || null,
        daily_stats: playerStats,
      };
    });
    const supportTickets = await listFoxPayAdminSupportTickets();

    let matches = [];
    let bets = [];
    let playersMap = new Map();
    if (pool) {
      const mRes = await pool.query('select * from foxpay_matches order by created_at desc');
      matches = mRes.rows;
      const bRes = await pool.query('select * from foxpay_bets');
      bets = bRes.rows;
      const pRes = await pool.query('select player_id, username from foxpay_players');
      pRes.rows.forEach(p => playersMap.set(p.player_id, p.username));
    } else {
      matches = Array.from(foxpayMatchesMemory.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      bets = Array.from(foxpayBetsMemory.values());
      Array.from(foxpayPlayers.values()).forEach(p => playersMap.set(p.player_id, p.username));
    }

    const matchesWithAdminDetails = matches.map(match => {
      const matchBets = bets.filter(b => b.match_id === match.id);
      
      const poolStats = {
        team_a: matchBets.filter(b => b.bet_type === 'team_a').reduce((sum, b) => sum + Number(b.amount), 0) + Number(match.manual_pool_a || 0),
        draw: matchBets.filter(b => b.bet_type === 'draw').reduce((sum, b) => sum + Number(b.amount), 0) + Number(match.manual_pool_draw || 0),
        team_b: matchBets.filter(b => b.bet_type === 'team_b').reduce((sum, b) => sum + Number(b.amount), 0) + Number(match.manual_pool_b || 0),
      };
      poolStats.total = poolStats.team_a + poolStats.draw + poolStats.team_b;
      
      const userBets = matchBets.map(b => ({
        player_id: b.player_id,
        username: playersMap.get(b.player_id) || b.player_id,
        bet_type: b.bet_type,
        amount: Number(b.amount),
        created_at: b.created_at
      }));

      return {
        ...match,
        poolStats,
        userBets
      };
    });

    return sendJson(response, 200, {
      ok: true,
      persistence: pool ? 'postgres' : 'memory',
      settings: canSettings ? settings : {
        token_price_usd: settings.token_price_usd,
        token_symbol: settings.token_symbol,
        daily_cycle_minutes: settings.daily_cycle_minutes,
      },
      admin,
      packages: canContent ? packages : [],
      avatars: canContent ? avatars : [],
      skins: canContent ? skins : [],
      ranks: canContent || canUsers ? ranks : [],
      players: canUsers ? players : [],
      purchases: canFinance ? purchases : [],
      withdrawals: canFinance ? withdrawals : [],
      commissions: canFinance ? commissions : [],
      support_tickets: canSupport ? supportTickets : [],
      roulette_rewards: canContent ? rouletteRewards : [],
      roulette_settings: canContent ? rouletteSettings : {},
      matches: matchesWithAdminDetails,
      metrics: {
        users: players.length,
        pending_purchases: purchases.filter((row) => row.status === 'pending').length,
        pending_withdrawals: withdrawals.filter((row) => row.status === 'pending').length,
        support_open: supportTickets.filter((row) => row.status !== 'closed').length,
      },
    });
  } catch (error) {
    console.error('FoxPay admin overview failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_admin_failed' });
  }
}

async function enrichFoxPayPlayersForAdmin(rows) {
  const settings = await getFoxPaySettings();
  const players = rows.map((player) => normalizeFoxPayPlayer(player, { daily_energy: player.max_energy || 300 }, settings));
  const ranks = await getFoxPayRanks();
  const rankPlayers = await loadFoxPayRankPlayers();
  players.forEach((player) => {
    if (!rankPlayers.some((rankPlayer) => rankPlayer.player_id === player.player_id)) rankPlayers.push(player);
  });
  const rankMap = buildFoxPayRankMap(rankPlayers, ranks);
  const sponsorIds = [...new Set(players.map((player) => player.referrer_id).filter(Boolean))];
  const sponsorMap = new Map();
  if (sponsorIds.length) {
    if (!pool) {
      sponsorIds.forEach((sponsorId) => {
        const sponsor = foxpayPlayers.get(sponsorId);
        if (sponsor) sponsorMap.set(sponsorId, sponsor);
      });
    } else {
      const sponsorRows = await pool.query(
        'select player_id, username, password_hash from foxpay_players where player_id = any($1)',
        [sponsorIds],
      );
      sponsorRows.rows.forEach((sponsor) => sponsorMap.set(sponsor.player_id, sponsor));
    }
  }
  players.forEach((player) => {
    const sponsorId = player.referrer_id || '';
    const sponsor = sponsorId ? sponsorMap.get(sponsorId) : null;
    const sponsorRegistered = Boolean(sponsor?.password_hash);
    player.sponsor_id = sponsorId;
    player.sponsor_username = sponsorRegistered ? (sponsor.username || sponsorId) : '';
    player.sponsor_registered = sponsorRegistered;
    player.sponsor_label = sponsorId ? (sponsorRegistered ? (sponsor.username || sponsorId) : sponsorId) : '';
    player.rank = rankMap.get(player.player_id) || ranks[0] || normalizeFoxPayRank(foxpayDefaultRanks[0]);
  });
  await Promise.all(players.map(async (player) => {
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    player._package = pack;
    const repair = enforceFoxPayCap(player, settings, pack);
    if (repair.changed) await saveFoxPayPlayer(player);
  }));
  const missingCountry = players.filter((player) => !player.country_code && player.signup_ip).slice(0, 20);
  await Promise.all(missingCountry.map(async (player) => {
    const country = await lookupCountryByIp(player.signup_ip);
    if (!country.code) return;
    player.country_code = country.code;
    player.country_name = country.name;
    if (pool) {
      await pool.query(
        'update foxpay_players set country_code = $2, country_name = $3, updated_at = now() where player_id = $1',
        [player.player_id, country.code, country.name],
      );
    } else {
      foxpayPlayers.set(player.player_id, { ...foxpayPlayers.get(player.player_id), country_code: country.code, country_name: country.name });
    }
  }));
  return players.map((player) => sanitizeFoxPayPlayer(player, settings));
}

async function repairFoxPayCapOverages() {
  const settings = await getFoxPaySettings();
  const players = pool
    ? (await pool.query('select * from foxpay_players')).rows
    : [...foxpayPlayers.values()];
  for (const row of players) {
    const pack = await getFoxPayPackage(row.active_package_id || 'free');
    const player = normalizeFoxPayPlayer(row, pack, settings);
    player._package = pack;
    const repair = enforceFoxPayCap(player, settings, pack);
    if (repair.changed) await saveFoxPayPlayer(player);
  }
}

async function handleFoxPayAdminSettings(request, response, url) {
  const params = await readRequestParams(request, url);
  const patchValue = (key) => (params.has(key) ? params.get(key) : undefined);
  const hotWalletTouched = ['hot_wallet_network', 'hot_wallet_address', 'hot_wallet_note'].some((key) => params.has(key));
  const admin = requireFoxPayAdmin(request, response, 'settings_edit');
  if (!admin) return;
  try {
    if (hotWalletTouched && !(await verifyFoxPayAdminPassword(admin, params.get('admin_password')))) {
      return sendJson(response, 403, { ok: false, error: 'invalid_admin_password' });
    }
    const settings = await updateFoxPaySettings({
      token_price_usd: hotWalletTouched ? undefined : patchValue('token_price_usd'),
      referral_rate: hotWalletTouched ? undefined : patchValue('referral_rate'),
      block_same_ip: patchValue('block_same_ip'),
      block_same_device: patchValue('block_same_device'),
      daily_cycle_minutes: patchValue('daily_cycle_minutes'),
      youtube_video_urls: patchValue('youtube_video_urls'),
      season_name: patchValue('season_name'),
      season_start_at: patchValue('season_start_at'),
      season_end_at: patchValue('season_end_at'),
      season_winner_limit: patchValue('season_winner_limit'),
      season_reward_tokens: patchValue('season_reward_tokens'),
      season_reward_mode: patchValue('season_reward_mode'),
      season_schedule: patchValue('season_schedule'),
      withdrawal_min_usdt: patchValue('withdrawal_min_usdt'),
      hot_wallet_network: patchValue('hot_wallet_network'),
      hot_wallet_address: patchValue('hot_wallet_address'),
      hot_wallet_note: patchValue('hot_wallet_note'),
      referral_ticket_rewards: patchValue('referral_ticket_rewards'),
      unilevel_config: patchValue('unilevel_config'),
    });
    return sendJson(response, 200, { ok: true, settings });
  } catch (error) {
    console.error('FoxPay settings failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_settings_failed' });
  }
}

async function handleFoxPayAdminUsers(request, response, url) {
  const currentAdmin = requireFoxPayAdmin(request, response, request.method === 'GET' ? 'admins_view' : 'admins_edit');
  if (!currentAdmin) return;
  const params = await readRequestParams(request, url);
  try {
    if (request.method === 'GET') {
      const admins = await listFoxPayAdminUsers();
      const visibleAdmins = isRealFoxPaySuperAdmin(currentAdmin)
        ? admins
        : admins.filter((admin) => String(admin.created_by || '').toLowerCase() === String(currentAdmin.username || '').toLowerCase());
      return sendJson(response, 200, { ok: true, admins: visibleAdmins });
    }
    if (params.get('action') === 'delete') {
      const username = String(params.get('username') || '').trim();
      if (!username) return sendJson(response, 400, { ok: false, error: 'missing_admin_username' });
      if (username.toLowerCase() === String(currentAdmin.username || '').toLowerCase()) {
        return sendJson(response, 409, { ok: false, error: 'cannot_delete_current_admin' });
      }
      if (foxpaySuperAdminUser && username.toLowerCase() === foxpaySuperAdminUser.toLowerCase()) {
        return sendJson(response, 409, { ok: false, error: 'cannot_delete_env_superadmin' });
      }
      if (!isRealFoxPaySuperAdmin(currentAdmin)) {
        const targetAdmin = await findFoxPayAdminUser(username);
        if (!targetAdmin || String(targetAdmin.created_by || '').toLowerCase() !== String(currentAdmin.username || '').toLowerCase()) {
          return sendJson(response, 403, { ok: false, error: 'admin_permission_denied' });
        }
      }
      const deleted = await deleteFoxPayAdminUser(username);
      return sendJson(response, 200, { ok: true, deleted, admins: await listFoxPayAdminUsers() });
    }
    const username = String(params.get('username') || '').trim();
    const password = String(params.get('password') || '');
    const active = settingEnabled(params.get('active') ?? 'true');
    const approved = settingEnabled(params.get('approved'));
    const canEdit = settingEnabled(params.get('can_edit'));
    const pushEnabled = params.has('push_enabled') ? settingEnabled(params.get('push_enabled')) : true;
    if (!isRealFoxPaySuperAdmin(currentAdmin)) {
      const targetAdmin = await findFoxPayAdminUser(username);
      if (targetAdmin && String(targetAdmin.created_by || '').toLowerCase() !== String(currentAdmin.username || '').toLowerCase()) {
        return sendJson(response, 403, { ok: false, error: 'admin_permission_denied' });
      }
    }
    const admin = await saveFoxPayAdminUser({
      username,
      password,
      role: 'viewer',
      active,
      approved,
      canEdit,
      pushEnabled,
      createdBy: currentAdmin.username || '',
      allowPrivilegedPermissions: isRealFoxPaySuperAdmin(currentAdmin),
    });
    const admins = await listFoxPayAdminUsers();
    const visibleAdmins = isRealFoxPaySuperAdmin(currentAdmin)
      ? admins
      : admins.filter((item) => String(item.created_by || '').toLowerCase() === String(currentAdmin.username || '').toLowerCase());
    return sendJson(response, 200, { ok: true, admin, admins: visibleAdmins });
  } catch (error) {
    console.error('FoxPay admin users failed', error);
    const status = error.code === 'invalid_admin_user' ? 400 : 500;
    return sendJson(response, status, { ok: false, error: error.code || 'foxpay_admin_users_failed' });
  }
}

async function handleFoxPayAdminPassword(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'view');
  if (!admin) return;
  const params = await readRequestParams(request, url);
  try {
    if (!(await verifyFoxPayAdminPassword(admin, params.get('current_password')))) {
      return sendJson(response, 403, { ok: false, error: 'invalid_current_password' });
    }
    if (admin.source === 'env') {
      await saveFoxPayAdminUser({
        username: admin.username,
        password: params.get('new_password'),
        role: 'super_admin',
        active: true,
        approved: true,
        canEdit: true,
        allowPrivilegedPermissions: true,
      });
      return sendJson(response, 200, { ok: true, source: 'db_override' });
    }
    if (admin.source !== 'db') {
      return sendJson(response, 409, { ok: false, error: 'legacy_key_password_not_editable' });
    }
    const updated = await updateFoxPayAdminPassword(admin.username, params.get('new_password'));
    if (!updated) return sendJson(response, 404, { ok: false, error: 'admin_user_not_found' });
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('FoxPay admin password failed', error);
    const status = error.code === 'invalid_admin_password' ? 400 : 500;
    return sendJson(response, status, { ok: false, error: error.code || 'foxpay_admin_password_failed' });
  }
}

async function getFoxPaySeasonWinners(limit) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(toNumber(limit, 20))));
  const settings = await getFoxPaySettings();
  const seasonKey = foxPaySeasonPeriodKey(settings);
  if (!pool) {
    return [...foxpayPlayers.values()]
      .map((player) => normalizeFoxPayPlayer(player, player._package || { daily_energy: player.max_energy || 300 }, settings))
      .filter((player) => foxPayPlayerSeasonEarned(player, settings) > 0)
      .sort((a, b) => {
        const seasonDiff = foxPayPlayerSeasonEarned(b, settings) - foxPayPlayerSeasonEarned(a, settings);
        return seasonDiff || toNumber(b.total_earned_usd) - toNumber(a.total_earned_usd);
      })
      .slice(0, safeLimit);
  }

  const result = await pool.query(
    `select player_id, username, token_balance, total_earned_usd, active_package_id,
            season_key, season_earned_tokens,
            country_code, country_name, device_label
     from foxpay_players
     where case when season_key = $2 then season_earned_tokens else 0 end > 0
     order by case when season_key = $2 then season_earned_tokens else 0 end desc,
              total_earned_usd desc,
              created_at asc
     limit $1`,
    [safeLimit, seasonKey],
  );
  return result.rows.map((row) => ({
    ...row,
    season_earned_tokens: foxPayPlayerSeasonEarned(row, settings),
  }));
}

async function handleFoxPayAdminSeasonReward(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  try {
    const settings = await getFoxPaySettings();
    const rewardPoolTokens = Math.floor(toNumber(settings.season_reward_tokens, 0));
    const rewardMode = ['equal', 'competitive'].includes(String(settings.season_reward_mode || '').toLowerCase())
      ? String(settings.season_reward_mode).toLowerCase()
      : 'competitive';
    const limit = Math.max(1, Math.min(100, Math.floor(toNumber(settings.season_winner_limit, 20))));
    const seasonKey = foxPaySeasonPeriodKey(settings);

    if (foxPaySeasonStatus(settings) === 'none') {
      return sendJson(response, 400, { ok: false, error: 'season_not_configured' });
    }
    if (rewardPoolTokens <= 0) {
      return sendJson(response, 400, { ok: false, error: 'season_reward_not_configured' });
    }
    if (settings.season_paid_key === seasonKey) {
      return sendJson(response, 409, { ok: false, error: 'season_already_paid', paid_at: settings.season_paid_at });
    }

    const winners = await getFoxPaySeasonWinners(limit);
    if (!winners.length) {
      return sendJson(response, 400, { ok: false, error: 'season_has_no_winners' });
    }

    const paidWinners = [];
    const payouts = foxPaySeasonRewardDistribution(rewardPoolTokens, winners, rewardMode);
    for (const payout of payouts) {
      const { winner } = payout;
      const index = payout.position - 1;
      const player = await ensureFoxPayPlayer(winner.player_id);
      const pack = await getFoxPayPackage(player.active_package_id || 'free');
      player._package = pack;
      const creditedTokens = Math.max(0, Math.floor(payout.reward_tokens));
      player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance))) + creditedTokens;
      await saveFoxPayPlayer(player);
      const now = new Date().toISOString();
      await saveFoxPayPayment({
        id: `season_${md5(`${seasonKey}:${winner.player_id}`).slice(0, 24)}`,
        player_id: winner.player_id,
        item_type: 'season_reward',
        item_id: settings.season_name || 'season',
        amount_usdt: creditedTokens * toNumber(settings.token_price_usd, 0.0001),
        network: 'fox',
        pay_currency: 'FOX',
        nowpayments_payment_id: '',
        order_id: `season_${md5(`${seasonKey}:${winner.player_id}`).slice(0, 24)}`,
        status: creditedTokens > 0 ? 'confirmed' : 'capped',
        pay_amount: creditedTokens,
        pay_address: 'season_reward',
        payment_url: '',
        expires_at: now,
        activated_at: now,
        created_at: now,
        updated_at: now,
        raw_payload: {
          source: 'season_reward',
          season_key: seasonKey,
          season_name: settings.season_name || '',
          position: index + 1,
          reward_tokens: creditedTokens,
          reward_pool_tokens: rewardPoolTokens,
          reward_mode: rewardMode,
          credited_tokens: creditedTokens,
          lost_tokens: 0,
        },
      });
      paidWinners.push({
        position: index + 1,
        player_id: winner.player_id,
        username: winner.username || 'Fox player',
        reward_tokens: creditedTokens,
        reward_pool_tokens: rewardPoolTokens,
        reward_mode: rewardMode,
        credited_tokens: creditedTokens,
        lost_tokens: 0,
        season_earned_tokens: foxPayPlayerSeasonEarned(winner, settings),
        country_code: winner.country_code || '',
        country_name: winner.country_name || '',
        paid_at: now,
      });
    }
    const nextSettings = await saveFoxPaySettingsRaw({
      ...settings,
      season_paid_at: new Date().toISOString(),
      season_paid_key: seasonKey,
      season_paid_winners: paidWinners,
    });

    return sendJson(response, 200, { ok: true, settings: nextSettings, winners: paidWinners });
  } catch (error) {
    console.error('FoxPay season reward failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_season_reward_failed' });
  }
}

function normalizePackageIcon(value, fallback = '') {
  const icon = String(value || '').trim();
  if (!icon) return fallback || '';
  if (icon === '__remove__') return '';
  if (icon.startsWith('/images/') || icon.startsWith('./images/')) return icon.slice(0, 240);
  if (!icon.startsWith('data:image/webp;base64,')) return fallback || '';
  return icon.length <= 450000 ? icon : fallback || '';
}

function normalizeAvatarImage(value, fallback = '') {
  const image = String(value || '').trim();
  if (!image) return fallback || '';
  if (image === '__remove__') return fallback || '';
  if (image.startsWith('./images/') || image.startsWith('/images/')) return image.slice(0, 240);
  if (!image.startsWith('data:image/webp;base64,')) return fallback || '';
  return image.length <= 450000 ? image : fallback || '';
}

function normalizeRankImage(value, fallback = '') {
  const image = String(value || '').trim();
  if (!image) return fallback || '';
  if (image === '__remove__') return '';
  if (image.startsWith('./images/') || image.startsWith('/images/')) return image.slice(0, 240);
  if (!image.startsWith('data:image/webp;base64,')) return fallback || '';
  return image.length <= 450000 ? image : fallback || '';
}

async function revokeUnpaidFoxPayAvatarOwnership(avatarId) {
  if (!avatarId) return;
  if (!pool) {
    for (const [playerId, player] of foxpayPlayers.entries()) {
      const hasPaid = [...foxpayPayments.values()].some((payment) => (
        payment.player_id === playerId
        && payment.item_type === 'avatar'
        && payment.item_id === avatarId
        && paymentIsPaid(payment.status)
      ));
      if (hasPaid) continue;
      const owned = Array.isArray(player.owned_avatars) ? player.owned_avatars.filter((id) => id !== avatarId) : [];
      foxpayPlayers.set(playerId, {
        ...player,
        owned_avatars: owned,
        selected_avatar_id: player.selected_avatar_id === avatarId ? 'fox-default' : player.selected_avatar_id,
      });
    }
    return;
  }
  await pool.query(
    `update foxpay_players player
     set owned_avatars = coalesce(player.owned_avatars, '[]'::jsonb) - $1,
         selected_avatar_id = case when player.selected_avatar_id = $1 then 'fox-default' else player.selected_avatar_id end,
         updated_at = now()
     where not exists (
       select 1
       from foxpay_payments payment
       where payment.player_id = player.player_id
         and payment.item_type = 'avatar'
         and payment.item_id = $1
         and payment.status in ('confirmed', 'finished')
     )`,
    [avatarId],
  );
}

async function handleFoxPayAdminAvatar(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  const id = (params.get('id') || '').trim();
  if (!id) return sendJson(response, 400, { ok: false, error: 'missing_avatar_id' });
  const current = await getFoxPayAvatar(id);
  const next = {
    id,
    name: params.get('name') || current?.name || id,
    image_url: normalizeAvatarImage(params.get('image_url'), current?.image_url || './images/fox.png'),
    price_tokens: Math.max(0, toNumber(params.get('price_tokens'), current?.price_tokens || 0)),
    price_usdt: Math.max(0, toNumber(params.get('price_usdt'), current?.price_usdt || 0)),
    is_free: params.get('is_free') === null ? (!current ? true : Boolean(current.is_free)) : settingEnabled(params.get('is_free')),
    active: params.get('active') === '' ? current?.active !== false : params.get('active') !== 'false',
    sort_order: Math.floor(toNumber(params.get('sort_order'), current?.sort_order || 0)),
  };

  try {
    if (!pool) {
      foxpayAvatarsMemory.set(id, next);
    } else {
      await pool.query(
        `insert into foxpay_avatars (id, name, image_url, price_tokens, price_usdt, is_free, active, sort_order, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, now())
         on conflict (id) do update set
           name = excluded.name,
           image_url = excluded.image_url,
           price_tokens = excluded.price_tokens,
           price_usdt = excluded.price_usdt,
           is_free = excluded.is_free,
           active = excluded.active,
           sort_order = excluded.sort_order,
           updated_at = now()`,
        [next.id, next.name, next.image_url, next.price_tokens, next.price_usdt, next.is_free, next.active, next.sort_order],
      );
    }
    if (!next.is_free) {
      await revokeUnpaidFoxPayAvatarOwnership(id);
    }
    return sendJson(response, 200, { ok: true, avatar: next, avatars: await getFoxPayAvatars(true) });
  } catch (error) {
    console.error('FoxPay avatar edit failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_avatar_failed' });
  }
}

async function handleFoxPayAvatarSelect(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const avatarId = params.get('avatar_id') || '';
  if (!playerId || !avatarId) return sendJson(response, 400, { ok: false, error: 'invalid_avatar_select' });

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const avatar = await getFoxPayAvatar(avatarId);
    if (!avatar || !avatar.active) return sendJson(response, 404, { ok: false, error: 'avatar_not_found' });
    const owned = new Set(Array.isArray(player.owned_avatars) ? player.owned_avatars : []);
    if (!avatar.is_free && !owned.has(avatar.id)) {
      return sendJson(response, 402, {
        ok: false,
        error: 'usdt_payment_required',
        message: 'Este avatar es premium. Compralo con FOX o USDT antes de activarlo.',
      });
    }
    if (avatar.is_free) owned.add(avatar.id);
    player.owned_avatars = [...owned];
    player.selected_avatar_id = avatar.id;
    await saveFoxPayPlayer(player);
    return sendJson(response, 200, { ok: true, dashboard: await buildFoxPayDashboard(playerId) });
  } catch (error) {
    console.error('FoxPay avatar select failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_avatar_select_failed' });
  }
}

async function handleFoxPayAvatarPayment(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const avatarId = params.get('avatar_id') || '';
  const network = normalizePaymentNetwork(params.get('network') || 'bep20');
  if (!playerId || !avatarId) return sendJson(response, 400, { ok: false, error: 'invalid_avatar_payment' });

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const avatar = await getFoxPayAvatar(avatarId);
    if (!avatar || !avatar.active) return sendJson(response, 404, { ok: false, error: 'avatar_not_found' });
    if (playerOwnsAvatar(player, avatar)) {
      player.selected_avatar_id = avatar.id;
      await saveFoxPayPlayer(player);
      return sendJson(response, 200, { ok: true, dashboard: await buildFoxPayDashboard(playerId) });
    }
    if (avatar.is_free || toNumber(avatar.price_usdt) <= 0) {
      return sendJson(response, 400, { ok: false, error: 'avatar_usdt_not_required' });
    }
    if (toNumber(avatar.price_usdt) < foxpayMinItemUsdtPayment) {
      return sendJson(response, 400, {
        ok: false,
        error: 'payment_min_usdt_required',
        min_usdt: foxpayMinItemUsdtPayment,
      });
    }
    const payment = await createFoxPayCryptoPayment({
      playerId,
      itemType: 'avatar',
      itemId: avatar.id,
      amountUsdt: avatar.price_usdt,
      network,
      description: `FoxPay avatar ${avatar.name}`,
    });
    return sendJson(response, 200, {
      ok: true,
      payment: sanitizeFoxPayPayment(payment),
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay avatar payment failed', error);
    return sendJson(response, 500, { ok: false, error: error.code || 'foxpay_avatar_payment_failed', message: error.message });
  }
}

async function handleFoxPayAvatarFoxPurchase(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const avatarId = params.get('avatar_id') || '';
  if (!playerId || !avatarId) return sendJson(response, 400, { ok: false, error: 'invalid_avatar_fox_purchase' });

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const settings = await getFoxPaySettings();
    const avatar = await getFoxPayAvatar(avatarId);
    if (!avatar || !avatar.active) return sendJson(response, 404, { ok: false, error: 'avatar_not_found' });
    if (playerOwnsAvatar(player, avatar)) {
      player.selected_avatar_id = avatar.id;
      await saveFoxPayPlayer(player);
      return sendJson(response, 200, { ok: true, dashboard: await buildFoxPayDashboard(playerId) });
    }
    if (avatar.is_free || toNumber(avatar.price_usdt) <= 0) {
      return sendJson(response, 400, { ok: false, error: 'avatar_fox_not_required' });
    }
    const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
    const priceTokens = Math.max(1, Math.ceil(toNumber(avatar.price_usdt) / tokenPrice));
    if (toNumber(player.token_balance) < priceTokens) {
      return sendJson(response, 403, {
        ok: false,
        error: 'insufficient_tokens',
        required_tokens: priceTokens,
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }
    player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance) - priceTokens));
    const owned = new Set(Array.isArray(player.owned_avatars) ? player.owned_avatars : ['fox-default']);
    owned.add(avatar.id);
    player.owned_avatars = [...owned];
    player.selected_avatar_id = avatar.id;
    await saveFoxPayPlayer(player);
    const now = new Date().toISOString();
    const payment = {
      id: foxpayPaymentId(),
      player_id: playerId,
      item_type: 'avatar',
      item_id: avatar.id,
      amount_usdt: toNumber(avatar.price_usdt),
      network: 'fox',
      pay_currency: 'FOX',
      nowpayments_payment_id: '',
      order_id: `fox_avatar_${avatar.id}_${playerId}_${Date.now()}`.slice(0, 120),
      status: 'confirmed',
      pay_amount: toNumber(avatar.price_usdt),
      pay_address: 'fox_wallet',
      payment_url: '',
      expires_at: now,
      activated_at: now,
      created_at: now,
      updated_at: now,
      raw_payload: {
        source: 'fox_wallet',
        fox_tokens_paid: priceTokens,
        fox_usdt_paid: priceTokens * tokenPrice,
      },
    };
    await saveFoxPayPayment(payment);
    return sendJson(response, 200, {
      ok: true,
      spent_tokens: priceTokens,
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay avatar FOX purchase failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_avatar_fox_purchase_failed' });
  }
}

async function handleFoxPaySkinPayment(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const skinId = params.get('skin_id') || '';
  const network = normalizePaymentNetwork(params.get('network') || 'bep20');
  if (!playerId || !skinId) return sendJson(response, 400, { ok: false, error: 'invalid_skin_payment' });

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const skin = await getFoxPaySkin(skinId);
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    if (!skin || !skin.active) return sendJson(response, 404, { ok: false, error: 'skin_not_found' });
    if (!skinDirectBuyAllowedForPackage(skin, pack.id)) {
      return sendJson(response, 403, { ok: false, error: 'skin_purchase_pack_required', dashboard: await buildFoxPayDashboard(playerId) });
    }
    if (playerOwnsSkin(player, skin)) {
      const owned = new Set(Array.isArray(player.owned_skins) ? player.owned_skins : []);
      owned.add(skin.id);
      player.owned_skins = [...owned];
      await saveFoxPayPlayer(player);
      return sendJson(response, 200, { ok: true, dashboard: await buildFoxPayDashboard(playerId) });
    }
    if (toNumber(skin.price_usdt) <= 0) return sendJson(response, 400, { ok: false, error: 'skin_usdt_not_required' });
    if (toNumber(skin.price_usdt) < foxpayMinItemUsdtPayment) {
      return sendJson(response, 400, {
        ok: false,
        error: 'payment_min_usdt_required',
        min_usdt: foxpayMinItemUsdtPayment,
      });
    }
    const payment = await createFoxPayCryptoPayment({
      playerId,
      itemType: 'skin',
      itemId: skin.id,
      amountUsdt: skin.price_usdt,
      network,
      description: `FoxPay skin ${skin.name}`,
    });
    return sendJson(response, 200, {
      ok: true,
      payment: sanitizeFoxPayPayment(payment),
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay skin payment failed', error);
    return sendJson(response, 500, { ok: false, error: error.code || 'foxpay_skin_payment_failed', message: error.message });
  }
}

async function handleFoxPaySkinFoxPurchase(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const skinId = params.get('skin_id') || '';
  if (!playerId || !skinId) return sendJson(response, 400, { ok: false, error: 'invalid_skin_fox_purchase' });

  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const settings = await getFoxPaySettings();
    const skin = await getFoxPaySkin(skinId);
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    if (!skin || !skin.active) return sendJson(response, 404, { ok: false, error: 'skin_not_found' });
    if (!skinDirectBuyAllowedForPackage(skin, pack.id)) {
      console.info('FoxPay skin FOX purchase blocked', {
        reason: 'skin_purchase_pack_required',
        player_id: playerId,
        skin_id: skin.id,
        active_package_id: pack.id,
      });
      return sendJson(response, 403, { ok: false, error: 'skin_purchase_pack_required', dashboard: await buildFoxPayDashboard(playerId) });
    }
    if (playerOwnsSkin(player, skin)) {
      console.info('FoxPay skin FOX purchase skipped', {
        reason: 'already_owned',
        player_id: playerId,
        skin_id: skin.id,
        token_balance: Math.floor(toNumber(player.token_balance)),
        owned_skins: Array.isArray(player.owned_skins) ? player.owned_skins : [],
      });
      return sendJson(response, 200, { ok: true, already_owned: true, dashboard: await buildFoxPayDashboard(playerId) });
    }
    const tokenPrice = toNumber(settings.token_price_usd, 0.0001);
    const priceTokens = Math.max(1, Math.ceil(toNumber(skin.price_usdt) / tokenPrice));
    const beforeBalance = Math.floor(toNumber(player.token_balance));
    if (toNumber(player.token_balance) < priceTokens) {
      console.info('FoxPay skin FOX purchase blocked', {
        reason: 'insufficient_tokens',
        player_id: playerId,
        skin_id: skin.id,
        token_balance: beforeBalance,
        required_tokens: priceTokens,
      });
      return sendJson(response, 403, {
        ok: false,
        error: 'insufficient_tokens',
        required_tokens: priceTokens,
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }
    player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance) - priceTokens));
    const owned = new Set(Array.isArray(player.owned_skins) ? player.owned_skins : []);
    owned.add(skin.id);
    player.owned_skins = [...owned];
    const selected = Array.isArray(player.selected_skins) ? player.selected_skins.filter((ownedSkinId) => owned.has(ownedSkinId)) : [];
    if (selected.length < 2 && !selected.includes(skin.id)) selected.push(skin.id);
    player.selected_skins = selected.slice(0, 2);
    await saveFoxPayPlayer(player);
    const now = new Date().toISOString();
    const payment = {
      id: foxpayPaymentId(),
      player_id: playerId,
      item_type: 'skin',
      item_id: skin.id,
      amount_usdt: toNumber(skin.price_usdt),
      network: 'fox',
      pay_currency: 'FOX',
      nowpayments_payment_id: '',
      order_id: `fox_skin_${skin.id}_${playerId}_${Date.now()}`.slice(0, 120),
      status: 'confirmed',
      pay_amount: toNumber(skin.price_usdt),
      pay_address: 'fox_wallet',
      payment_url: '',
      expires_at: now,
      activated_at: now,
      created_at: now,
      updated_at: now,
      raw_payload: {
        source: 'fox_wallet',
        fox_tokens_paid: priceTokens,
        fox_usdt_paid: priceTokens * tokenPrice,
      },
    };
    await saveFoxPayPayment(payment);
    console.info('FoxPay skin FOX purchase applied', {
      player_id: playerId,
      skin_id: skin.id,
      spent_tokens: priceTokens,
      token_balance_before: beforeBalance,
      token_balance_after: Math.floor(toNumber(player.token_balance)),
      owned_skins: player.owned_skins,
      selected_skins: player.selected_skins,
      payment_id: payment.id,
    });
    return sendJson(response, 200, {
      ok: true,
      spent_tokens: priceTokens,
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay skin FOX purchase failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_skin_fox_purchase_failed' });
  }
}

async function handleFoxPayUserMatches(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  if (!playerId) return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  try {
    await ensureWorldCupMatchesSeeded();
    let matches = [];
    let bets = [];
    if (pool) {
      const mRes = await pool.query('select * from foxpay_matches order by created_at desc');
      matches = mRes.rows;
      const bRes = await pool.query('select * from foxpay_bets');
      bets = bRes.rows;
    } else {
      matches = Array.from(foxpayMatchesMemory.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      bets = Array.from(foxpayBetsMemory.values());
    }

    const now = Date.now();
    const matchesWithPool = matches.map(match => {
      const matchBets = bets.filter(b => b.match_id === match.id);
      const myBets = matchBets.filter(b => b.player_id === playerId);
      
      const poolStats = {
        team_a: matchBets.filter(b => b.bet_type === 'team_a').reduce((sum, b) => sum + Number(b.amount), 0) + Number(match.manual_pool_a || 0),
        draw: matchBets.filter(b => b.bet_type === 'draw').reduce((sum, b) => sum + Number(b.amount), 0) + Number(match.manual_pool_draw || 0),
        team_b: matchBets.filter(b => b.bet_type === 'team_b').reduce((sum, b) => sum + Number(b.amount), 0) + Number(match.manual_pool_b || 0),
      };
      poolStats.total = poolStats.team_a + poolStats.draw + poolStats.team_b;
      
      const myBetTotal = myBets.reduce((sum, b) => sum + Number(b.amount), 0);
      const myBetType = myBets.length > 0 ? myBets[0].bet_type : null;

      return {
        ...match,
        poolStats,
        myBetTotal,
        myBetType
      };
    }).filter((match) => {
      if (match.status !== 'open') return true;
      if (!match.match_date) return true;
      const matchTime = new Date(match.match_date).getTime();
      return Number.isNaN(matchTime) ? true : matchTime > now;
    });

    console.log('[MATCHES-DEBUG] player:', playerId, '| matches found:', matchesWithPool.length, '| memory size:', foxpayMatchesMemory.size);
    return sendJson(response, 200, { ok: true, matches: matchesWithPool });
  } catch (error) {
    console.error('User matches fetch failed', error);
    return sendJson(response, 500, { ok: false, error: 'user_matches_failed' });
  }
}

async function handleFoxPayUserMatchBet(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  if (!playerId) return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  try {
    const matchId = params.get('matchId');
    const betType = params.get('betType');
    const amount = params.get('amount');
    const betAmount = Math.floor(Number(amount));
    if (!matchId || !betType || betAmount <= 0) return sendJson(response, 400, { ok: false, error: 'invalid_params' });

    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendJson(response, 403, { ok: false, error: 'account_disabled' });
    }
    if (player.active_package_id === 'free') {
      return sendJson(response, 403, { ok: false, error: 'requires_premium_package' });
    }

    let match;
    if (pool) {
      const mRes = await pool.query('select * from foxpay_matches where id = $1', [matchId]);
      match = mRes.rows[0];
    } else {
      match = foxpayMatchesMemory.get(matchId);
    }

    if (!match) return sendJson(response, 404, { ok: false, error: 'match_not_found' });
    if (match.status !== 'open') return sendJson(response, 400, { ok: false, error: 'match_not_open' });

    if (Number(player.token_balance || 0) < betAmount) {
      return sendJson(response, 400, { ok: false, error: 'insufficient_fox_balance' });
    }

    // Deduct FOX
    player.token_balance = Math.max(0, Math.floor(Number(player.token_balance) - betAmount));
    await saveFoxPayPlayer(player);

    const bet = {
      id: crypto.randomUUID(),
      match_id: matchId,
      player_id: playerId,
      bet_type: betType,
      amount: betAmount,
      created_at: new Date().toISOString()
    };

    if (pool) {
      await pool.query('insert into foxpay_bets (id, match_id, player_id, bet_type, amount, created_at) values ($1, $2, $3, $4, $5, $6)',
        [bet.id, bet.match_id, bet.player_id, bet.bet_type, bet.amount, bet.created_at]);
    } else {
      foxpayBetsMemory.set(bet.id, bet);
    }

    return sendJson(response, 200, { ok: true, bet, dashboard: await buildFoxPayDashboard(playerId) });
  } catch (error) {
    console.error('User match bet failed', error);
    return sendJson(response, 500, { ok: false, error: 'user_bet_failed' });
  }
}

async function handleFoxPaySkinSelect(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const skinIds = normalizePackageIdList(params.get('skin_ids') || []);
  if (!playerId) return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    if (player.active_package_id === 'free') {
      return sendJson(response, 403, { ok: false, error: 'skins_locked_free', dashboard: await buildFoxPayDashboard(playerId) });
    }
    const skins = await getFoxPaySkins();
    const owned = new Set(Array.isArray(player.owned_skins) ? player.owned_skins : []);
    const valid = skinIds
      .map((skinId) => skins.find((skin) => skin.id === skinId && skin.active && owned.has(skin.id)))
      .filter(Boolean)
      .slice(0, 2)
      .map((skin) => skin.id);
    player.selected_skins = valid;
    await saveFoxPayPlayer(player);
    return sendJson(response, 200, { ok: true, dashboard: await buildFoxPayDashboard(playerId) });
  } catch (error) {
    console.error('FoxPay skin select failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_skin_select_failed' });
  }
}

async function handleFoxPaySkinClaim(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  if (!playerId) return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    if (player.active_package_id === 'free') {
      return sendJson(response, 403, { ok: false, error: 'skins_locked_free', dashboard: await buildFoxPayDashboard(playerId) });
    }
    const settings = await getFoxPaySettings();
    const pack = await getFoxPayPackage(player.active_package_id || 'free');
    player._package = pack;
    enforceFoxPayCap(player, settings, pack);
    const today = foxpayTodayKey(settings);
    if (player.skin_taps_daily_key === today) {
      return sendJson(response, 409, { ok: false, error: 'skin_taps_already_claimed', dashboard: await buildFoxPayDashboard(playerId) });
    }
    if (foxPayCapReached(player, pack)) {
      await saveFoxPayPlayer(player);
      return sendJson(response, 403, { ok: false, error: 'package_cap_reached', dashboard: await buildFoxPayDashboard(playerId) });
    }
    const skins = await getFoxPaySkins();
    const activeSkins = selectedPlayerSkins(player, skins);
    const requestedTokens = activeSkins.reduce((sum, skin) => sum + Math.floor(Number(skin.tap_bonus_per_day || 0)), 0);
    if (requestedTokens <= 0) {
      return sendJson(response, 400, { ok: false, error: 'no_active_skins', dashboard: await buildFoxPayDashboard(playerId) });
    }
    const credited = creditFoxPayPlayer(player, requestedTokens, settings);
    player.skin_taps_daily_key = today;
    player.daily_tasks = {
      ...(player.daily_tasks || {}),
      [foxpaySkinTapsClaimedSkinsFlag]: activeSkins.map((skin) => skin.id),
    };
    await saveFoxPayPlayer(player);
    return sendJson(response, 200, {
      ok: true,
      credited_tokens: credited,
      lost_tokens: Math.max(0, requestedTokens - credited),
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay skin claim failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_skin_claim_failed' });
  }
}

async function refreshFoxPayPayment(payment) {
  if (!payment) return payment;
  if (paymentIsPaid(payment.status) && !payment.activated_at) {
    return activateFoxPayPayment(payment);
  }
  if (!payment.nowpayments_payment_id || paymentIsPaid(payment.status) || paymentIsClosed(payment.status)) {
    const locallyExpired = await expireFoxPayPaymentIfNeeded(payment, 'payment_status_expired');
    if (locallyExpired !== payment || paymentIsClosed(locallyExpired?.status)) {
      return locallyExpired;
    }
    return payment;
  }
  try {
    const payload = await nowPaymentsRequest(`/payment/${encodeURIComponent(payment.nowpayments_payment_id)}`);
    payment = await updateFoxPayPaymentFromNow(payment, payload);
  } catch (error) {
    console.error('FoxPay payment refresh failed', error);
    return payment;
  }
  return expireFoxPayPaymentIfNeeded(payment, 'payment_status_expired', { checkProvider: false });
}

async function handleFoxPayPaymentStatus(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const id = params.get('id') || '';
  if (!playerId || !id) return sendJson(response, 400, { ok: false, error: 'missing_payment_status_params' });
  try {
    let payment = await getFoxPayPayment(id);
    if (!payment || payment.player_id !== playerId) return sendJson(response, 404, { ok: false, error: 'payment_not_found' });
    payment = await refreshFoxPayPayment(payment);
    return sendJson(response, 200, {
      ok: true,
      payment: sanitizeFoxPayPayment(payment),
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay payment status failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_payment_status_failed' });
  }
}

async function handleFoxPayPaymentCancel(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const id = params.get('id') || '';
  if (!playerId || !id) return sendJson(response, 400, { ok: false, error: 'missing_payment_cancel_params' });
  try {
    const payment = await getFoxPayPayment(id);
    if (!payment || payment.player_id !== playerId || payment.item_type !== 'package') {
      return sendJson(response, 404, { ok: false, error: 'payment_not_found' });
    }
    const purchase = await getFoxPayPurchase(payment.id);
    if (!purchase || purchase.player_id !== playerId) {
      return sendJson(response, 404, { ok: false, error: 'purchase_not_found' });
    }
    if (paymentIsPaid(payment.status) || paymentIsClosed(payment.status) || purchase.status !== 'pending') {
      return sendJson(response, 409, {
        ok: false,
        error: 'payment_not_cancelable',
        dashboard: await buildFoxPayDashboard(playerId),
      });
    }
    await refundFoxPayPackageContribution(payment, purchase);
    const raw = foxPayPaymentRaw(payment);
    payment.status = 'cancelled';
    payment.raw_payload = {
      ...raw,
      cancelled_by_user_at: new Date().toISOString(),
    };
    await saveFoxPayPayment(payment);
    if (!pool) {
      purchase.status = 'cancelled';
      purchase.reviewed_at = new Date().toISOString();
      foxpayPurchases.set(purchase.id, purchase);
    } else {
      await pool.query(
        `update foxpay_purchases set status = 'cancelled', reviewed_at = now()
         where id = $1 and player_id = $2 and status = 'pending'`,
        [purchase.id, playerId],
      );
    }
    return sendJson(response, 200, {
      ok: true,
      payment: sanitizeFoxPayPayment(payment),
      dashboard: await buildFoxPayDashboard(playerId),
    });
  } catch (error) {
    console.error('FoxPay payment cancel failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_payment_cancel_failed' });
  }
}

async function handleFoxPayNowPaymentsIpn(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const signature = request.headers['x-nowpayments-sig'] || '';
  if (!verifyNowPaymentsSignature(rawBody, signature)) {
    return sendJson(response, 401, { ok: false, error: 'invalid_nowpayments_signature' });
  }
  try {
    const payload = JSON.parse(rawBody || '{}');
    const nowId = String(payload.payment_id || payload.id || '');
    const orderId = String(payload.order_id || '');
    let payment = await getFoxPayPaymentByNowId(nowId);
    if (!payment && orderId) {
      const localId = orderId.split('_').slice(0, 3).join('_');
      payment = await getFoxPayPayment(localId);
    }
    if (!payment) {
      return sendJson(response, 404, { ok: false, error: 'payment_not_found' });
    }
    await updateFoxPayPaymentFromNow(payment, payload);
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('FoxPay NOWPayments IPN failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_nowpayments_ipn_failed' });
  }
}

async function handleFoxPayAdminPackage(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  const id = params.get('id') || '';
  if (!id) {
    return sendJson(response, 400, { ok: false, error: 'missing_package_id' });
  }
  const current = await getFoxPayPackage(id);
  if (!current) {
    return sendJson(response, 404, { ok: false, error: 'package_not_found' });
  }
  const next = {
    ...current,
    name: params.get('name') || current.name,
    price_usdt: toNumber(params.get('price_usdt'), current.price_usdt),
    max_multiplier: toNumber(params.get('price_usdt'), current.price_usdt) > 0 ? 3 : toNumber(params.get('max_multiplier'), current.max_multiplier),
    monthly_cap_usd: toNumber(params.get('monthly_cap_usd'), current.monthly_cap_usd),
    daily_energy: Math.floor(toNumber(params.get('daily_energy'), current.daily_energy)),
    tap_reward_tokens: Math.floor(toNumber(params.get('tap_reward_tokens'), current.tap_reward_tokens)),
    icon_url: normalizePackageIcon(params.get('icon_url'), current.icon_url),
    video_urls: params.get('video_urls') === null ? normalizeYoutubeUrls(current.video_urls || []) : normalizeYoutubeUrls(params.get('video_urls')),
    task_config: params.get('task_config') === null ? normalizePackageTaskConfig(current.task_config || {}) : normalizePackageTaskConfig(params.get('task_config')),
    active: params.get('active') === '' ? current.active : params.get('active') !== 'false',
    sort_order: Math.floor(toNumber(params.get('sort_order'), current.sort_order)),
  };

  try {
    if (!pool) {
      foxpayPackagesMemory.set(id, next);
    } else {
      await pool.query(
        `update foxpay_packages
         set name = $2, price_usdt = $3, max_multiplier = $4, monthly_cap_usd = $5,
             daily_energy = $6, tap_reward_tokens = $7, icon_url = $8, video_urls = $9::jsonb, task_config = $10::jsonb, active = $11, sort_order = $12, updated_at = now()
         where id = $1`,
        [id, next.name, next.price_usdt, next.max_multiplier, next.monthly_cap_usd, next.daily_energy, next.tap_reward_tokens, next.icon_url, JSON.stringify(next.video_urls), JSON.stringify(next.task_config), next.active, next.sort_order],
      );
    }
    return sendJson(response, 200, { ok: true, package: next, packages: await getFoxPayPackages(true) });
  } catch (error) {
    console.error('FoxPay package edit failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_package_failed' });
  }
}

async function handleFoxPayAdminRank(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  const id = normalizeRankId(params.get('id') || params.get('name') || '');
  if (!id) return sendJson(response, 400, { ok: false, error: 'missing_rank_id' });
  const current = (await getFoxPayRanks(true)).find((rank) => rank.id === id);
  const rank = await saveFoxPayRank({
    id,
    name: params.get('name') || current?.name || id,
    image_url: normalizeRankImage(params.get('image_url'), current?.image_url || ''),
    required_directs: params.get('required_directs') === null ? current?.required_directs || 0 : params.get('required_directs'),
    required_lifetime_usd: params.get('required_lifetime_usd') === null ? current?.required_lifetime_usd || 0 : params.get('required_lifetime_usd'),
    team_requirements: params.get('team_requirements') === null ? current?.team_requirements || {} : params.get('team_requirements'),
    active: params.get('active') === null ? current?.active !== false : params.get('active') !== 'false',
    sort_order: params.get('sort_order') === null ? current?.sort_order || 0 : params.get('sort_order'),
  });
  return sendJson(response, 200, { ok: true, rank, ranks: await getFoxPayRanks(true) });
}

async function approveFoxPayPurchase(purchaseId, approve) {
  const settings = await getFoxPaySettings();
  let purchase;
  let wasApproved = false;
  let previousStatus = '';
  if (!pool) {
    purchase = foxpayPurchases.get(purchaseId);
    if (!purchase) return null;
    previousStatus = purchase.status || '';
    wasApproved = previousStatus === 'approved';
    if (approve) {
      const player = await getFoxPayPlayerById(purchase.player_id);
      if (player && !foxPayAccountEnabled(player)) {
        return { ...purchase, account_disabled: true };
      }
    }
    purchase.status = approve ? 'approved' : 'rejected';
    purchase.reviewed_at = new Date().toISOString();
    foxpayPurchases.set(purchaseId, purchase);
  } else {
    const previous = await pool.query('select * from foxpay_purchases where id = $1 limit 1', [purchaseId]);
    if (!previous.rowCount) return null;
    purchase = previous.rows[0];
    previousStatus = previous.rows[0]?.status || '';
    wasApproved = previousStatus === 'approved';
    if (approve) {
      const player = await getFoxPayPlayerById(purchase.player_id);
      if (player && !foxPayAccountEnabled(player)) {
        return { ...purchase, account_disabled: true };
      }
    }
    const result = await pool.query(
      `update foxpay_purchases set status = $2, reviewed_at = now()
       where id = $1 returning *`,
      [purchaseId, approve ? 'approved' : 'rejected'],
    );
    purchase = result.rows[0];
  }

  if (approve && purchase && !wasApproved) {
    const pack = await getFoxPayPackage(purchase.package_id);
    const player = await ensureFoxPayPlayer(purchase.player_id);
    resetFoxPayPlayerForPackage(player, pack, settings);
    await saveFoxPayPlayer(player);
    await creditFoxPayReferralTickets(player, pack, settings);
    await creditFoxPayUnilevel(player, toNumber(purchase.amount_usdt, pack.price_usdt), settings, purchase.id, 'package');
  }
  if (!approve && purchase && previousStatus === 'pending') {
    const payment = await getFoxPayPayment(purchase.id);
    if (payment) {
      await refundFoxPayPackageContribution(payment, purchase);
      const raw = foxPayPaymentRaw(payment);
      payment.status = paymentIsClosed(payment.status) ? payment.status : 'cancelled';
      payment.raw_payload = {
        ...raw,
        admin_rejected_at: new Date().toISOString(),
        admin_rejected_purchase: true,
      };
      await saveFoxPayPayment(payment);
    }
  }
  return purchase;
}

async function handleFoxPayAdminPurchaseReview(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'finance_edit')) return;
  const params = await readRequestParams(request, url);
  const id = params.get('id') || '';
  const action = params.get('action') || '';
  if (!id || !['approve', 'reject'].includes(action)) {
    return sendJson(response, 400, { ok: false, error: 'invalid_purchase_review' });
  }
  try {
    const purchase = await approveFoxPayPurchase(id, action === 'approve');
    if (!purchase) return sendJson(response, 404, { ok: false, error: 'purchase_not_found' });
    if (purchase.account_disabled) {
      return sendJson(response, 403, { ok: false, error: 'account_disabled', purchase });
    }
    return sendJson(response, 200, { ok: true, purchase });
  } catch (error) {
    console.error('FoxPay purchase review failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_purchase_review_failed' });
  }
}

async function handleFoxPayAdminManualPurchase(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'finance_edit');
  if (!admin) return;
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const packageId = params.get('package_id') || '';
  const requestedFoxTokens = params.get('fox_tokens') || params.get('use_fox_tokens') || 0;
  const confirmation = String(params.get('confirmation') || '').trim().toUpperCase();
  if (confirmation !== 'PAGO MANUAL') {
    return sendJson(response, 400, { ok: false, error: 'manual_payment_confirmation_required' });
  }
  if (!playerId || !packageId) {
    return sendJson(response, 400, { ok: false, error: 'missing_manual_payment_params' });
  }
  try {
    const player = await ensureFoxPayPlayer(playerId);
    if (!foxPayAccountEnabled(player)) {
      return sendFoxPayAccountDisabled(response, playerId);
    }
    const pack = await getFoxPayPackage(packageId);
    const settings = await getFoxPaySettings();
    if (!pack || !pack.active) return sendJson(response, 404, { ok: false, error: 'package_not_found' });
    if (toNumber(pack.price_usdt) <= 0) return sendJson(response, 400, { ok: false, error: 'manual_payment_requires_paid_pack' });
    if (!foxPayCanUpgradePackage(player.active_package_id || 'free', pack.id)) {
      return sendJson(response, 409, {
        ok: false,
        error: 'package_not_upgrade',
        dashboard: await buildFoxPayDashboard(player.player_id),
      });
    }
    const id = foxpayPurchaseId();
    const now = new Date().toISOString();
    const contribution = foxPayPackageFoxContribution(player, pack, settings, requestedFoxTokens);
    const contributionPayload = {
      package_price_usdt: contribution.package_price_usdt,
      fox_tokens: contribution.fox_tokens,
      fox_usdt: contribution.fox_usdt,
      usdt_due: contribution.remaining_usdt,
      token_price_usd: contribution.token_price_usd,
      fox_deducted_at: contribution.fox_tokens > 0 ? now : '',
    };
    if (contribution.fox_tokens > 0) {
      player.token_balance = Math.max(0, Math.floor(toNumber(player.token_balance))) - contribution.fox_tokens;
      await saveFoxPayPlayer(player);
    }
    const payment = {
      id,
      player_id: player.player_id,
      item_type: 'package',
      item_id: pack.id,
      amount_usdt: contribution.remaining_usdt,
      network: 'manual',
      pay_currency: 'manual',
      nowpayments_payment_id: `manual_${id}`,
      order_id: `manual_${pack.id}_${player.player_id}`.slice(0, 120),
      status: 'confirmed',
      pay_amount: contribution.remaining_usdt,
      pay_address: `manual:${admin.username || 'admin'}`,
      payment_url: '',
      expires_at: now,
      activated_at: null,
      raw_payload: { source: 'admin_manual', admin: admin.username || '', created_at: now, package_payment: contributionPayload },
    };
    const purchase = {
      id,
      player_id: player.player_id,
      package_id: pack.id,
      amount_usdt: toNumber(pack.price_usdt),
      status: 'pending',
      tx_hash: payment.nowpayments_payment_id,
      created_at: now,
      reviewed_at: null,
      fox_tokens_paid: contribution.fox_tokens,
      fox_usdt_paid: contribution.fox_usdt,
      usdt_due: contribution.remaining_usdt,
    };
    await saveFoxPayPayment(payment);
    if (!pool) {
      foxpayPurchases.set(id, purchase);
    } else {
      await pool.query(
        `insert into foxpay_purchases
           (id, player_id, package_id, amount_usdt, status, tx_hash, reviewed_at, fox_tokens_paid, fox_usdt_paid, usdt_due)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, player.player_id, pack.id, purchase.amount_usdt, purchase.status, purchase.tx_hash, null, contribution.fox_tokens, contribution.fox_usdt, contribution.remaining_usdt],
      );
    }
    const activatedPayment = await activateFoxPayPayment(payment);
    return sendJson(response, 200, {
      ok: true,
      payment: sanitizeFoxPayPayment(activatedPayment),
      purchase: await approveFoxPayPurchase(id, true),
      dashboard: await buildFoxPayDashboard(player.player_id),
    });
  } catch (error) {
    console.error('FoxPay manual purchase failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_manual_purchase_failed' });
  }
}

async function handleFoxPayAdminWithdrawalReview(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'finance_edit')) return;
  const params = await readRequestParams(request, url);
  const id = params.get('id') || '';
  const action = params.get('action') || '';
  const network = normalizeWithdrawalNetwork(params.get('network'));
  const txReference = normalizeTxReference(params.get('tx_hash') || '', network);
  if (!id || !['approve', 'reject'].includes(action)) {
    return sendJson(response, 400, { ok: false, error: 'invalid_withdrawal_review' });
  }
  if (action === 'approve' && !txReference.ok) {
    return sendJson(response, 400, { ok: false, error: 'invalid_transaction_hash' });
  }
  try {
    let withdrawal;
    if (!pool) {
      withdrawal = foxpayWithdrawals.get(id);
      if (!withdrawal) return sendJson(response, 404, { ok: false, error: 'withdrawal_not_found' });
      if (withdrawal.status !== 'pending') return sendJson(response, 409, { ok: false, error: 'withdrawal_already_reviewed' });
      withdrawal.status = action === 'approve' ? 'approved' : 'rejected';
      withdrawal.reviewed_at = new Date().toISOString();
      if (action === 'approve') {
        withdrawal.network = txReference.network || network || withdrawal.network || 'bep20';
        withdrawal.tx_hash = txReference.value;
        withdrawal.tx_url = txReference.url || explorerTxUrl(withdrawal.network, txReference.value);
      }
      foxpayWithdrawals.set(id, withdrawal);
      const player = await ensureFoxPayPlayer(withdrawal.player_id);
      if (action === 'reject') {
        player.token_balance += toNumber(withdrawal.tokens);
      } else {
        player.total_withdrawn_usd += toNumber(withdrawal.usdt_amount);
      }
      await saveFoxPayPlayer(player);
    } else {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await client.query(
          `update foxpay_withdrawals
           set status = $2,
               reviewed_at = now(),
               network = case when $2 = 'approved' then coalesce(nullif($3, ''), network) else network end,
               tx_hash = case when $2 = 'approved' then $4 else tx_hash end
           where id = $1 and status = 'pending' returning *`,
          [id, action === 'approve' ? 'approved' : 'rejected', txReference.network || network || '', txReference.value || null],
        );
        withdrawal = result.rows[0];
        if (!withdrawal) {
          await client.query('rollback');
          return sendJson(response, 404, { ok: false, error: 'withdrawal_not_found_or_reviewed' });
        }
        if (action === 'reject') {
          await client.query(
            'update foxpay_players set token_balance = token_balance + $2, updated_at = now() where player_id = $1',
            [withdrawal.player_id, withdrawal.tokens],
          );
        } else {
          await client.query(
            'update foxpay_players set total_withdrawn_usd = total_withdrawn_usd + $2, updated_at = now() where player_id = $1',
            [withdrawal.player_id, withdrawal.usdt_amount],
          );
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
    if (action === 'reject') {
      const settings = await getFoxPaySettings();
      const player = await ensureFoxPayPlayer(withdrawal.player_id);
      const pack = await getFoxPayPackage(player.active_package_id || 'free');
      player._package = pack;
      const repair = enforceFoxPayCap(player, settings, pack);
      if (repair.changed) await saveFoxPayPlayer(player);
    }
    withdrawal.tx_url = explorerTxUrl(withdrawal.network, withdrawal.tx_hash);
    return sendJson(response, 200, { ok: true, withdrawal });
  } catch (error) {
    console.error('FoxPay withdrawal review failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_withdrawal_review_failed' });
  }
}

async function handleFoxPayAdminUserDelete(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'users_edit')) return;
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }

  try {
    if (!pool) {
      const existed = foxpayPlayers.delete(playerId);
      [...foxpayPurchases.entries()].forEach(([id, purchase]) => {
        if (purchase.player_id === playerId) foxpayPurchases.delete(id);
      });
      [...foxpayWithdrawals.entries()].forEach(([id, withdrawal]) => {
        if (withdrawal.player_id === playerId) foxpayWithdrawals.delete(id);
      });
      return sendJson(response, existed ? 200 : 404, {
        ok: existed,
        deleted: existed,
        player_id: playerId,
        error: existed ? undefined : 'user_not_found',
      });
    }

    await pool.query('begin');
    const existing = await pool.query('select player_id from foxpay_players where player_id = $1', [playerId]);
    if (!existing.rowCount) {
      await pool.query('rollback');
      return sendJson(response, 404, { ok: false, error: 'user_not_found' });
    }
    await pool.query('delete from foxpay_withdrawals where player_id = $1', [playerId]);
    await pool.query('delete from foxpay_purchases where player_id = $1', [playerId]);
    await pool.query('update foxpay_players set referrer_id = null where referrer_id = $1', [playerId]);
    await pool.query('delete from foxpay_players where player_id = $1', [playerId]);
    await pool.query('commit');
    return sendJson(response, 200, { ok: true, deleted: true, player_id: playerId });
  } catch (error) {
    if (pool) {
      try {
        await pool.query('rollback');
      } catch {}
    }
    console.error('FoxPay user delete failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_user_delete_failed' });
  }
}

async function handleFoxPayAdminUserAddCoins(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'users_edit')) return;
  const params = await readRequestParams(request, url);
  const playerId = params.get('playerId') || '';
  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }

  try {
    if (!pool) {
      const player = foxpayPlayers.get(playerId);
      if (!player) return sendJson(response, 404, { ok: false, error: 'user_not_found' });
      player.game_fox_balance = Number(player.game_fox_balance || 0) + 1000000;
      foxpayPlayers.set(playerId, player);
    } else {
      const result = await pool.query(
        `update foxpay_players
         set game_fox_balance = coalesce(game_fox_balance, 0) + 1000000,
             updated_at = now()
         where player_id = $1
         returning *`,
        [playerId]
      );
      if (!result.rowCount) return sendJson(response, 404, { ok: false, error: 'user_not_found' });
    }
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('FoxPay user add coins failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_user_add_coins_failed' });
  }
}

async function handleFoxPayAdminUserStatus(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'users_edit')) return;
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const status = params.get('status') === 'disabled' ? 'disabled' : 'active';
  if (!playerId) {
    return sendJson(response, 400, { ok: false, error: 'missing_player_id' });
  }

  try {
    let player;
    if (!pool) {
      player = foxpayPlayers.get(playerId);
      if (!player) return sendJson(response, 404, { ok: false, error: 'user_not_found' });
      player.account_status = status;
      if (status === 'disabled') player.account_token = '';
      foxpayPlayers.set(playerId, player);
    } else {
      const result = await pool.query(
        `update foxpay_players
         set account_status = $2,
             account_token = case when $2 = 'disabled' then null else account_token end,
             updated_at = now()
         where player_id = $1
         returning *`,
        [playerId, status],
      );
      player = result.rows[0];
      if (!player) return sendJson(response, 404, { ok: false, error: 'user_not_found' });
    }
    return sendJson(response, 200, { ok: true, player: sanitizeFoxPayPlayer(player), status });
  } catch (error) {
    console.error('FoxPay user status failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_user_status_failed' });
  }
}

async function handleFoxPayAdminRouletteReward(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  try {
    const reward = await saveFoxPayRouletteReward({
      id: params.get('id') || '',
      package_id: params.get('package_id') || 'free',
      label: params.get('label') || '',
      reward_type: params.get('reward_type') || 'none',
      amount: params.get('amount') || 0,
      item_id: params.get('item_id') || '',
      weight: params.get('weight') || 1,
      active: params.get('active') === null ? true : params.get('active'),
      sort_order: params.get('sort_order') || 0,
    });
    return sendJson(response, 200, { ok: true, reward, roulette_rewards: await getFoxPayRouletteRewards('', true) });
  } catch (error) {
    console.error('FoxPay roulette reward save failed', error);
    return sendJson(response, 500, { ok: false, error: error.code || 'foxpay_roulette_reward_failed' });
  }
}

async function handleFoxPayAdminRouletteSetting(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  try {
    const setting = await saveFoxPayRouletteSetting(params.get('package_id') || 'free', params.get('ticket_cost') || 1);
    return sendJson(response, 200, { ok: true, setting, roulette_settings: await getFoxPayRouletteSettings() });
  } catch (error) {
    console.error('FoxPay roulette setting save failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_roulette_setting_failed' });
  }
}

async function handleFoxPayAdminSkin(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  try {
    const skin = await saveFoxPaySkin({
      id: params.get('id') || '',
      name: params.get('name') || '',
      image_url: params.get('image_url') || '',
      price_usdt: params.get('price_usdt') || 0,
      tap_bonus_per_day: params.get('tap_bonus_per_day') || 0,
      roulette_package_ids: params.get('roulette_package_ids') || [],
      active: params.get('active') === null ? true : params.get('active'),
      sort_order: params.get('sort_order') || 0,
    });
    return sendJson(response, 200, { ok: true, skin, skins: await getFoxPaySkins(true) });
  } catch (error) {
    console.error('FoxPay skin save failed', error);
    return sendJson(response, 500, { ok: false, error: error.code || 'foxpay_skin_failed' });
  }
}

async function handleFoxPayAdminSkinRemove(request, response, url) {
  if (!requireFoxPayAdmin(request, response, 'content_edit')) return;
  const params = await readRequestParams(request, url);
  try {
    const result = await deactivateAndRemoveFoxPaySkin(params.get('id') || '');
    return sendJson(response, 200, {
      ok: true,
      ...result,
      skins: await getFoxPaySkins(true),
      roulette_rewards: await getFoxPayRouletteRewards('', true),
    });
  } catch (error) {
    console.error('FoxPay skin remove failed', error);
    const status = error.code === 'skin_not_found' ? 404 : 500;
    return sendJson(response, status, { ok: false, error: error.code || 'foxpay_skin_remove_failed' });
  }
}

async function handleFoxPayAdminMatchAddPool(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'content_edit');
  if (!admin) return;
  try {
    const params = await readRequestParams(request, url);
    const id = params.get('id');
    const team = params.get('team');
    const amount = Number(params.get('amount') || 0);
    if (!id || !team || amount < 0) return sendJson(response, 400, { ok: false, error: 'invalid_params' });
    
    if (pool) {
      let query = '';
      if (team === 'team_a') query = 'update foxpay_matches set manual_pool_a = manual_pool_a + $1 where id = $2';
      else if (team === 'team_b') query = 'update foxpay_matches set manual_pool_b = manual_pool_b + $1 where id = $2';
      else if (team === 'draw') query = 'update foxpay_matches set manual_pool_draw = manual_pool_draw + $1 where id = $2';
      else return sendJson(response, 400, { ok: false, error: 'invalid_team' });
      
      await pool.query(query, [amount, id]);
    } else {
      const match = foxpayMatchesMemory.get(id);
      if (!match) return sendJson(response, 404, { ok: false, error: 'match_not_found' });
      if (team === 'team_a') match.manual_pool_a = (Number(match.manual_pool_a) || 0) + amount;
      else if (team === 'team_b') match.manual_pool_b = (Number(match.manual_pool_b) || 0) + amount;
      else if (team === 'draw') match.manual_pool_draw = (Number(match.manual_pool_draw) || 0) + amount;
      else return sendJson(response, 400, { ok: false, error: 'invalid_team' });
      
      foxpayMatchesMemory.set(id, match);
    }
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('Match manual pool addition failed', error);
    return sendJson(response, 500, { ok: false, error: 'match_add_pool_failed' });
  }
}

async function handleFoxPayAdminMatchCreate(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'content_edit');
  if (!admin) return;
  try {
    const params = await readRequestParams(request, url);
    const teamA = params.get('teamA');
    const teamB = params.get('teamB');
    const flagA = params.get('flagA');
    const flagB = params.get('flagB');
    const venue = params.get('venue');
    const matchDate = params.get('matchDate');
    if (!teamA || !teamB) return sendJson(response, 400, { ok: false, error: 'missing_teams' });
    const id = crypto.randomUUID();
    const match = { 
      id, 
      team_a: teamA, 
      team_b: teamB, 
      flag_a: flagA || '', 
      flag_b: flagB || '', 
      venue: venue || '', 
      match_date: matchDate || null, 
      status: 'open', 
      result: null, 
      created_at: new Date().toISOString(),
      manual_pool_a: 0,
      manual_pool_b: 0,
      manual_pool_draw: 0
    };
    if (pool) {
      await pool.query('insert into foxpay_matches (id, team_a, team_b, flag_a, flag_b, venue, match_date, status, created_at, manual_pool_a, manual_pool_b, manual_pool_draw) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [match.id, match.team_a, match.team_b, match.flag_a, match.flag_b, match.venue, match.match_date, match.status, match.created_at, match.manual_pool_a, match.manual_pool_b, match.manual_pool_draw]);
    } else {
      foxpayMatchesMemory.set(match.id, match);
    }
    return sendJson(response, 200, { ok: true, match });
  } catch (error) {
    console.error('Match create failed', error);
    return sendJson(response, 500, { ok: false, error: 'match_create_failed' });
  }
}

async function handleFoxPayAdminMatchUpdateOdds(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'content_edit');
  if (!admin) return;
  try {
    const params = await readRequestParams(request, url);
    const id = params.get('id');
    const type = params.get('type'); // 'team_a', 'draw', 'team_b'
    const value = Number(params.get('value') || 0);
    if (!id || !type || value < 1.0) {
      return sendJson(response, 400, { ok: false, error: 'invalid_params' });
    }

    let field = '';
    if (type === 'team_a') field = 'odds_team_a';
    else if (type === 'draw') field = 'odds_draw';
    else if (type === 'team_b') field = 'odds_team_b';
    else return sendJson(response, 400, { ok: false, error: 'invalid_type' });

    if (pool) {
      await pool.query(`update foxpay_matches set ${field} = $1 where id = $2`, [value, id]);
    } else {
      const match = foxpayMatchesMemory.get(id);
      if (!match) return sendJson(response, 404, { ok: false, error: 'match_not_found' });
      match[field] = value;
      foxpayMatchesMemory.set(id, match);
    }
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('Match odds update failed', error);
    return sendJson(response, 500, { ok: false, error: 'match_update_odds_failed' });
  }
}

async function handleFoxPayAdminMatchClose(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'content_edit');
  if (!admin) return;
  try {
    const params = await readRequestParams(request, url);
    const id = params.get('id');
    if (!id) return sendJson(response, 400, { ok: false, error: 'missing_id' });
    if (pool) {
      await pool.query('update foxpay_matches set status = $1 where id = $2', ['closed', id]);
    } else {
      const match = foxpayMatchesMemory.get(id);
      if (match) { match.status = 'closed'; foxpayMatchesMemory.set(id, match); }
    }
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('Match close failed', error);
    return sendJson(response, 500, { ok: false, error: 'match_close_failed' });
  }
}

async function handleFoxPayAdminMatchResolve(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'content_edit');
  if (!admin) return;
  try {
    const params = await readRequestParams(request, url);
    const id = params.get('id');
    const result = params.get('result'); // result can be 'team_a', 'team_b', 'draw'
    if (!id || !result) return sendJson(response, 400, { ok: false, error: 'missing_params' });
    
    let match;
    let bets = [];
    if (pool) {
      const mRes = await pool.query('select * from foxpay_matches where id = $1', [id]);
      match = mRes.rows[0];
      const bRes = await pool.query('select * from foxpay_bets where match_id = $1', [id]);
      bets = bRes.rows;
    } else {
      match = foxpayMatchesMemory.get(id);
      bets = Array.from(foxpayBetsMemory.values()).filter(b => b.match_id === id);
    }
    if (!match || match.status === 'resolved') return sendJson(response, 400, { ok: false, error: 'invalid_match' });

    const odds = {
      team_a: Math.max(1, Number(match.odds_team_a || 1.10)),
      draw: Math.max(1, Number(match.odds_draw || 3.00)),
      team_b: Math.max(1, Number(match.odds_team_b || 2.00)),
    };
    const winningBets = bets.filter((bet) => bet.bet_type === result);

    for (const bet of winningBets) {
      const payout = Math.floor(Number(bet.amount) * odds[result]);
      if (payout <= 0) continue;
      if (pool) {
        await pool.query('update foxpay_players set token_balance = token_balance + $1 where player_id = $2', [payout, bet.player_id]);
      } else {
        const player = foxpayPlayers.get(bet.player_id);
        if (player) {
          player.token_balance = (Number(player.token_balance) || 0) + payout;
          foxpayPlayers.set(bet.player_id, player);
        }
      }
    }

    if (pool) {
      await pool.query('update foxpay_matches set status = $1, result = $2 where id = $3', ['resolved', result, id]);
    } else {
      match.status = 'resolved';
      match.result = result;
      foxpayMatchesMemory.set(id, match);
    }
    return sendJson(response, 200, { ok: true, winnersCount: winningBets.length, odds });
  } catch (error) {
    console.error('Match resolve failed', error);
    return sendJson(response, 500, { ok: false, error: 'match_resolve_failed' });
  }
}

async function handleFoxPayAdminMaintenanceReset(request, response, url) {
  const admin = requireFoxPayAdmin(request, response, 'maintenance_edit');
  if (!admin) return;
  if (admin.role !== 'super_admin') {
    return sendJson(response, 403, { ok: false, error: 'forbidden_super_admin_required' });
  }
  const params = await readRequestParams(request, url);
  const confirmation = String(params.get('confirmation') || '').trim();
  if (confirmation !== foxpayMaintenanceConfirmText) {
    return sendJson(response, 400, { ok: false, error: 'invalid_confirmation' });
  }

  const deleted = {
    roulette_spins: 0,
    commissions: 0,
    withdrawals: 0,
    purchases: 0,
    payments: 0,
    players: 0,
  };

  try {
    const maintenanceReset = createFoxPayMaintenanceResetState(admin);
    if (!pool) {
      deleted.roulette_spins = foxpayRouletteSpinsMemory.size;
      deleted.commissions = foxpayCommissions?.size || 0;
      deleted.withdrawals = foxpayWithdrawals.size;
      deleted.purchases = foxpayPurchases.size;
      deleted.payments = foxpayPayments.size;
      deleted.players = foxpayPlayers.size;
      foxpayRouletteSpinsMemory.clear();
      if (typeof foxpayCommissions?.clear === 'function') foxpayCommissions.clear();
      foxpayWithdrawals.clear();
      foxpayPurchases.clear();
      foxpayPayments.clear();
      foxpayPlayers.clear();
      foxpaySettingsMemory.set('maintenance_reset', maintenanceReset);
      return sendJson(response, 200, { ok: true, deleted, persistence: 'memory', maintenance_reset: maintenanceReset });
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      deleted.roulette_spins = (await client.query('delete from foxpay_roulette_spins')).rowCount;
      deleted.commissions = (await client.query('delete from foxpay_commissions')).rowCount;
      deleted.withdrawals = (await client.query('delete from foxpay_withdrawals')).rowCount;
      deleted.purchases = (await client.query('delete from foxpay_purchases')).rowCount;
      deleted.payments = (await client.query('delete from foxpay_payments')).rowCount;
      deleted.players = (await client.query('delete from foxpay_players')).rowCount;
      await client.query(
        `insert into foxpay_settings (key, value, updated_at)
         values ('maintenance_reset', $1::jsonb, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [JSON.stringify(maintenanceReset)],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return sendJson(response, 200, { ok: true, deleted, persistence: 'postgres', maintenance_reset: maintenanceReset });
  } catch (error) {
    console.error('FoxPay maintenance reset failed', error);
    return sendJson(response, 500, { ok: false, error: 'foxpay_maintenance_reset_failed' });
  }
}

const referralTiers = [
  { tier: 1, required: 1, reward: 500 },
  { tier: 3, required: 3, reward: 1800 },
  { tier: 10, required: 10, reward: 7500 },
];

const rankRules = [
  { name: 'Rookie', minLevel: 1, minRegistered: 0, minActive: 0 },
  { name: 'Hustler', minLevel: 3, minRegistered: 1, minActive: 1 },
  { name: 'Manager', minLevel: 6, minRegistered: 3, minActive: 2 },
  { name: 'Tycoon', minLevel: 10, minRegistered: 7, minActive: 3 },
  { name: 'Boss', minLevel: 15, minRegistered: 15, minActive: 5 },
  { name: 'Mogul', minLevel: 25, minRegistered: 30, minActive: 10 },
];

function levelFromXp(xp) {
  return Math.floor(Math.sqrt(Number(xp || 0) / 120)) + 1;
}

function rankFromState(state, invitedCount = 0, activeCount = 0) {
  const level = levelFromXp(state?.xp);
  const rank = rankRules.reduce((best, item) => (
    level >= item.minLevel && invitedCount >= item.minRegistered && activeCount >= item.minActive
      ? item.name
      : best
  ), rankRules[0].name);

  return {
    level,
    rank,
  };
}

function normalizeClaimedTiers(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function getFriendProgress(playerId) {
  await ensurePlayer(playerId);

  if (pool) {
    await pool.query(
      `insert into player_referrals (player_id, invited_count, claimed_tiers)
       values ($1, 0, '[]'::jsonb)
       on conflict (player_id) do nothing`,
      [playerId],
    );

    const result = await pool.query(
      `select invited_count, claimed_tiers
       from player_referrals
       where player_id = $1`,
      [playerId],
    );

    return {
      invited_count: Number(result.rows[0]?.invited_count || 0),
      claimed_tiers: normalizeClaimedTiers(result.rows[0]?.claimed_tiers),
    };
  }

  if (!friendProgress.has(playerId)) {
    friendProgress.set(playerId, {
      invited_count: 0,
      claimed_tiers: [],
    });
  }

  return friendProgress.get(playerId);
}

async function getReferralList(playerId) {
  if (pool) {
    const result = await pool.query(
      `select
         links.invited_player_id,
         links.invited_name,
         links.invited_username,
         links.created_at,
         coalesce(states.state, '{}'::jsonb) as state,
         coalesce(refs.invited_count, 0) as invited_count,
         coalesce(jsonb_array_length(refs.claimed_tiers), 0) as active_count
       from player_referral_links links
       left join player_game_states states on states.player_id = links.invited_player_id
       left join player_referrals refs on refs.player_id = links.invited_player_id
       where links.referrer_player_id = $1
       order by links.created_at desc`,
      [playerId],
    );

    return result.rows.map((row) => {
      const levelRank = rankFromState(row.state, Number(row.invited_count || 0), Number(row.active_count || 0));
      const username = row.invited_username ? `@${row.invited_username}` : '';
      return {
        player_id: row.invited_player_id,
        name: row.invited_name || username || 'Neraverse player',
        username,
        joined_at: row.created_at,
        status: levelRank.level > 1 || Number(row.invited_count || 0) > 0 ? 'Active' : 'Registered',
        ...levelRank,
      };
    });
  }

  return [...friendProgress.entries()]
    .filter(([key, value]) => key.endsWith(':referrer') && value === playerId)
    .map(([key], index) => {
      const invitedPlayerId = key.replace(':referrer', '');
      return {
        player_id: invitedPlayerId,
        name: `Referral ${index + 1}`,
        username: '',
        joined_at: null,
        status: 'Registered',
        level: 1,
        rank: 'Rookie',
      };
    });
}

async function buildFriendStatusPayload(playerId, progress, balance) {
  const claimedTiers = new Set(progress.claimed_tiers.map(String));
  const referrals = await getReferralList(playerId);

  return {
    ok: true,
    player_id: playerId,
    invited_count: progress.invited_count,
    claimed_tiers: Array.from(claimedTiers),
    referrals,
    balance,
    tasks: referralTiers.map((task) => ({
      ...task,
      claimed: claimedTiers.has(String(task.tier)),
      ready: progress.invited_count >= task.required && !claimedTiers.has(String(task.tier)),
    })),
    persistence: pool ? 'postgres' : 'memory',
  };
}

async function incrementFriendInvite(playerId) {
  await getFriendProgress(playerId);

  if (pool) {
    const result = await pool.query(
      `update player_referrals
       set invited_count = invited_count + 1, updated_at = now()
       where player_id = $1
       returning invited_count, claimed_tiers`,
      [playerId],
    );

    return {
      invited_count: Number(result.rows[0]?.invited_count || 0),
      claimed_tiers: normalizeClaimedTiers(result.rows[0]?.claimed_tiers),
    };
  }

  const current = friendProgress.get(playerId);
  const next = {
    invited_count: current.invited_count + 1,
    claimed_tiers: current.claimed_tiers,
  };
  friendProgress.set(playerId, next);
  return next;
}

async function registerReferral(referrerPlayerId, invitedPlayerId, invitedUser = {}) {
  if (!referrerPlayerId || !invitedPlayerId || referrerPlayerId === invitedPlayerId) {
    return {
      registered: false,
      reason: 'invalid_referral',
    };
  }

  await ensurePlayer(referrerPlayerId);
  await ensurePlayer(invitedPlayerId);
  await getFriendProgress(referrerPlayerId);

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const inserted = await client.query(
        `insert into player_referral_links (invited_player_id, referrer_player_id, invited_name, invited_username)
         values ($1, $2, $3, $4)
         on conflict (invited_player_id) do nothing
         returning invited_player_id`,
        [
          invitedPlayerId,
          referrerPlayerId,
          [invitedUser.first_name, invitedUser.last_name].filter(Boolean).join(' ') || null,
          invitedUser.username || null,
        ],
      );

      if (!inserted.rowCount) {
        await client.query('rollback');
        return {
          registered: false,
          reason: 'already_registered',
        };
      }

      const progress = await client.query(
        `update player_referrals
         set invited_count = invited_count + 1, updated_at = now()
         where player_id = $1
         returning invited_count, claimed_tiers`,
        [referrerPlayerId],
      );
      await client.query('commit');

      return {
        registered: true,
        progress: {
          invited_count: Number(progress.rows[0]?.invited_count || 0),
          claimed_tiers: normalizeClaimedTiers(progress.rows[0]?.claimed_tiers),
        },
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const relationKey = `${invitedPlayerId}:referrer`;
  if (friendProgress.has(relationKey)) {
    return {
      registered: false,
      reason: 'already_registered',
    };
  }

  friendProgress.set(relationKey, referrerPlayerId);
  return {
    registered: true,
    progress: await incrementFriendInvite(referrerPlayerId),
  };
}

async function claimFriendReward(playerId, tier) {
  const task = referralTiers.find((item) => item.tier === tier);
  if (!task) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_tier',
    };
  }

  const progress = await getFriendProgress(playerId);
  const claimedTiers = new Set(progress.claimed_tiers.map(String));

  if (progress.invited_count < task.required) {
    return {
      ok: false,
      status: 409,
      error: 'not_enough_invites',
      required: task.required,
      invited_count: progress.invited_count,
    };
  }

  if (claimedTiers.has(String(task.tier))) {
    return {
      ok: false,
      status: 409,
      error: 'already_claimed',
      invited_count: progress.invited_count,
    };
  }

  claimedTiers.add(String(task.tier));

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update player_referrals
         set claimed_tiers = $2::jsonb, updated_at = now()
         where player_id = $1`,
        [playerId, JSON.stringify(Array.from(claimedTiers))],
      );
      await client.query(
        `update player_balances
         set balance = balance + $2, updated_at = now()
         where player_id = $1`,
        [playerId, task.reward],
      );
      const balance = await client.query(
        'select balance from player_balances where player_id = $1',
        [playerId],
      );
      await client.query('commit');

      return {
        ok: true,
        reward: task.reward,
        balance: Number(balance.rows[0]?.balance || 0),
        progress: {
          invited_count: progress.invited_count,
          claimed_tiers: Array.from(claimedTiers),
        },
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const balance = await addPlayerBalance(playerId, task.reward);
  const next = {
    invited_count: progress.invited_count,
    claimed_tiers: Array.from(claimedTiers),
  };
  friendProgress.set(playerId, next);

  return {
    ok: true,
    reward: task.reward,
    balance,
    progress: next,
  };
}

async function creditPlayer(playerId, amount, transactionId, url) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into player_balances (player_id, balance)
         values ($1, 0)
         on conflict (player_id) do nothing`,
        [playerId],
      );

      const existing = await client.query(
        'select transaction_id from partner_transactions where transaction_id = $1',
        [transactionId],
      );

      if (existing.rowCount) {
        const balance = await client.query(
          'select balance from player_balances where player_id = $1',
          [playerId],
        );
        await client.query('commit');
        return {
          balance: Number(balance.rows[0]?.balance || 0),
          duplicate: true,
        };
      }

      await client.query(
        `insert into partner_transactions (
          transaction_id,
          player_id,
          amount,
          offer_id,
          offer_name,
          payout,
          country,
          platform,
          raw_payload
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          transactionId,
          playerId,
          amount,
          url.searchParams.get('offer_id'),
          url.searchParams.get('offer_name'),
          url.searchParams.get('payout'),
          url.searchParams.get('country'),
          url.searchParams.get('platform'),
          JSON.stringify(Object.fromEntries(url.searchParams.entries())),
        ],
      );

      const updated = await client.query(
        `update player_balances
         set balance = balance + $2, updated_at = now()
         where player_id = $1
         returning balance`,
        [playerId, amount],
      );

      await client.query('commit');
      return {
        balance: Number(updated.rows[0]?.balance || 0),
        duplicate: false,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  if (transactions.has(transactionId)) {
    return {
      balance: await getPlayerBalance(playerId),
      duplicate: true,
    };
  }

  transactions.add(transactionId);
  const nextBalance = await getPlayerBalance(playerId) + amount;
  balances.set(playerId, nextBalance);
  return {
    balance: nextBalance,
    duplicate: false,
  };
}

function calculateAutoTapEarnings(booster, now = new Date()) {
  const lastClaimedAt = new Date(booster.last_claimed_at);
  const expiresAt = new Date(booster.expires_at);
  const endAt = now < expiresAt ? now : expiresAt;
  const elapsedMs = Math.max(0, endAt.getTime() - lastClaimedAt.getTime());
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  return {
    earned: elapsedMinutes * autoTapRewardPerMinute,
    elapsedMinutes,
    endAt,
  };
}

async function getActiveAutoTap(playerId) {
  if (pool) {
    const result = await pool.query(
      `select id, player_id, booster_type, started_at, expires_at, last_claimed_at
       from player_boosters
       where player_id = $1
         and booster_type = 'auto_tap_30m'
         and expires_at > now()
       order by expires_at desc
       limit 1`,
      [playerId],
    );

    return result.rows[0] || null;
  }

  return boosters.get(playerId) || null;
}

async function settleAutoTap(playerId) {
  const activeBooster = await getActiveAutoTap(playerId);

  if (!activeBooster) {
    return {
      active: false,
      earned: 0,
      balance: await getPlayerBalance(playerId),
      expires_at: null,
      remaining_seconds: 0,
    };
  }

  const now = new Date();
  const { earned, elapsedMinutes, endAt } = calculateAutoTapEarnings(activeBooster, now);

  try {
    if (pool && earned > 0) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(
          `update player_balances
           set balance = balance + $2, updated_at = now()
           where player_id = $1`,
          [playerId, earned],
        );
        await client.query(
          `update player_boosters
           set last_claimed_at = $2
           where id = $1`,
          [activeBooster.id, endAt],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    } else if (!pool && earned > 0) {
      balances.set(playerId, await getPlayerBalance(playerId) + earned);
      activeBooster.last_claimed_at = endAt.toISOString();
      boosters.set(playerId, activeBooster);
    }
  } catch (error) {
    throw error;
  }

  const expiresAt = new Date(activeBooster.expires_at);
  const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

  return {
    active: remainingSeconds > 0,
    earned,
    elapsed_minutes: elapsedMinutes,
    balance: await getPlayerBalance(playerId),
    expires_at: activeBooster.expires_at,
    remaining_seconds: remainingSeconds,
  };
}

async function activateAutoTap(playerId) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into player_balances (player_id, balance)
         values ($1, 0)
         on conflict (player_id) do nothing`,
        [playerId],
      );

      const active = await client.query(
        `select id, expires_at
         from player_boosters
         where player_id = $1
           and booster_type = 'auto_tap_30m'
           and expires_at > now()
         order by expires_at desc
         limit 1`,
        [playerId],
      );

      if (active.rowCount) {
        await client.query('commit');
        return {
          activated: false,
          reason: 'already_active',
          balance: await getPlayerBalance(playerId),
          expires_at: active.rows[0].expires_at,
        };
      }

      const balance = await client.query(
        'select balance from player_balances where player_id = $1 for update',
        [playerId],
      );
      const currentBalance = Number(balance.rows[0]?.balance || 0);

      if (currentBalance < autoTapCost) {
        await client.query('commit');
        return {
          activated: false,
          reason: 'insufficient_balance',
          balance: currentBalance,
          required: autoTapCost,
        };
      }

      const expiresAt = new Date(Date.now() + autoTapDurationMinutes * 60000);

      await client.query(
        `update player_balances
         set balance = balance - $2, updated_at = now()
         where player_id = $1`,
        [playerId, autoTapCost],
      );
      const booster = await client.query(
        `insert into player_boosters (player_id, booster_type, expires_at)
         values ($1, 'auto_tap_30m', $2)
         returning expires_at`,
        [playerId, expiresAt],
      );
      await client.query('commit');

      return {
        activated: true,
        balance: currentBalance - autoTapCost,
        expires_at: booster.rows[0].expires_at,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const active = await getActiveAutoTap(playerId);
  if (active) {
    return {
      activated: false,
      reason: 'already_active',
      balance: await getPlayerBalance(playerId),
      expires_at: active.expires_at,
    };
  }

  const currentBalance = await getPlayerBalance(playerId);
  if (currentBalance < autoTapCost) {
    return {
      activated: false,
      reason: 'insufficient_balance',
      balance: currentBalance,
      required: autoTapCost,
    };
  }

  balances.set(playerId, currentBalance - autoTapCost);
  const now = new Date();
  const booster = {
    player_id: playerId,
    booster_type: 'auto_tap_30m',
    started_at: now.toISOString(),
    expires_at: new Date(now.getTime() + autoTapDurationMinutes * 60000).toISOString(),
    last_claimed_at: now.toISOString(),
  };
  boosters.set(playerId, booster);

  return {
    activated: true,
    balance: currentBalance - autoTapCost,
    expires_at: booster.expires_at,
  };
}

async function handleRewards(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    return sendJson(response, 200, {
      ok: true,
      player_id: playerId,
      balance: await getPlayerBalance(playerId),
      persistence: pool ? 'postgres' : 'memory',
    });
  } catch (error) {
    console.error('Failed to fetch rewards', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'rewards_fetch_failed',
    });
  }
}

async function handleTelegramSession(request, response, url) {
  const params = await readRequestParams(request, url);
  const initData = params.get('init_data') || '';
  const startParam = params.get('start_param') || '';

  if (!initData) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_init_data',
    });
  }

  const validation = validateTelegramInitData(initData);
  if (!validation.ok) {
    return sendJson(response, 401, validation);
  }

  try {
    await ensurePlayer(validation.playerId);
    let referral = {
      registered: false,
    };
    const referrerPlayerId = startParam.startsWith('ref_')
      ? startParam.slice(4)
      : '';

    if (referrerPlayerId) {
      referral = await registerReferral(referrerPlayerId, validation.playerId, validation.user);
    }

    return sendJson(response, 200, {
      ok: true,
      player_id: validation.playerId,
      referral,
      referral_url: `https://t.me/${telegramBotUsername}?start=ref_${encodeURIComponent(validation.playerId)}`,
      telegram_user: {
        id: validation.user.id,
        username: validation.user.username || '',
        first_name: validation.user.first_name || '',
        last_name: validation.user.last_name || '',
      },
      persistence: pool ? 'postgres' : 'memory',
    });
  } catch (error) {
    console.error('Failed to create Telegram session', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'telegram_session_failed',
    });
  }
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function normalizeGemiAdOffer(offer, playerId) {
  const localizedText = (value, fallback = '') => {
    if (!value) {
      return fallback;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      return value.en || Object.values(value).find(Boolean) || fallback;
    }

    return String(value);
  };

  const rawUrl = String(offer.url || offer.tracking_url || offer.trackingUrl || offer.click_url || '');
  const replacedUrl = rawUrl
    .replaceAll('[USER_ID]', encodeURIComponent(playerId))
    .replaceAll('{USER_ID}', encodeURIComponent(playerId))
    .replaceAll('{user_id}', encodeURIComponent(playerId))
    .replaceAll('{subId}', encodeURIComponent(playerId));
  let trackingUrl = replacedUrl;

  if (trackingUrl) {
    const clickUrl = new URL(trackingUrl);
    if (!clickUrl.searchParams.has('sub1')) {
      clickUrl.searchParams.set('sub1', 'neratap');
    }
    if (!clickUrl.searchParams.has('sub2')) {
      clickUrl.searchParams.set('sub2', 'daily_missions');
    }
    trackingUrl = clickUrl.toString();
  }

  const events = Array.isArray(offer.events)
    ? offer.events.map((event) => ({
      action: localizedText(event.action, 'Complete event'),
      payout: event.payout,
    }))
    : [];
  const payableEvents = events.filter((event) => Number.isFinite(Number(event.payout)));

  return {
    id: String(offer.id || offer.offer_id || offer.offerId || offer.name || trackingUrl),
    name: String(offer.name || offer.title || 'Partner offer'),
    description: localizedText(offer.description, events[0]?.action || 'Complete this task to earn NERA.'),
    icon: String(offer.icon || offer.image || offer.thumbnail || ''),
    banner: String(offer.banner || ''),
    category: String(offer.category || offer.type || 'Offer'),
    countries: normalizeStringList(offer.country || offer.countries || offer.available_in),
    devices: normalizeStringList(offer.device || offer.devices),
    trackingType: String(offer.trackingType || offer.tracking_type || ''),
    multiEvent: Boolean(offer.multiEvent),
    payout: offer.payout || '',
    reward: Math.floor(Number(offer.reward || offer.user_amount || payableEvents[0]?.payout || offer.payout || 0)),
    events,
    url: trackingUrl,
  };
}

async function handleGemiAdOffers(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';
  const requestedCountry = (url.searchParams.get('country') || '').toUpperCase();
  const country = /^[A-Z]{2}$/.test(requestedCountry) ? requestedCountry : '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  if (!gemiAdPlacementId || !gemiAdApiKey) {
    return sendJson(response, 500, {
      ok: false,
      error: 'gemiad_credentials_not_configured',
    });
  }

  const offersUrl = new URL(gemiAdOffersUrl);
  offersUrl.searchParams.set('placementId', gemiAdPlacementId);
  offersUrl.searchParams.set('apiKey', gemiAdApiKey);

  try {
    const apiResponse = await fetch(offersUrl);
    const payload = await apiResponse.json();

    if (apiResponse.status === 429) {
      return sendJson(response, 429, {
        ok: false,
        error: 'gemiad_rate_limited',
      });
    }

    if (!apiResponse.ok || payload.success === false) {
      return sendJson(response, apiResponse.ok ? 502 : apiResponse.status, {
        ok: false,
        error: 'gemiad_offers_fetch_failed',
        status: apiResponse.status,
      });
    }

    const allOffers = Array.isArray(payload.offers)
      ? payload.offers.map((offer) => normalizeGemiAdOffer(offer, playerId)).filter((offer) => offer.url)
      : [];
    const countryMatches = country
      ? allOffers.filter((offer) => (
        !offer.countries.length
          || offer.countries.map((item) => String(item).toUpperCase()).includes(country)
      ))
      : allOffers;

    return sendJson(response, 200, {
      ok: true,
      player_id: playerId,
      count: countryMatches.length,
      raw_count: allOffers.length,
      country,
      offers: countryMatches,
    });
  } catch (error) {
    console.error('Failed to fetch GemiAd offers', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'gemiad_offers_fetch_failed',
    });
  }
}

function gemiAdParam(params, names = []) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
}

function partnerTaskMatchesPostback(task, params, postbackUrl) {
  const key = normalizePartnerTaskKey(gemiAdParam(params, ['sub2', 'SUB2', 'sub_id_2', 'subId2']));
  if (!task.validation_key || key !== task.validation_key) return false;

  const offerId = gemiAdParam(params, ['offerId', 'OFFER_ID', 'offer_id', 'campaign_id'])
    || postbackUrl.searchParams.get('offer_id')
    || '';
  if (task.offer_id && String(offerId).trim() !== String(task.offer_id).trim()) return false;

  const expectedEvent = String(task.event_match || '').trim().toLowerCase();
  if (!expectedEvent) return true;

  const eventValues = [
    gemiAdParam(params, ['eventId', 'EVENT_ID', 'event_id']),
    gemiAdParam(params, ['eventName', 'EVENT_NAME', 'event_name']),
    gemiAdParam(params, ['campaign_id']),
    gemiAdParam(params, ['campaign_name']),
    postbackUrl.searchParams.get('campaign_id'),
    postbackUrl.searchParams.get('campaign_name'),
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());

  return eventValues.some((value) => value === expectedEvent || value.includes(expectedEvent));
}

async function markFoxPayPartnerTasksFromPostback(playerId, params, postbackUrl) {
  let player = await ensureFoxPayPlayer(playerId);
  if (!foxPayAccountEnabled(player)) return { completed_task_ids: [], earned_tickets: 0, skipped: 'account_disabled' };

  const settings = await getFoxPaySettings();
  const pack = await getFoxPayPackage(player.active_package_id || 'free');
  player._package = pack;
  enforceFoxPayCap(player, settings, pack);
  if (foxPayCapReached(player, pack)) {
    await saveFoxPayPlayer(player);
    return { completed_task_ids: [], earned_tickets: 0, skipped: 'package_cap_reached' };
  }

  const taskLanguage = normalizeClientLanguage(params.get('language') || params.get('lang') || '');
  const tasks = await foxPayTaskPayload(player, settings, pack, { language: taskLanguage });
  const matches = tasks.filter((task) => (
    task.type === 'partner'
    && !player.daily_tasks?.[task.id]
    && partnerTaskMatchesPostback(task, params, postbackUrl)
  ));

  if (!matches.length) return { completed_task_ids: [], earned_tickets: 0 };

  player.daily_tasks = {
    ...(player.daily_tasks || {}),
  };
  matches.forEach((task) => {
    player.daily_tasks[task.id] = true;
  });

  const earnedTickets = (await foxPayDailyTicketReady(player, settings, pack, { language: taskLanguage })) ? 1 : 0;
  if (earnedTickets > 0) {
    player.roulette_tickets = Math.max(0, Math.floor(Number(player.roulette_tickets || 0))) + earnedTickets;
    player.daily_tasks[foxpayDailyTaskTicketFlag] = true;
  }

  await saveFoxPayPlayer(player);
  await upsertFoxPayPlayerDailyStats(player, settings, pack);

  return {
    completed_task_ids: matches.map((task) => task.id),
    earned_tickets: earnedTickets,
  };
}

async function handleGemiAdPostback(request, response, url) {
  let params;
  try {
    params = await readRequestParams(request, url);
  } catch {
    return sendText(response, 400, 'ERROR');
  }

  const playerId = params.get('player_id')
    || params.get('userId')
    || params.get('USER_ID')
    || params.get('subId')
    || params.get('subid')
    || params.get('userid')
    || '';
  const transactionId = params.get('transaction_id')
    || params.get('txid')
    || params.get('TXID')
    || params.get('transId')
    || params.get('transactionId')
    || params.get('uuid')
    || '';
  const rawReward = params.get('amount')
    || params.get('reward')
    || params.get('user_amount')
    || params.get('credits')
    || '0';
  const status = params.get('status') || params.get('action') || '1';
  const signature = params.get('signature') || params.get('hash') || '';
  const amount = Math.floor(Math.abs(Number(rawReward)));

  if (!playerId || !transactionId || !Number.isFinite(amount) || amount <= 0) {
    return sendText(response, 400, 'ERROR');
  }

  if (gemiAdSecretKey) {
    const expected = md5(`${playerId}${transactionId}${rawReward}${gemiAdSecretKey}`);
    if (signature && signature !== expected) {
      return sendText(response, 403, 'ERROR');
    }
  }

  if (status === '2' || status.toLowerCase() === 'reversed' || status.toLowerCase() === 'chargeback') {
    return sendText(response, 200, 'OK');
  }

  const postbackUrl = new URL(url.toString());
  params.forEach((value, key) => {
    postbackUrl.searchParams.set(key, value);
  });
  postbackUrl.searchParams.set('offer_id', params.get('offerId') || params.get('OFFER_ID') || params.get('offer_id') || params.get('campaign_id') || 'gemiad');
  postbackUrl.searchParams.set('offer_name', params.get('offerName') || params.get('OFFER_NAME') || params.get('offer_name') || params.get('campaign_name') || 'GemiAd task');
  postbackUrl.searchParams.set('campaign_id', params.get('eventId') || params.get('EVENT_ID') || params.get('offerId') || params.get('OFFER_ID') || 'gemiad');
  postbackUrl.searchParams.set('campaign_name', params.get('eventName') || params.get('EVENT_NAME') || params.get('offerName') || params.get('OFFER_NAME') || 'GemiAd task');
  postbackUrl.searchParams.set('platform', params.get('platform') || 'gemiad');

  try {
    const result = await creditPlayer(playerId, amount, `gemiad:${transactionId}`, postbackUrl);
    const foxPayTaskResult = await markFoxPayPartnerTasksFromPostback(playerId, params, postbackUrl);
    if (foxPayTaskResult.completed_task_ids.length) {
      console.log('FoxPay partner task completed from GemiAd postback', {
        player_id: playerId,
        transaction_id: transactionId,
        task_ids: foxPayTaskResult.completed_task_ids,
        earned_tickets: foxPayTaskResult.earned_tickets,
      });
    }
    return sendText(response, 200, result.duplicate ? 'DUP' : 'OK');
  } catch (error) {
    console.error('Failed to process GemiAd postback', error);
    return sendText(response, 500, 'ERROR');
  }
}

async function handleBoosterStatus(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    const status = await settleAutoTap(playerId);
    return sendJson(response, 200, {
      ok: true,
      player_id: playerId,
      booster: 'auto_tap_30m',
      cost: autoTapCost,
      duration_minutes: autoTapDurationMinutes,
      reward_per_minute: autoTapRewardPerMinute,
      ...status,
    });
  } catch (error) {
    console.error('Failed to fetch booster status', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'booster_status_failed',
    });
  }
}

async function handleBoosterActivate(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    await settleAutoTap(playerId);
    const result = await activateAutoTap(playerId);
    return sendJson(response, 200, {
      ok: true,
      player_id: playerId,
      booster: 'auto_tap_30m',
      cost: autoTapCost,
      duration_minutes: autoTapDurationMinutes,
      reward_per_minute: autoTapRewardPerMinute,
      ...result,
    });
  } catch (error) {
    console.error('Failed to activate booster', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'booster_activation_failed',
    });
  }
}

async function handleFriendsStatus(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    const progress = await getFriendProgress(playerId);
    const balance = await getPlayerBalance(playerId);
    return sendJson(response, 200, await buildFriendStatusPayload(playerId, progress, balance));
  } catch (error) {
    console.error('Failed to fetch friend status', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'friends_status_failed',
    });
  }
}

async function handleFriendsMockInvite(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    const progress = await incrementFriendInvite(playerId);
    const balance = await getPlayerBalance(playerId);
    return sendJson(response, 200, await buildFriendStatusPayload(playerId, progress, balance));
  } catch (error) {
    console.error('Failed to add mock friend invite', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'mock_invite_failed',
    });
  }
}

async function handleFriendsClaim(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const tier = Number(params.get('tier') || 0);

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    const result = await claimFriendReward(playerId, tier);
    if (!result.ok) {
      return sendJson(response, result.status, result);
    }

    return sendJson(
      response,
      200,
      await buildFriendStatusPayload(playerId, result.progress, result.balance),
    );
  } catch (error) {
    console.error('Failed to claim friend reward', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'friend_claim_failed',
    });
  }
}

async function handleGameStateGet(request, response, url) {
  const playerId = url.searchParams.get('player_id') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  try {
    const result = await getGameState(playerId);
    return sendJson(response, 200, {
      ok: true,
      player_id: playerId,
      state: result.state,
      updated_at: result.updated_at,
      persistence: pool ? 'postgres' : 'memory',
    });
  } catch (error) {
    console.error('Failed to fetch game state', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'game_state_fetch_failed',
    });
  }
}

async function handleGameStateSave(request, response, url) {
  const params = await readRequestParams(request, url);
  const playerId = params.get('player_id') || '';
  const statePayload = params.get('state') || '';

  if (!playerId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_player_id',
    });
  }

  if (!statePayload) {
    return sendJson(response, 400, {
      ok: false,
      error: 'missing_state',
    });
  }

  try {
    const state = JSON.parse(statePayload);
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return sendJson(response, 400, {
        ok: false,
        error: 'invalid_state',
      });
    }

    const updatedAt = await saveGameState(playerId, state);
    return sendJson(response, 200, {
      ok: true,
      player_id: playerId,
      updated_at: updatedAt,
      persistence: pool ? 'postgres' : 'memory',
    });
  } catch (error) {
    console.error('Failed to save game state', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'game_state_save_failed',
    });
  }
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' || pathname.endsWith('/')
    ? `${pathname.replace(/\/?$/, '/')}index.html`
    : pathname;
  const safePath = normalize(decodeURIComponent(requestedPath))
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '')
    .replaceAll('\\', '/');
  const adminAssetPrefix = `${adminRoute.replace(/^\/+/, '')}/`;
  const assetPath = safePath.startsWith('foxpay/')
    ? (safePath.slice('foxpay/'.length) || 'index.html')
    : (safePath.startsWith(adminAssetPrefix) ? safePath.slice(adminAssetPrefix.length) : safePath);
  const filePath = join(distDir, assetPath);

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error('not_file');
    }

    response.writeHead(200, {
      'content-type': mimeTypes.get(extname(filePath)) || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': cacheControlForAsset(assetPath, filePath),
    });
    createReadStream(filePath).pipe(response);
  } catch {
    const indexHtml = await readFile(join(distDir, 'index.html'));
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    });
    response.end(indexHtml);
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      return response.end();
    }
    return response.end(JSON.stringify({
      ok: true,
      service: 'foxpay',
      persistence: pool ? 'postgres' : 'memory',
    }));
  }

  if (
    url.pathname === '/OneSignalSDKWorker.js'
    || url.pathname === '/OneSignalSDKUpdaterWorker.js'
    || url.pathname === `${adminRoute}/OneSignalSDKWorker.js`
    || url.pathname === `${adminRoute}/OneSignalSDKUpdaterWorker.js`
  ) {
    return void serveStatic(response, '/onesignal/OneSignalSDK-v16-ServiceWorker/OneSignalSDKWorker.js');
  }

  if (url.pathname === adminRoute) {
    response.writeHead(302, {
      location: `${adminRoute}/`,
      'cache-control': 'no-store',
    });
    return response.end();
  }

  if (url.pathname === `${adminRoute}/`) {
    return void serveStatic(response, '/admin.html');
  }

  if (url.pathname === '/admin.html') {
    return sendJson(response, 404, { ok: false, error: 'not_found' });
  }

  if (url.pathname === '/foxpay-story.html') {
    response.writeHead(301, {
      location: '/story',
      'cache-control': 'public, max-age=3600',
    });
    return response.end();
  }

  if (url.pathname === '/story' || url.pathname === '/story/') {
    return void serveStatic(response, '/foxpay-story.html');
  }

  if (url.pathname === '/foxpay-terms.html') {
    response.writeHead(301, {
      location: '/terms',
      'cache-control': 'public, max-age=3600',
    });
    return response.end();
  }

  if (url.pathname === '/terms' || url.pathname === '/terms/') {
    return void serveStatic(response, '/foxpay-terms.html');
  }

  if (url.pathname === '/api/rewards') {
    return handleRewards(request, response, url);
  }

  if (url.pathname === '/api/session/telegram') {
    return handleTelegramSession(request, response, url);
  }

  if (url.pathname === '/api/gemiad/offerwall' || url.pathname === '/api/gemiad/offers') {
    return handleGemiAdOffers(request, response, url);
  }

  if (url.pathname === '/api/gemiad/postback') {
    return handleGemiAdPostback(request, response, url);
  }

  if (url.pathname === '/api/boosters/auto-tap/status') {
    return handleBoosterStatus(request, response, url);
  }

  if (url.pathname === '/api/boosters/auto-tap/activate') {
    return handleBoosterActivate(request, response, url);
  }

  if (url.pathname === '/api/friends/status') {
    return handleFriendsStatus(request, response, url);
  }

  if (url.pathname === '/api/friends/mock-invite') {
    return handleFriendsMockInvite(request, response, url);
  }

  if (url.pathname === '/api/friends/claim') {
    return handleFriendsClaim(request, response, url);
  }

  if (url.pathname === '/api/game/state' && request.method === 'GET') {
    return handleGameStateGet(request, response, url);
  }

  if (url.pathname === '/api/game/state' && request.method === 'POST') {
    return handleGameStateSave(request, response, url);
  }

  if (url.pathname === '/api/foxpay/me') {
    return handleFoxPayMe(request, response, url);
  }

  if (url.pathname === '/api/foxpay/register') {
    return handleFoxPayRegister(request, response, url);
  }

  if (url.pathname === '/api/foxpay/login') {
    return handleFoxPayLogin(request, response, url);
  }
  if (url.pathname === '/api/foxpay/email') {
    return handleFoxPayEmailUpdate(request, response, url);
  }

  if (url.pathname === '/api/foxpay/tap') {
    return handleFoxPayTap(request, response, url);
  }

  if (url.pathname === '/api/foxpay/tasks') {
    return handleFoxPayTasks(request, response, url);
  }

  if (url.pathname === '/api/foxpay/tasks/claim') {
    return handleFoxPayClaimTask(request, response, url);
  }

  if (url.pathname === '/api/foxpay/roulette/spin') {
    return handleFoxPayRouletteSpin(request, response, url);
  }

  if (url.pathname === '/api/foxpay/skins/select') {
    return handleFoxPaySkinSelect(request, response, url);
  }

  if (url.pathname === '/api/foxpay/skins/claim') {
    return handleFoxPaySkinClaim(request, response, url);
  }

  if (url.pathname === '/api/foxpay/purchase') {
    return handleFoxPayPurchase(request, response, url);
  }

  if (url.pathname === '/api/foxpay/payment/status') {
    return handleFoxPayPaymentStatus(request, response, url);
  }

  if (url.pathname === '/api/foxpay/payment/cancel') {
    return handleFoxPayPaymentCancel(request, response, url);
  }

  if (url.pathname === '/api/foxpay/nowpayments/ipn') {
    return handleFoxPayNowPaymentsIpn(request, response);
  }

  if (url.pathname === '/api/foxpay/withdraw') {
    return handleFoxPayWithdrawal(request, response, url);
  }

  if (url.pathname === '/api/foxpay/passive/claim') {
    return handleFoxPayPassiveClaim(request, response, url);
  }

  if (url.pathname === '/api/foxpay/passive/upgrade') {
    return handleFoxPayPassiveUpgrade(request, response, url);
  }


  if (url.pathname === '/api/foxpay/support/ticket') {
    return handleFoxPaySupportTicket(request, response, url);
  }

  if (url.pathname === '/api/foxpay/support/read') {
    return handleFoxPaySupportRead(request, response, url);
  }

  if (url.pathname === '/api/foxpay/support/rate') {
    return handleFoxPaySupportRate(request, response, url);
  }

  if (url.pathname === '/api/foxpay/avatar/select') {
    return handleFoxPayAvatarSelect(request, response, url);
  }

  if (url.pathname === '/api/foxpay/avatar/pay') {
    return handleFoxPayAvatarPayment(request, response, url);
  }

  if (url.pathname === '/api/foxpay/avatar/buy-fox') {
    return handleFoxPayAvatarFoxPurchase(request, response, url);
  }

  if (url.pathname === '/api/foxpay/skin/pay') {
    return handleFoxPaySkinPayment(request, response, url);
  }

  if (url.pathname === '/api/foxpay/skin/buy-fox') {
    return handleFoxPaySkinFoxPurchase(request, response, url);
  }

  if (url.pathname === '/api/foxpay/matches') {
    return handleFoxPayUserMatches(request, response, url);
  }
  if (url.pathname === '/api/foxpay/matches/bet') {
    return handleFoxPayUserMatchBet(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/overview') {
    return handleFoxPayAdminOverview(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/login') {
    return handleFoxPayAdminLogin(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/admins') {
    return handleFoxPayAdminUsers(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/password') {
    return handleFoxPayAdminPassword(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/push-subscription') {
    return handleFoxPayAdminPushSubscription(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/push-diagnostics') {
    return handleFoxPayAdminPushDiagnostics(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/push-test') {
    return handleFoxPayAdminPushTest(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/settings') {
    return handleFoxPayAdminSettings(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/support/reply') {
    return handleFoxPayAdminSupportReply(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/support/status') {
    return handleFoxPayAdminSupportStatus(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/season/reward') {
    return handleFoxPayAdminSeasonReward(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/package') {
    return handleFoxPayAdminPackage(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/rank') {
    return handleFoxPayAdminRank(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/avatar') {
    return handleFoxPayAdminAvatar(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/roulette/reward') {
    return handleFoxPayAdminRouletteReward(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/roulette/setting') {
    return handleFoxPayAdminRouletteSetting(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/skin') {
    return handleFoxPayAdminSkin(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/skin/remove') {
    return handleFoxPayAdminSkinRemove(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/purchase') {
    return handleFoxPayAdminPurchaseReview(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/manual-purchase') {
    return handleFoxPayAdminManualPurchase(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/withdrawal') {
    return handleFoxPayAdminWithdrawalReview(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/user/delete') {
    return handleFoxPayAdminUserDelete(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/user/add-coins') {
    return handleFoxPayAdminUserAddCoins(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/user/status') {
    return handleFoxPayAdminUserStatus(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/match/add-pool') {
    return handleFoxPayAdminMatchAddPool(request, response, url);
  }

  if (url.pathname === '/api/foxpay/admin/match/create') {
    return handleFoxPayAdminMatchCreate(request, response, url);
  }
  if (url.pathname === '/api/foxpay/admin/match/update-odds') {
    return handleFoxPayAdminMatchUpdateOdds(request, response, url);
  }
  if (url.pathname === '/api/foxpay/admin/match/close') {
    return handleFoxPayAdminMatchClose(request, response, url);
  }
  if (url.pathname === '/api/foxpay/admin/match/resolve') {
    return handleFoxPayAdminMatchResolve(request, response, url);
  }
  if (url.pathname === '/api/foxpay/admin/maintenance/reset') {
    return handleFoxPayAdminMaintenanceReset(request, response, url);
  }

  return void serveStatic(response, url.pathname);
});

initDatabase()
  .then(() => {
    server.listen(port, () => {
      console.log(`FoxPay server listening on port ${port}`);
      console.log(`FoxPay persistence: ${pool ? 'postgres' : 'memory'}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });

