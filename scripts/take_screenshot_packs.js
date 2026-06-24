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
        active_package_id: 'free', // Start with free package so they can upgrade
        package: { id: 'free', name: 'Free Tap', daily_energy: 300, tap_reward_tokens: 1 },
        token_balance: 154200,
        game_fox_balance: 0,
        pack_cycle_tokens: 0,
        avatar_url: './images/fox-optimized.webp',
        rank: { id: 'bronze', name: 'Bronze', image_url: './images/fox-optimized.webp' },
        streak_days: 0,
        daily_tasks: {},
        total_earned_usd: 0,
        cap_usd: 3,
        energy: 300,
        max_energy: 300,
        can_tap: true
      },
      packages: [
        { id: 'free', name: 'Free Tap', price_usdt: 0, monthly_cap_usd: 3, daily_energy: 300, tap_reward_tokens: 1 },
        { id: 'p30', name: '30 USDT Pack', price_usdt: 30, monthly_cap_usd: 90, daily_energy: 500, tap_reward_tokens: 4 },
        { id: 'p60', name: '60 USDT Pack', price_usdt: 60, monthly_cap_usd: 180, daily_energy: 800, tap_reward_tokens: 5 },
        { id: 'p120', name: '120 USDT Pack', price_usdt: 120, monthly_cap_usd: 360, daily_energy: 1000, tap_reward_tokens: 8 },
        { id: 'p480', name: '480 USDT Pack', price_usdt: 480, monthly_cap_usd: 1440, daily_energy: 1600, tap_reward_tokens: 20 },
        { id: 'p960', name: '960 USDT Pack', price_usdt: 960, monthly_cap_usd: 2880, daily_energy: 2000, tap_reward_tokens: 32 }
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

  // Navigate to packages tab
  await page.goto('http://localhost:3002/#packs');
  
  // Wait for the app script to load or run
  await page.waitForTimeout(3000);

  // Click on "Paquetes" tab button
  await page.click('button[data-tab="shop"]');
  await page.waitForTimeout(1000);

  // Take normal mobile width screenshot (375px)
  const screenshotPath375 = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/packs_page_375.png');
  await page.screenshot({ path: screenshotPath375 });
  console.log('Saved 375px screenshot to:', screenshotPath375);

  // Set viewport to a very narrow mobile size (320px) to see how it breaks
  await page.setViewportSize({ width: 320, height: 812 });
  await page.waitForTimeout(1000);
  const screenshotPath320 = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/packs_page_320.png');
  await page.screenshot({ path: screenshotPath320 });
  console.log('Saved 320px screenshot to:', screenshotPath320);
  
  await browser.close();
}

main().catch(console.error);
