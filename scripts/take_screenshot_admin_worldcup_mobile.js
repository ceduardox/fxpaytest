import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport to mobile size
  await page.setViewportSize({ width: 375, height: 812 });

  // Handle page logs and errors for debugging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  
  // Listen to network requests for debugging
  page.on('request', request => {
    console.log('REQ:', request.method(), request.url());
  });
  page.on('response', response => {
    console.log('RES:', response.status(), response.url());
  });

  // Route/mock the admin overview API request with ALL required properties.
  await page.route('**/api/foxpay/admin/overview*', async (route) => {
    const json = {
      ok: true,
      persistence: 'memory',
      admin: {
        username: 'dev-admin',
        role: 'super_admin',
        permissions: ['view', 'overview_view', 'content_edit', 'settings_edit']
      },
      metrics: {
        users: 1540,
        pending_withdrawals: 3,
        support_open: 1
      },
      settings: {
        token_price_usd: 0.0001,
        token_symbol: 'GFOX',
        withdrawal_min_usdt: 10,
        block_same_ip: false,
        block_same_device: false,
        daily_cycle_minutes: 1440,
        season_name: 'Monthly Season',
        season_start_at: '2026-06-01T00:00:00Z',
        season_end_at: '2026-06-30T23:59:59Z',
        season_winner_limit: 20,
        season_reward_tokens: 100000,
        season_reward_mode: 'competitive',
        unilevel_config: { levels: [] }
      },
      players: [],
      purchases: [],
      withdrawals: [],
      packages: [],
      ranks: [],
      avatars: [],
      skins: [],
      roulette_rewards: [],
      commissions: [],
      support_tickets: [],
      matches: [
        {
          id: 'match_active_1',
          team_a: 'Argentina',
          team_b: 'Francia',
          flag_a: '🇦🇷',
          flag_b: '🇫🇷',
          venue: 'Lusail Stadium',
          match_date: '2026-06-25T18:00:00.000Z',
          status: 'open',
          result: null,
          manual_pool_a: 50000,
          manual_pool_b: 30000,
          manual_pool_draw: 10000,
          created_at: '2026-06-24T12:00:00.000Z',
          poolStats: {
            team_a: 125000, // 75k real + 50k manual
            draw: 22000,    // 12k real + 10k manual
            team_b: 75000,  // 45k real + 30k manual
            total: 222000
          },
          userBets: [
            { player_id: 'p1', username: 'MessiFan10', bet_type: 'team_a', amount: 45000, created_at: '2026-06-24T12:30:00Z' },
            { player_id: 'p2', username: 'MbappeSpeed', bet_type: 'team_b', amount: 35000, created_at: '2026-06-24T13:10:00Z' },
            { player_id: 'p3', username: 'CR7Gamer', bet_type: 'team_a', amount: 30000, created_at: '2026-06-24T14:00:00Z' }
          ]
        }
      ]
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
  });

  // Mock the admins endpoint
  await page.route('**/api/foxpay/admin/admins*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, admins: [] })
    });
  });

  // Mock the push diagnostics endpoint
  await page.route('**/api/foxpay/admin/push-diagnostics*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, diagnostics: { registered_subscriptions: 0 } })
    });
  });

  // 1. Navigate to admin page
  console.log('Navigating to http://localhost:3002/ceduardox/admin.html');
  await page.goto('http://localhost:3002/ceduardox/admin.html');
  await page.waitForTimeout(500);

  // 2. Set the localStorage token and reload
  console.log('Setting localStorage admin session...');
  await page.evaluate(() => {
    localStorage.setItem('foxpay_admin_session_v1', JSON.stringify({
      authToken: 'mock-session-token',
      authKey: 'dev-admin',
      admin: { username: 'dev-admin', role: 'super_admin', source: 'legacy', can_edit: true }
    }));
  });

  console.log('Reloading page with active session...');
  await page.reload();
  await page.waitForTimeout(2000);

  // 3. Switch to World Cup panel programmatically first
  console.log('Programmatically switching to World Cup panel...');
  await page.evaluate(() => {
    if (typeof window.switchPanel === 'function') {
      window.switchPanel('worldcup');
    } else if (typeof switchPanel === 'function') {
      switchPanel('worldcup');
    }
  });

  // 4. Wait for the match cards to render and be visible
  console.log('Waiting for .match-card elements to render and be visible...');
  try {
    await page.waitForSelector('.match-card', { state: 'visible', timeout: 6000 });
  } catch (err) {
    console.log('Timeout waiting for cards. Checking alert container...');
    const alertText = await page.evaluate(() => document.getElementById('alertBox')?.textContent);
    console.log('Alert text:', alertText);
    throw err;
  }

  // 5. Toggle user bets details
  console.log('Toggling user bets details...');
  const detailButton = await page.locator('.match-toggle-bets-btn').first();
  await detailButton.click();
  await page.waitForTimeout(500);

  // Ensure directories exist
  const artDir = 'C:/Users/user/.gemini/antigravity/brain/fbae15c5-795f-460e-a011-2a87f8dae803';
  if (!fs.existsSync(artDir)) {
    fs.mkdirSync(artDir, { recursive: true });
  }
  const testArtDir = 'g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts';
  if (!fs.existsSync(testArtDir)) {
    fs.mkdirSync(testArtDir, { recursive: true });
  }

  // 6. Capture layout screenshots
  const screenshotPath1 = path.join(artDir, 'admin_worldcup_mobile.png');
  const screenshotPath2 = path.join(testArtDir, 'admin_worldcup_mobile.png');
  
  await page.screenshot({ path: screenshotPath1, fullPage: true });
  console.log('Mobile screenshot saved to artifact path:', screenshotPath1);
  
  await page.screenshot({ path: screenshotPath2, fullPage: true });
  console.log('Mobile screenshot saved to test-artifacts:', screenshotPath2);

  await browser.close();
}

main().catch(console.error);
