import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set desktop viewport size for the admin panel
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. Bypass authentication by pre-populating localStorage
  await page.addInitScript(() => {
    localStorage.setItem('foxpay_admin_session_v1', JSON.stringify({
      authToken: 'mock-session-token',
      authKey: 'dev-admin',
      admin: { username: 'dev-admin', role: 'super_admin' }
    }));
  });

  // 2. Route/mock the admin overview API request
  await page.route('**/api/foxpay/admin/overview*', async (route) => {
    const json = {
      ok: true,
      persistence: 'memory',
      admin: {
        username: 'dev-admin',
        role: 'super_admin',
        permissions: ['view', 'overview_view', 'content_edit', 'settings_edit']
      },
      settings: {
        token_price_usd: 0.0001,
        token_symbol: 'GFOX',
        daily_cycle_minutes: 1440
      },
      players: [],
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
            { player_id: 'p3', username: 'CristianoCR7', bet_type: 'team_a', amount: 30000, created_at: '2026-06-24T14:15:00Z' },
            { player_id: 'p4', username: 'DrawLover', bet_type: 'draw', amount: 12000, created_at: '2026-06-24T15:20:00Z' }
          ]
        },
        {
          id: 'match_closed_2',
          team_a: 'Brasil',
          team_b: 'Croacia',
          flag_a: '🇧🇷',
          flag_b: '🇭🇷',
          venue: 'Education City Stadium',
          match_date: '2026-06-26T20:30:00.000Z',
          status: 'closed',
          result: null,
          manual_pool_a: 100000,
          manual_pool_b: 20000,
          manual_pool_draw: 5000,
          created_at: '2026-06-24T10:00:00.000Z',
          poolStats: {
            team_a: 150000, // 50k real + 100k manual
            draw: 15000,    // 10k real + 5k manual
            team_b: 25000,  // 5k real + 20k manual
            total: 190000
          },
          userBets: [
            { player_id: 'p5', username: 'NeymarGold', bet_type: 'team_a', amount: 50000, created_at: '2026-06-24T10:30:00Z' },
            { player_id: 'p6', username: 'ModricClassic', bet_type: 'team_b', amount: 5000, created_at: '2026-06-24T11:00:00Z' },
            { player_id: 'p7', username: 'DrawMaster', bet_type: 'draw', amount: 10000, created_at: '2026-06-24T11:30:00Z' }
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

  // Mock the admins endpoint as well to return empty array
  await page.route('**/api/foxpay/admin/admins*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, admins: [] })
    });
  });

  // 3. Open the admin page
  console.log('Navigating to http://localhost:3002/admin.html');
  await page.goto('http://localhost:3002/admin.html');

  // Wait for elements to render
  await page.waitForTimeout(2000);

  // 4. Click the World Cup tab in the sidebar/navigation
  console.log('Switching to World Cup panel...');
  await page.click('button[data-panel="worldcup"]');
  await page.waitForTimeout(1000);

  // 5. Expand the "Ver Detalle" button for the first match to show user bets
  console.log('Toggling user bets details...');
  // Find the button inside the matchesBody table
  const detailButton = await page.locator('button:has-text("Ver Detalle")').first();
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
  const screenshotPath1 = path.join(artDir, 'admin_worldcup_simulation.png');
  const screenshotPath2 = path.join(testArtDir, 'admin_worldcup_simulation.png');
  
  await page.screenshot({ path: screenshotPath1, fullPage: false });
  console.log('Screenshot saved to artifact path:', screenshotPath1);
  
  await page.screenshot({ path: screenshotPath2, fullPage: false });
  console.log('Screenshot saved to test-artifacts:', screenshotPath2);

  await browser.close();
}

main().catch(console.error);
