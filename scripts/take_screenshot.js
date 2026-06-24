import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport to mobile size since this is a mobile tap game
  await page.setViewportSize({ width: 375, height: 812 });

  // Route/mock the dashboard API request
  await page.route('**/api/foxpay/me*', async (route) => {
    const json = {
      ok: true,
      settings: { token_price_usd: 0.0001, referral_rate: 0.1 },
      player: {
        player_id: 'test_player',
        username: 'Fox 9C0E41',
        is_registered: true,
        active_package_id: 'vip_silver', // Change package to a VIP package so matches render
        package: { id: 'p30', name: '30 USDT Pack', daily_energy: 500, tap_reward_tokens: 4 },
        token_balance: 154200,
        avatar_url: './images/fox-optimized.webp',
        rank: { id: 'bronze', name: 'Bronze', image_url: './images/fox-optimized.webp' },
        streak_days: 0,
        daily_tasks: {}
      },
      packages: [
        { id: 'free', name: 'Free Tap', price_usdt: 0 },
        { id: 'p30', name: '30 USDT Pack', price_usdt: 30 }
      ],
      skins: [],
      avatars: []
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
  });

  // Route/mock the matches API request
  await page.route('**/api/foxpay/matches*', async (route) => {
    const json = {
      ok: true,
      matches: [
        {
          id: 'sim_match_1',
          team_a: 'Argentina',
          team_b: 'France',
          flag_a: '🇦🇷',
          flag_b: '🇫🇷',
          venue: 'Lusail Stadium',
          match_date: '2026-06-24T18:00:00Z',
          status: 'resolved',
          result: 'team_a', // Argentina won
          myBetTotal: 5000,
          myBetType: 'team_a',
          poolStats: {
            team_a: 20000,
            draw: 5000,
            team_b: 15000,
            total: 40000
          }
        },
        {
          id: 'sim_match_2',
          team_a: 'Brazil',
          team_b: 'Germany',
          flag_a: '🇧🇷',
          flag_b: '🇩🇪',
          venue: 'Maracanã',
          match_date: '2026-06-24T20:30:00Z',
          status: 'resolved',
          result: 'team_b', // Germany won
          myBetTotal: 10000,
          myBetType: 'team_a', // Bet on Brazil (lost)
          poolStats: {
            team_a: 50000,
            draw: 10000,
            team_b: 40000,
            total: 100000
          }
        },
        {
          id: 'sim_match_3',
          team_a: 'Spain',
          team_b: 'Italy',
          flag_a: '🇪🇸',
          flag_b: '🇮🇹',
          venue: 'Bernabéu',
          match_date: '2026-06-25T15:00:00Z',
          status: 'resolved',
          result: 'draw', // Draw
          myBetTotal: 0,
          myBetType: null,
          poolStats: {
            team_a: 15000,
            draw: 8000,
            team_b: 12000,
            total: 35000
          }
        }
      ]
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
  });
  
  // Navigate to localhost on port 3002 (active server)
  await page.goto('http://localhost:3002/#worldcup');
  
  // Wait for the app script to load or run
  await page.waitForTimeout(3000);

  // Expand container heights for full-page screenshot
  await page.evaluate(() => {
    const tapPhone = document.querySelector('.tap-phone');
    if (tapPhone) {
      tapPhone.style.height = 'auto';
      tapPhone.style.minHeight = 'none';
      tapPhone.style.overflow = 'visible';
    }
    const sheetPanel = document.querySelector('.sheet-panel');
    if (sheetPanel) {
      sheetPanel.style.height = 'auto';
      sheetPanel.style.overflow = 'visible';
      sheetPanel.style.paddingBottom = '80px'; // Add bottom spacing to prevent cutoffs
    }
    const html = document.documentElement;
    const body = document.body;
    html.style.height = 'auto';
    body.style.height = 'auto';
  });

  // Take full-page screenshot
  const screenshotPath = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/resolved_matches_simulation.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);
  
  await browser.close();
}

main().catch(console.error);
