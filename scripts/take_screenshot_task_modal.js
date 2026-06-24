import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport to mobile size
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
        active_package_id: 'free',
        package: { id: 'free', name: 'Free Tap', daily_energy: 300, tap_reward_tokens: 1 },
        token_balance: 154200,
        game_fox_balance: 100,
        passive_income_per_hour: 50,
        avatar_url: './images/fox-optimized.webp',
        rank: { id: 'bronze', name: 'Bronze', image_url: './images/fox-optimized.webp', direct_count: 0 },
        streak_days: 0,
        daily_tasks: {},
        total_earned_usd: 0,
        cap_usd: 3,
        energy: 300,
        max_energy: 300,
        can_tap: true
      },
      packages: [
        { id: 'free', name: 'Free Tap', price_usdt: 0 }
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

  // Navigate to Tasks tab
  await page.goto('http://localhost:3002/#tasks');
  
  // Wait for the app script to load
  await page.waitForTimeout(3000);

  // Click on the Daily Check-in task
  await page.click('button[data-task="daily_check"]');
  await page.waitForTimeout(1000);

  // Take normal mobile width screenshot (375px)
  const screenshotPath375 = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/task_modal_375.png');
  await page.screenshot({ path: screenshotPath375 });
  console.log('Saved 375px screenshot to:', screenshotPath375);

  // Set viewport to 320px
  await page.setViewportSize({ width: 320, height: 812 });
  await page.waitForTimeout(1000);
  const screenshotPath320 = path.resolve('g:/NERAVERSE/NERATAPCOIN/FOXPAY MINERADORAS/test-artifacts/task_modal_320.png');
  await page.screenshot({ path: screenshotPath320 });
  console.log('Saved 320px screenshot to:', screenshotPath320);
  
  await browser.close();
}

main().catch(console.error);
