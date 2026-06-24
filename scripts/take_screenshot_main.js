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
        active_package_id: 'vip_silver', // Change package to a VIP package
        package: { id: 'p90', name: '90 USDT Pack', daily_energy: 800, tap_reward_tokens: 5 },
        token_balance: 154200,
        game_fox_balance: 0,
        pack_cycle_tokens: 0, // 0 generated
        avatar_url: './images/fox-optimized.webp',
        rank: { id: 'bronze', name: 'Bronze', image_url: './images/fox-optimized.webp' },
        streak_days: 0,
        daily_tasks: {},
        total_earned_usd: 0,
        cap_usd: 90,
        energy: 800,
        max_energy: 800,
        can_tap: true
      },
      packages: [
        { id: 'free', name: 'Free Tap', price_usdt: 0 },
        { id: 'p90', name: '90 USDT Pack', price_usdt: 90 }
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

  // Navigate to main page
  await page.goto('http://localhost:3002/');
  
  // Wait for the app script to load or run
  await page.waitForTimeout(3000);
  
  // Take screenshot
  const screenshotPath = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/main_page_simulation.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);
  
  await browser.close();
}

main().catch(console.error);
