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
          id: 'sim_match_4',
          team_a: 'England',
          team_b: 'Ghana',
          flag_a: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
          flag_b: '🇬🇭',
          venue: 'Al Bayt Stadium',
          match_date: '2026-06-26T20:00:00Z',
          status: 'open',
          myBetTotal: 0,
          myBetType: null,
          poolStats: {
            team_a: 12000,
            draw: 3000,
            team_b: 5000,
            total: 20000
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
  await page.waitForTimeout(2000);
  
  // Open the modal via evaluate
  await page.evaluate(() => {
    window.openWorldCupBetModal('sim_match_4', 'team_a');
  });
  
  // Wait for modal to render and animate
  await page.waitForTimeout(1000);
  
  // Take screenshot
  const screenshotPath = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/betting_modal_simulation.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);
  
  await browser.close();
}

main().catch(console.error);
