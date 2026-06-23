const app = document.getElementById('app');

const playerKey = 'foxpay_player_id_v2';
const accountTokenKey = 'foxpay_account_token_v1';
const deviceKeyStorage = 'foxpay_device_key_v1';
const videoProgressStorage = 'foxpay_video_progress_v1';
const maintenanceResetStorage = 'foxpay_maintenance_reset_version_v1';
const skinClaimDismissStorage = 'foxpay_skin_claim_dismissed_v1';
const foxImage = './images/fox-optimized.webp';
const sleepingFoxImage = './images/sleeping-optimized.webp';
const coinImage = './images/UX/coinfox-optimized.webp';
const icon = (name) => `<iconify-icon icon="${name}"></iconify-icon>`;
const uxAsset = (name) => `./images/UX/optimized/${name}`;
const uxImage = (name, className = 'ux-img') => `<img class="${className}" src="${uxAsset(name)}" alt="" loading="lazy" decoding="async" />`;
const packageIcon = (name) => `<img class="ux-img" src="./images/UX/package-icons/${name}" alt="" loading="lazy" decoding="async" />`;
const coinIcon = (className = 'coin-img') => `<img class="${className}" src="${coinImage}" alt="" loading="lazy" decoding="async" />`;
const ticketIcon = () => icon('ph:ticket-fill');
const countryFlagEmoji = (code) => {
  const safe = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(safe)) return '';
  return `<span class="country-flag" aria-label="${safe}">${String.fromCodePoint(...[...safe].map((char) => 127397 + char.charCodeAt(0)))}</span>`;
};
const countryDisplayText = (row = {}) => row.country_name || row.country_code || tr('unknownCountry');
const countryDisplayMarkup = (row = {}) => `${countryFlagEmoji(row.country_code)}<span>${escapeHtml(countryDisplayText(row))}</span>`;
const leaderboardCountryFlag = (row = {}) => {
  const code = String(row.countryCode || row.country_code || '').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return `<span class="leader-country-globe">${icon('ph:globe-hemisphere-west-bold')}</span>`;
  const label = row.countryName || row.country_name || code.toUpperCase();
  return `<img class="leader-country-flag-img" src="https://flagcdn.com/24x18/${code}.png" alt="" title="${escapeAttr(label)}" loading="lazy" decoding="async" />`;
};
const leaderboardRankBadge = (row = {}) => {
  const rank = row.playerRank || row.player_rank || defaultVisualRank();
  const name = rank?.name || 'Free';
  const image = rank?.image_url || '';
  return `
    <span class="leader-player-rank">
      ${leaderboardCountryFlag(row)}
      <span class="leader-rank-mark">
        ${image ? `<img src="${escapeAttr(image)}" alt="" loading="lazy" decoding="async" />` : icon('ph:medal-bold')}
      </span>
      <span>${escapeHtml(name)}</span>
    </span>
  `;
};
const packageIconMarkup = (pack) => pack.icon_url
  ? `<img class="ux-img" src="${pack.icon_url}" alt="" loading="lazy" decoding="async" />`
  : packageIcon(packIconAsset(pack));
const preferredLanguage = (navigator.languages || [navigator.language || 'en'])
  .map((value) => String(value || '').toLowerCase())
  .find((value) => value.startsWith('es') || value.startsWith('pt') || value.startsWith('en')) || 'en';
const appLang = preferredLanguage.startsWith('es') ? 'es' : (preferredLanguage.startsWith('pt') ? 'pt' : 'en');
document.documentElement.lang = appLang;
const fmtLocale = appLang === 'es' ? 'es-ES' : (appLang === 'pt' ? 'pt-BR' : 'en-US');
const deviceLabel = `${navigator.platform || 'Device'} / ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`;
const fmt = (value, digits = 0) => new Intl.NumberFormat(fmtLocale, {
  maximumFractionDigits: digits,
}).format(Number(value || 0));
const roundUsdtCents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const ceilUsdtCents = (value) => Math.ceil((Number(value || 0) - 1e-9) * 100) / 100;
const dashboardQuery = () => `player_id=${encodeURIComponent(playerId)}&referrer_id=${encodeURIComponent(ref)}&device_key=${encodeURIComponent(deviceKey)}&device_label=${encodeURIComponent(deviceLabel)}&language=${encodeURIComponent(appLang)}&account_token=${encodeURIComponent(accountToken)}`;
const randomIdPart = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`);
const createPlayerId = (prefix = 'fox_') => `${prefix || 'fox_'}${randomIdPart()}`;
const walletTokens = (player = dashboard?.player) => Math.max(0, Math.floor(Number(player?.wallet_tokens ?? player?.token_balance ?? 0)));
const walletUsdt = (player = dashboard?.player) => Number(player?.wallet_usdt ?? player?.usdt_balance ?? (walletTokens(player) * Number(dashboard?.settings?.token_price_usd || 0.0001)));
const packCycleTokens = (player = dashboard?.player) => Math.max(0, Math.floor(Number(player?.pack_cycle_tokens ?? (Number(player?.total_earned_usd || 0) / Number(dashboard?.settings?.token_price_usd || 0.0001)))));
const isEnabled = (value) => value === true || value === 'true' || value === 1 || value === '1';
const escapeAttr = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const balanceSizeClass = (value) => {
  const length = fmt(value).length;
  if (length >= 10) return 'balance-chip--xs';
  if (length >= 7) return 'balance-chip--sm';
  return '';
};
const networkIcon = (network) => ({
  polygon: icon('simple-icons:polygon'),
  tron: '<svg class="network-inline-svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M4 4.8 28 9.2 14.8 28 4 4.8Zm4.3 4.1 5.9 14.2 2.3-9.1-8.2-5.1Zm1.6-1.6 7.5 4.7 5.2-2.7-12.7-2Zm8.6 7.3-2.1 8.3 7.8-11.1-5.7 2.8Z" fill="currentColor"/></svg>',
  bep20: icon('simple-icons:binance'),
}[network] || icon('ph:currency-circle-dollar-fill'));
const paymentNetworks = [
  ['bep20', 'BEP20'],
  ['polygon', 'Polygon'],
  ['tron', 'TRON'],
];
const networkButtonContent = (value, label) => `
  <span class="network-button-inner">
    <span class="network-button-icon">${networkIcon(value)}</span>
    <span class="network-button-label">${label}</span>
  </span>
`;
const socialTaskIcon = (platform = '') => ({
  instagram: 'simple-icons:instagram',
  tiktok: 'simple-icons:tiktok',
  telegram: 'simple-icons:telegram',
  youtube: 'simple-icons:youtube',
}[String(platform).toLowerCase()] || 'ph:link-bold');
const validEvmAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
const validTronAddress = (value) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value || '').trim());
const validWithdrawalAddress = (value, network) => {
  if (network === 'tron') return validTronAddress(value);
  if (network === 'bep20' || network === 'polygon') return validEvmAddress(value);
  return false;
};
const withdrawalPlaceholder = (network) => (network === 'tron' ? 'T... USDT TRON wallet' : '0x... USDT wallet');
const shortHash = (value) => {
  const text = String(value || '');
  const txMatch = text.match(/\/tx\/(0x[a-fA-F0-9]{64})/);
  if (txMatch) return shortHash(txMatch[1]);
  return text.length > 14 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
};
const videoProgressKey = (taskId) => `${playerId}:${dashboard?.player?.daily_key || 'today'}:${dashboard?.player?.active_package_id || 'free'}:${taskId}`;
const i18n = {
  en: {
    installTitle: 'Install FoxPay',
    installText: 'Fast access and optimized loading.',
    install: 'Install',
    updateReadyTitle: 'Update available',
    updateReadyText: 'Apply the latest FoxPay version when you are ready.',
    updateApp: 'Update',
    updatingApp: 'Updating...',
    close: 'Close',
    pullRefreshPull: 'Pull to refresh',
    pullRefreshRelease: 'Release to update',
    pullRefreshRefreshing: 'Updating',
    capReached: 'Cap reached: this pack already completed {cap} USDT. You can withdraw balance or buy another pack to restart from 0.',
    capInfo: 'Pack cap: tap, tasks, ranking and referrals/commissions add up to {cap} USDT.',
    freeCapInfo: 'One-time free withdrawal limit: {cap} USD. Purchase a package for unlimited withdrawals.',
    minerMaxOffline: 'Max offline accumulation: 3 hours',
    skinsLockedTitle: 'Skins Locked',
    skinsLockedDesc: 'Using skins and earning real FOX daily is an exclusive feature for players with an active paid package.',
    skinsLockedBtn: 'Unlock Packages',
    generatesUpTo: 'Generates up to',
    packInfoTitle: 'Pack recovery',
    packInfoTotal: 'Total recovery gain',
    packInfoDaily: 'Estimated daily gain',
    packInfoDailyNote: 'Calculated as total recovery divided by 30 days. Real gain depends on daily tasks and energy used.',
    buyAnotherPack: 'Buy another pack',
    tomorrow: 'Come back tomorrow',
    dailyTasks: 'Daily Tasks',
    unlockTasks: 'Unlock Tasks',
    packages: 'Packages',
    usdtPacks: 'USDT packs',
    capEnergy: 'Cap {cap} USDT / Energy {energy}',
    free: 'Free',
    daily: 'Daily',
    tasks: 'Tasks',
    loadingTasks: 'Loading tasks...',
    capTasksBlocked: 'Cap reached: tap, tasks, ranking and referrals no longer add in this pack. Buy another pack to restart.',
    tasksDone: 'Tasks completed. Come back tomorrow.',
    taskLockedByCap: 'Locked by pack cap. Buy another pack to earn again.',
    optional: 'Optional',
    required: 'Required',
    openYoutube: 'Open YouTube - return after {watch}s - validate +{delay}s',
    withdraw: 'Withdraw',
    wallet: 'Wallet',
    foxWallet: 'FOX Wallet',
    walletBalance: 'Current balance',
    walletHint: 'Your wallet is kept when you start a new pack.',
    currentPack: 'Current pack',
    packProgress: 'Pack progress',
    generatedPack: 'Generated in this pack',
    recentActivity: 'Recent activity',
    noActivity: 'No activity yet.',
    allMovements: 'All',
    walletPurchases: 'Purchases',
    walletCommissions: 'Commissions',
    walletWithdrawals: 'Withdrawals',
    packPurchase: 'Pack purchase',
    pendingPayment: 'Pending payment',
    waitingPayment: 'Waiting payment',
    continuePayment: 'Continue payment',
    checkingPayment: 'Checking payment',
    paymentStillPending: 'Payment pending. Check Wallet.',
    pendingPackPayment: 'Pending payment',
    pendingPackHeld: '{count} FOX held',
    cancelPayment: 'Cancel payment',
    paymentCancelled: 'Payment cancelled. FOX released.',
    heldFox: 'Held FOX',
    heldFoxText: 'FOX reserved by pending payments.',
    notCompleted: 'Not completed',
    foxUsed: 'FOX used',
    usdtPaid: 'USDT paid',
    noMovements: 'No movements in this filter.',
    openWallet: 'Open wallet',
    buyPacks: 'Buy packs',
    payUsdt: 'Pay USDT',
    useFox: 'Use FOX',
    chooseFoxPayment: 'Choose FOX amount',
    foxWalletAvailable: 'Available in wallet',
    foxAmountToUse: 'FOX to use',
    usdtToPay: 'USDT to pay',
    minUsdtPayment: 'Partial payments keep at least {amount} USDT for the real payment.',
    minFoxPayment: 'Minimum to use FOX: {tokens} FOX.',
    payWithSelection: 'Pay',
    generatingPayment: 'Generating payment...',
    allFoxAllowed: 'You can cover this pack fully with FOX.',
    allFoxPayment: '100% FOX',
    foxApplied: 'FOX wallet applied',
    payment: 'Payment',
    commission: 'Commission',
    seasonReward: 'Season reward',
    seasonRewardMeta: 'Ranking prize',
    seasonPrize: '{count} FOX prize pool',
    seasonScheduledTitle: 'Season scheduled',
    seasonScheduledBody: 'Starts {date}',
    seasonActiveBody: 'Ranking in progress',
    seasonEndedTitle: 'Season finished',
    seasonEndedReview: 'Winners under review',
    seasonPaidTitle: 'Season paid',
    seasonPaidBody: 'Check your FOX Wallet',
    seasonGeneralBody: 'Current list shows the general wallet ranking.',
    convertUsdt: 'Convert to USDT',
    pendingApproval: 'Pending approval',
    requestWithdrawal: 'Request withdrawal',
    withdrawalFeeNote: 'A 20% fee is deducted from every approved withdrawal.',
    capWithdrawNote: 'The pack cap adds tap, tasks, ranking and referrals/commissions. When it reaches the limit, you can only withdraw available balance or buy another pack to restart the cycle.',
    pendingWithdrawalNote: 'You already have a pending withdrawal. Wait for approval or rejection before requesting another.',
    pendingWithdrawalShort: 'Wait for approval or rejection.',
    withdrawalHistory: 'Withdrawal history',
    historyPage: 'Page {page} of {total}',
    previousPage: 'Previous',
    nextPage: 'Next',
    secureAccount: 'Secure account',
    createAccount: 'Create account',
    username: 'Username',
    passwordMin: 'Password min 6 chars',
    securityQuest: 'Security mini quest',
    tokenSelected: 'Token selected',
    chooseToken: 'Choose one token to continue',
    registerDevice: 'Register device',
    loginExisting: 'Login existing',
    password: 'Password',
    email: 'Email',
    emailPlaceholder: 'Email address',
    emailMissingTitle: 'Add your email',
    emailMissingText: 'Required before withdrawals and useful for support.',
    saveEmail: 'Save email',
    emailSaved: 'Email saved',
    sessionExpiredToast: 'Your account was opened on another device.',
    sessionExpiredTitle: 'Account opened on another device',
    sessionExpiredText: 'For your security, log in again if you want to use it here.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    login: 'Login',
    profile: 'Profile',
    deviceAccount: 'Device account',
    registeredAccount: 'Registered account',
    readyWithdrawals: 'Ready for withdrawals',
    registerBeforeWithdrawals: 'Register before requesting withdrawals',
    streakDays: 'Daily streak',
    streakDaysText: 'Consecutive check-in days',
    streakDaysValue: '{count}D',
    rankRulesTitle: 'Rank rules',
    rankRulesSubtitle: 'Reach higher levels with direct referrals, organization volume and team ranks.',
    currentRank: 'Current rank',
    yourProgress: 'Your progress',
    directReferrals: 'Direct referrals',
    lifetimeEarned: 'Organization volume',
    teamRequirement: 'Team requirement',
    noRequirement: 'No requirement',
    noTeamRequirement: 'No team requirement',
    noTeamNeeded: 'No team needed',
    nextGoal: 'Next goal',
    allRanksReached: 'All ranks reached',
    missingIntro: 'You still need',
    missingDirects: '{count} direct referrals',
    missingEarned: '{count} USDT organization volume',
    missingTeam: '{count} {rank} in your team',
    totalProgress: 'Total progress',
    rankInProgress: 'In progress',
    rankNotReached: 'Not reached yet',
    rankUnlocked: 'Unlocked',
    readyRequirement: 'Ready',
    rankOrHigher: 'or higher',
    rankReached: 'Reached',
    rankLocked: 'Locked',
    country: 'Country',
    countryPending: 'Country pending from server headers',
    sponsor: 'Sponsor',
    sponsorId: 'Sponsor ID',
    sponsorUsername: 'Sponsor username',
    sponsorNone: 'No sponsor',
    sponsorUnregistered: 'Account not registered yet',
    referralLink: 'Your referral link',
    shareInvite: 'Share this link with your invited users.',
    copyLink: 'Copy link',
    shareLink: 'Share link',
    referralBonus: 'Referral bonus',
    referralBonusText: '10% of the referred package value, paid in FOX and counted toward your cap.',
    projectInfo: 'Project information',
    projectInfoText: 'Read the FoxPay story before using rewards, packages or withdrawals.',
    openStory: 'FoxPay story',
    openTerms: 'Terms and conditions',
    acceptTerms: 'I have read and accept the terms and conditions.',
    readTerms: 'Read terms',
    termsRequired: 'Accept the terms and conditions to create your account.',
    friends: 'Friends',
    referrals: 'Referrals',
    invited: '{count} invited',
    activePackages: '{count} active packages',
    copy: 'Copy',
    bonusEst: 'Bonus est.',
    usdtEst: 'USDT est.',
    earnings: 'Earnings',
    earningsTitle: 'Levels by pack',
    openEarnings: 'View earnings and levels',
    currentPlan: 'Current pack',
    realCredited: 'Real credited',
    lostCapShort: 'Lost by cap',
    infoEstimate: 'Informative estimate',
    directEstimateText: 'This estimate is not available balance. Real credits appear in commission history.',
    levelRules: 'Levels by pack',
    levelRulesText: 'Your active pack defines how many levels you receive and the percentage per level.',
    levels: 'levels',
    levelShort: 'L{level}',
    noLevel: 'No level',
    noActiveCommission: 'This pack has no commission levels.',
    inviteLink: 'Your invite link',
    unilevelMap: 'Unilevel map',
    usersNetwork: '{count} users in network',
    openNetwork: 'Open visual network',
    unknown: 'Unknown',
    noNetwork: 'No network yet.',
    commissionHistory: 'Commission history',
    lostByCap: '{count} FOX lost by cap',
    credited: '{count} FOX credited',
    lost: '{count} FOX lost',
    noCommissions: 'No commissions yet.',
    foxPlayer: 'Fox player',
    unknownCountry: 'Unknown country',
    noReferrals: 'No referrals yet',
    shareTeam: 'Share your link to start building your team.',
    taskInviteFriends: 'Invite {count} friends',
    taskInviteFriendsDesc: '{done}/{goal} new referrals confirmed today.',
    taskInviteFriendsReady: 'Referral goal ready to confirm.',
    referralTaskStepShare: 'Share your link',
    referralTaskStepShareDesc: 'Send your invite link to new users.',
    referralTaskStepWait: 'Wait for new entries',
    referralTaskStepWaitDesc: 'They count when FoxPay creates their ID from your link.',
    referralTaskStepRegisterDesc: 'They count when they register with password from your link.',
    referralTaskNotReady: 'You still need {count} more referrals.',
    networkMap: 'Network Map',
    back: 'Back',
    you: 'You',
    noPlayers: 'No players yet',
    rankingFills: 'This ranking will fill as users qualify.',
    leaderboard: 'Leaderboard',
    roulette: 'Roulette',
    rouletteReady: 'Spin arena',
    rouletteTickets: 'Tickets',
    rouletteSpin: 'Spin roulette',
    rouletteNeedTicket: 'Complete tasks to earn roulette tickets.',
    rouletteResult: 'Prize: {reward}',
    roulettePrizeTitle: 'Prize unlocked',
    rouletteNoPrizeTitle: 'Keep trying',
    roulettePrizeClose: 'Continue',
    rouletteNoPrizeKeepTrying: 'Keep trying',
    rouletteNoPrizeThisTime: 'No prize',
    rouletteNoPrizeAlmost: 'Almost!',
    rouletteNoPrizeNextTime: 'Next time',
    rouletteNoPrizeMiss: 'Miss',
    rouletteNoPrizeEmpty: 'Empty',
    rouletteCost: 'Cost: {count} ticket',
    dailyTicketTitle: 'Daily ticket unlocked',
    dailyTicketBody: 'You completed the daily required tasks and earned {count} roulette ticket.',
    dailyTicketUse: 'Use it in roulette',
    dailyTicketStay: 'Stay here',
    skins: 'Skins',
    mySkins: 'My skins',
    activeSkins: 'Active skins',
    noSkins: 'No skins yet',
    winSkinsRoulette: 'Win skins in roulette to earn daily auto taps.',
    selectSkin: 'Activate',
    selectedSkin: 'Activated',
    skinLimit: 'You can activate up to 2 skins.',
    skinChangesNextClaim: 'If you already claimed today, changes apply to the next daily claim.',
    skinDaily: '+{count} FOX/day',
    claimSkinTaps: 'Claim +{count} FOX',
    skinTapsReady: 'Your skins produced {count} FOX today.',
    skinTapsClaimed: 'Skin taps claimed. Come back tomorrow.',
    goSkins: 'My skins',
    skinClaimedToast: '+{count} FOX from skins',
    skinStore: 'Skin shop',
    skinShop: 'Shop',
    skinInventory: 'Inventory',
    skinStoreLocked: 'Direct purchase unlocks from the 60 USDT Pack. Free and 30 USDT users can win skins in roulette.',
    buySkinUsdt: 'Buy USDT',
    buySkinFox: 'Buy FOX',
    skinRequiresPack: 'Requires {pack}',
    skinCanGenerate: 'Can generate {count} FOX/day',
    ownedSkin: 'Owned',
    confirmSkinFox: 'Confirm spending {tokens} FOX for {name}.',
    skinPurchased: 'Skin unlocked',
    skinPurchasedInventory: 'Skin unlocked and activated.',
    insufficientTokens: 'Not enough FOX.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    backToEarn: 'Back to home',
    goToTasks: 'Go to Tasks',
    localMode: 'Local mode: backend API not connected',
    totalCoins: 'Total coins',
    totalPlayer: 'Total Player',
    season: 'SEASON',
    ends: 'ENDS',
    rankingOnly: 'General ranking without active season',
    avatars: 'Avatars',
    selected: 'Selected',
    use: 'Use',
    premiumAvatar: 'Premium avatar',
    buyAvatarFox: 'FOX',
    buyAvatarUsdt: 'USDT',
    avatarPurchased: 'Avatar unlocked',
    usdtFrom: 'USDT payment from {amount}',
    navEarn: 'Earn',
    navPacks: 'Packs',
    navTasks: 'Tasks',
    navRank: 'Rank',
    navFriends: 'Friends',
    navCashout: 'Cashout',
    support: 'Support',
    supportCenter: 'Support center',
    supportProfileText: 'Send a ticket and see admin replies here.',
    contactSupport: 'Contact support',
    supportMyTickets: 'My tickets',
    supportNewReply: 'new',
    supportResponded: 'Answered',
    supportOpen: 'Open',
    supportWaitingAdmin: 'Sent',
    supportWaitingUser: 'Answered',
    supportClosed: 'Closed',
    supportCategory: 'Category',
    supportMessage: 'Message',
    supportImage: 'Image',
    supportImageOptional: 'Optional image',
    supportImageHint: 'PNG, JPG or WebP up to 10 MB. It will be optimized before sending.',
    supportImageAttached: 'Image attached',
    supportImageProcessing: 'Optimizing image...',
    supportMessagePlaceholder: 'Write what happened with your account.',
    sendSupport: 'Send',
    supportReply: 'Reply',
    supportNoTickets: 'No support messages yet.',
    supportSent: 'Message sent',
    supportRead: 'Message read',
    supportWaitAdminReply: 'Support is reviewing your message. You can reply when the admin answers.',
    supportRateLimited: 'Wait a moment before sending another support message.',
    support_wait_admin_reply: 'Support is reviewing your message. You can reply when the admin answers.',
    support_rate_limited: 'Wait a moment before sending another support message.',
    support_daily_limited: 'Daily support limit reached. Try again tomorrow.',
    supportRateTitle: 'Rate this support ticket',
    supportRatePrompt: 'Please rate the previous closed ticket before opening a new one.',
    supportRateSaved: 'Thanks, you can open another ticket now.',
    supportRateOpen: 'Open ticket',
    supportRating1: 'Very bad',
    supportRating2: 'Bad',
    supportRating3: 'Regular',
    supportRating4: 'Good',
    supportRating5: 'Excellent',
    support_message_too_short: 'Write at least 10 characters.',
    support_image_invalid: 'The image could not be processed. Try another image.',
    support_too_many_links: 'Send fewer links in your support message.',
    support_rating_required: 'Please rate the previous closed ticket before opening a new one.',
    blockedTitle: 'Limited access',
    ipBlocked: 'This IP already has an active FoxPay account.',
    deviceBlocked: 'This device already has an active FoxPay account.',
    accountDisabled: 'This account was disabled by the administrator.',
    blockedHelp: 'If you think this is an error, contact the administrator.',
    taskDaily: 'Daily task',
    taskTiming: 'Complete the timing flow before validating the task.',
    taskCompleteReward: 'Complete this task to mark the daily check.',
    partnerTaskDesc: 'Complete the partner task. FoxPay will validate it automatically after confirmation.',
    partnerOpen: 'Open partner task',
    partnerComplete: 'Complete the task in the partner app.',
    partnerWait: 'Wait for verification',
    partnerWaitDesc: 'The check is marked only when FoxPay receives the partner confirmation.',
    partnerPendingToast: 'Task opened. Waiting for partner verification.',
    continue: 'Continue',
    openVideo: 'Open the video',
    videoConfigured: 'Press Continue, watch the video, and return to claim.',
    videoMissing: 'This video is not available yet.',
    watchTime: 'Watch time',
    stayVideo: 'Stay on the video for at least {seconds} seconds.',
    returnFoxPay: 'Return to FoxPay',
    waitReward: 'Come back and wait {seconds} seconds before the check is validated.',
    openTask: 'Open the task',
    visitSocial: 'Press Continue and complete the requested social action.',
    socialMissing: 'This social task is not available yet.',
    completeIt: 'Complete it',
    socialAction: 'Follow the action requested by the campaign.',
    socialStay: 'Stay on the opened page for at least {seconds} seconds.',
    claimReward: 'Validate task',
    returnClaim: 'Return to FoxPay to mark this task completed.',
    goEarn: 'Go to Earn',
    tapUntil: 'Tap until your daily counter reaches the required goal.',
    goal: 'Goal',
    completeCycle: 'Complete the daily tap cycle.',
    whenReady: 'When ready, continue to mark the task completed.',
    dailyAction: 'Daily action',
    activateSession: 'Activate today session.',
    confirm: 'Confirm',
    marksCompleted: 'This marks your daily task as completed.',
    reward: 'Daily ticket',
    continueClaim: 'Complete all daily tasks to earn 1 roulette ticket.',
    copied: 'Copied',
    referralCopied: 'Referral link copied',
    referralShared: 'Referral link ready',
    completeCaptcha: 'Complete the security mini quest',
    accountCreated: 'Account created',
    loggedIn: 'Logged in',
    installationUnavailable: 'Installation not available in this browser',
    installing: 'Installing FoxPay',
    installCanceled: 'Installation canceled',
    installed: 'FoxPay installed',
    paymentQr: 'Payment QR generated',
    freePackActivated: 'Free pack activated',
    withdrawalRequested: 'Withdrawal requested',
    invalidWallet: 'Invalid address for selected network.',
    walletChangePassword: 'Password',
    walletChangeNotice: 'This changes your saved withdrawal wallet. Confirm your password.',
    walletChangeTitle: 'Confirm wallet change',
    walletChangeBody: 'For security, enter your password before changing the saved withdrawal destination.',
    walletChangeConfirm: 'Confirm',
    savedWithdrawalWallet: 'Saved withdrawal wallet',
    avatarUpdated: 'Avatar updated',
    capToast: 'Cap reached. Buy another pack to earn again.',
    completeTasksFirst: 'Complete daily tasks first',
    localTaskMarked: 'Local mode: task marked',
    backendOffline: 'Backend API not connected',
    videoReturn: 'Come back in {seconds}s to validate',
    socialReturn: 'Return after {seconds}s to validate',
    videoMissingSeconds: '{seconds}s of video remaining',
    videoReturnedEarly: 'You returned too early. Keep the task open until the timer finishes.',
    rewardIn: 'Validation in {seconds}s',
    videoReadyToValidate: 'Ready to validate',
    validateShort: 'Validate',
    continueVideo: 'Continue video',
    claimingReward: 'Validating task',
    videoClaimed: 'Video task claimed',
    socialClaimed: 'Social task claimed',
    taskRewardAwarded: 'Task completed',
    dailyTicketAwarded: '+{count} ticket for completing daily tasks',
    taskCheckBadge: 'Claim',
    taskOpenBadge: 'Open',
    taskDoneBadge: 'Done',
    taskPendingBadge: 'Pending',
    finishActiveTask: 'Finish the active task first.',
    taskTicketHint: 'Complete all daily tasks to earn 1 roulette ticket.',
    payExact: 'Send exact amount on selected network. FoxPay activates automatically after confirmation.',
    copyAmount: 'Copy amount',
    copyAddress: 'Copy address',
    pay: 'Pay {amount} USDT',
    paymentActivated: 'Package activated',
    avatarActivated: 'Avatar activated',
    paymentStatus: 'Payment {status}',
    registerCaptchaPrompt: 'Tap the correct token',
    captchaFox: 'Tap the FOX coin',
    captchaStar: 'Tap the star token',
    captchaShield: 'Tap the shield token',
    captchaDiamond: 'Tap the diamond token',
    taskDailyCheck: 'Daily check-in',
    taskDailyCheckDesc: 'Activate today session',
    taskTapGoal: 'Tap 100 times',
    taskTapGoalDesc: 'Complete the daily tap cycle',
    taskWatchVideo: 'Watch video {number}',
    taskWatchVideoDesc: 'Watch at least 30 seconds',
    taskVideoPending: 'Video pending setup',
    taskFollowChannel: 'Follow channel',
    package_cap_reached: 'Package cap reached. Buy another pack to start a new cycle.',
    package_not_upgrade: 'You already have an equal or higher pack active.',
    activePack: 'Active',
    lowerPack: 'Lower pack',
    daily_tasks_required: 'Complete daily check-in and video tasks before tapping.',
    energy_empty: 'Energy is empty for today.',
    insufficient_tokens: 'Insufficient balance.',
    invalid_register_captcha: 'Complete the security captcha.',
    invalid_email: 'Enter a valid email.',
    email_taken: 'That email is already registered.',
    email_required_for_withdrawal: 'Add your email before requesting withdrawals.',
    wallet_change_password_required: 'Confirm your password to change the saved wallet.',
    invalid_wallet_password: 'Incorrect password.',
    account_login_required: 'Log in again to continue.',
    account_disabled: 'This account was disabled by the administrator.',
    social_wait_required: 'Complete the required social wait before claiming.',
  },
  es: {
    installTitle: 'Instala FoxPay',
    installText: 'Acceso rapido y carga optimizada.',
    install: 'Instalar',
    updateReadyTitle: 'Nueva version disponible',
    updateReadyText: 'Actualiza FoxPay cuando termines lo que estas haciendo.',
    updateApp: 'Actualizar',
    updatingApp: 'Actualizando...',
    close: 'Cerrar',
    pullRefreshPull: 'Desliza para actualizar',
    pullRefreshRelease: 'Suelta para actualizar',
    pullRefreshRefreshing: 'Actualizando',
    capReached: 'Cap alcanzado: este pack ya completo {cap} USDT. Puedes retirar balance o comprar otro pack para reiniciar desde 0.',
    capInfo: 'Cap del pack: se suma tap, tareas, ranking y referidos/comisiones hasta {cap} USDT.',
    freeCapInfo: 'Límite único de retiro gratuito: {cap} USD. Adquiere un paquete para retiros ilimitados.',
    minerMaxOffline: 'Acumulación máxima: 3 horas fuera del juego',
    skinsLockedTitle: 'Skins Bloqueadas',
    skinsLockedDesc: 'El uso de Skins y la generación diaria de FOX real es una característica exclusiva para usuarios con un paquete de minería activo.',
    skinsLockedBtn: 'Adquirir Paquete',
    generatesUpTo: 'Genera hasta',
    packInfoTitle: 'Recuperacion del pack',
    packInfoTotal: 'Ganancia total de recuperacion',
    packInfoDaily: 'Ganancia diaria estimada',
    packInfoDailyNote: 'Calculado como recuperacion total dividida en 30 dias. La ganancia real depende de tareas diarias y energia usada.',
    buyAnotherPack: 'Compra otro pack',
    tomorrow: 'Vuelve manana',
    dailyTasks: 'Tareas diarias',
    unlockTasks: 'Desbloquear tareas',
    packages: 'Paquetes',
    usdtPacks: 'Packs USDT',
    capEnergy: 'Cap {cap} USDT / Energia {energy}',
    free: 'Gratis',
    daily: 'Diario',
    tasks: 'Tareas',
    loadingTasks: 'Cargando tareas...',
    capTasksBlocked: 'Cap alcanzado: tap, tareas, ranking y referidos ya no suman en este pack. Compra otro pack para reiniciar.',
    tasksDone: 'Tareas completadas. Vuelve manana.',
    taskLockedByCap: 'Bloqueado por cap del pack. Compra otro pack para volver a ganar.',
    optional: 'Opcional',
    required: 'Requerida',
    openYoutube: 'Abrir YouTube - volver tras {watch}s - valida +{delay}s',
    withdraw: 'Retiro',
    wallet: 'Wallet',
    foxWallet: 'FOX Wallet',
    walletBalance: 'Balance actual',
    walletHint: 'Tu wallet se conserva cuando inicias un pack nuevo.',
    currentPack: 'Pack actual',
    packProgress: 'Progreso del pack',
    generatedPack: 'Generado en este pack',
    recentActivity: 'Actividad reciente',
    noActivity: 'Aun no hay actividad.',
    allMovements: 'Todos',
    walletPurchases: 'Compras',
    walletCommissions: 'Comisiones',
    walletWithdrawals: 'Retiros',
    packPurchase: 'Compra de pack',
    pendingPayment: 'Pago pendiente',
    waitingPayment: 'Esperando pago',
    continuePayment: 'Continuar pago',
    checkingPayment: 'Verificando pago',
    paymentStillPending: 'Pago pendiente. Revisa Wallet.',
    pendingPackPayment: 'Pago pendiente',
    pendingPackHeld: '{count} FOX retenidos',
    cancelPayment: 'Cancelar pago',
    paymentCancelled: 'Pago cancelado. FOX liberado.',
    heldFox: 'FOX retenido',
    heldFoxText: 'FOX reservado por pagos pendientes.',
    notCompleted: 'No completado',
    foxUsed: 'FOX usado',
    usdtPaid: 'USDT pagado',
    noMovements: 'Sin movimientos en este filtro.',
    openWallet: 'Abrir wallet',
    buyPacks: 'Comprar packs',
    payUsdt: 'Pagar USDT',
    useFox: 'Usar FOX',
    chooseFoxPayment: 'Elegir monto FOX',
    foxWalletAvailable: 'Disponible en wallet',
    foxAmountToUse: 'FOX a usar',
    usdtToPay: 'USDT a pagar',
    minUsdtPayment: 'Los pagos parciales mantienen minimo {amount} USDT como pago real.',
    minFoxPayment: 'Minimo para usar FOX: {tokens} FOX.',
    payWithSelection: 'Pagar',
    generatingPayment: 'Generando pago...',
    allFoxAllowed: 'Puedes cubrir este pack completo con FOX.',
    allFoxPayment: '100% FOX',
    foxApplied: 'FOX wallet aplicado',
    payment: 'Pago',
    commission: 'Comision',
    seasonReward: 'Premio de temporada',
    seasonRewardMeta: 'Premio de ranking',
    seasonPrize: 'Pool de premios {count} FOX',
    seasonScheduledTitle: 'Temporada programada',
    seasonScheduledBody: 'Empieza {date}',
    seasonActiveBody: 'Ranking en progreso',
    seasonEndedTitle: 'Temporada finalizada',
    seasonEndedReview: 'Ganadores en revision',
    seasonPaidTitle: 'Temporada pagada',
    seasonPaidBody: 'Revisa tu FOX Wallet',
    seasonGeneralBody: 'La lista actual muestra el ranking general por wallet.',
    convertUsdt: 'Convertir a USDT',
    pendingApproval: 'Pendiente de aprobacion',
    requestWithdrawal: 'Solicitar retiro',
    withdrawalFeeNote: 'Cada retiro aprobado descuenta un fee del 20%.',
    capWithdrawNote: 'El cap del pack suma tap, tareas, ranking y referidos/comisiones. Al llegar al tope, solo puedes retirar balance disponible o comprar otro pack para reiniciar el ciclo.',
    pendingWithdrawalNote: 'Tienes un retiro pendiente de aprobacion. Espera aprobacion o rechazo antes de solicitar otro.',
    pendingWithdrawalShort: 'Espera aprobacion o rechazo.',
    withdrawalHistory: 'Historial de retiros',
    historyPage: 'Pagina {page} de {total}',
    previousPage: 'Anterior',
    nextPage: 'Siguiente',
    secureAccount: 'Cuenta segura',
    createAccount: 'Crear cuenta',
    username: 'Usuario',
    passwordMin: 'Contrasena min 6 caracteres',
    securityQuest: 'Mini reto de seguridad',
    tokenSelected: 'Token seleccionado',
    chooseToken: 'Elige un token para continuar',
    registerDevice: 'Registrar dispositivo',
    loginExisting: 'Entrar con cuenta',
    password: 'Contrasena',
    email: 'Correo',
    emailPlaceholder: 'Correo electronico',
    emailMissingTitle: 'Agrega tu correo',
    emailMissingText: 'Es requerido antes de retiros y ayuda a soporte.',
    saveEmail: 'Guardar correo',
    emailSaved: 'Correo guardado',
    sessionExpiredToast: 'Tu cuenta se abrio en otro dispositivo.',
    sessionExpiredTitle: 'Cuenta abierta en otro dispositivo',
    sessionExpiredText: 'Por seguridad, vuelve a iniciar sesion si quieres usarla aqui.',
    showPassword: 'Mostrar contrasena',
    hidePassword: 'Ocultar contrasena',
    login: 'Entrar',
    profile: 'Perfil',
    deviceAccount: 'Cuenta del dispositivo',
    registeredAccount: 'Cuenta registrada',
    readyWithdrawals: 'Lista para retiros',
    registerBeforeWithdrawals: 'Registrate antes de solicitar retiros',
    streakDays: 'Racha diaria',
    streakDaysText: 'Dias consecutivos de check-in',
    streakDaysValue: '{count}D',
    rankRulesTitle: 'Reglas de rangos',
    rankRulesSubtitle: 'Sube de nivel con referidos directos, volumen de organizacion y rangos del equipo.',
    currentRank: 'Rango actual',
    yourProgress: 'Tu progreso',
    directReferrals: 'Referidos directos',
    lifetimeEarned: 'Volumen organizacion',
    teamRequirement: 'Requisito de equipo',
    noRequirement: 'Sin requisito',
    noTeamRequirement: 'Sin requisito de equipo',
    noTeamNeeded: 'No requiere equipo',
    nextGoal: 'Tu proxima meta',
    allRanksReached: 'Todos los rangos logrados',
    missingIntro: 'Te falta',
    missingDirects: '{count} referidos directos',
    missingEarned: '{count} USDT de organizacion',
    missingTeam: '{count} {rank} en tu equipo',
    totalProgress: 'Progreso total',
    rankInProgress: 'En progreso',
    rankNotReached: 'Aun no alcanzado',
    rankUnlocked: 'Desbloqueado',
    readyRequirement: 'Listo',
    rankOrHigher: 'o superior',
    rankReached: 'Logrado',
    rankLocked: 'Bloqueado',
    country: 'Pais',
    countryPending: 'Pais pendiente por cabeceras del servidor',
    sponsor: 'Patrocinador',
    sponsorId: 'ID patrocinador',
    sponsorUsername: 'Usuario patrocinador',
    sponsorNone: 'Sin patrocinador',
    sponsorUnregistered: 'Cuenta aun no registrada',
    referralLink: 'Tu link de referido',
    shareInvite: 'Comparte este link con tus invitados.',
    copyLink: 'Copiar link',
    shareLink: 'Compartir link',
    referralBonus: 'Bono de referido',
    referralBonusText: '10% del valor del paquete referido, pagado en FOX y contado hacia tu cap.',
    projectInfo: 'Informacion del proyecto',
    projectInfoText: 'Lee la historia de FoxPay antes de usar recompensas, paquetes o retiros.',
    openStory: 'Historia FoxPay',
    openTerms: 'Terminos y condiciones',
    acceptTerms: 'He leido y acepto los terminos y condiciones.',
    readTerms: 'Leer terminos',
    termsRequired: 'Acepta los terminos y condiciones para crear tu cuenta.',
    friends: 'Amigos',
    referrals: 'Referidos',
    invited: '{count} invitados',
    activePackages: '{count} paquetes activos',
    copy: 'Copiar',
    bonusEst: 'Bono est.',
    usdtEst: 'USDT est.',
    earnings: 'Ganancias',
    earningsTitle: 'Niveles por pack',
    openEarnings: 'Ver ganancias y niveles',
    currentPlan: 'Pack actual',
    realCredited: 'Real acreditado',
    lostCapShort: 'Perdido por cap',
    infoEstimate: 'Estimado informativo',
    directEstimateText: 'Este estimado no es balance disponible. Lo real aparece en el historial de comisiones.',
    levelRules: 'Niveles por pack',
    levelRulesText: 'Tu pack activo define cuantos niveles cobras y el porcentaje de cada nivel.',
    levels: 'niveles',
    levelShort: 'L{level}',
    noLevel: 'Sin nivel',
    noActiveCommission: 'Este pack no tiene niveles de comision.',
    inviteLink: 'Tu link de invitacion',
    unilevelMap: 'Mapa unilevel',
    usersNetwork: '{count} usuarios en red',
    openNetwork: 'Abrir red visual',
    unknown: 'Desconocido',
    noNetwork: 'Sin red aun.',
    commissionHistory: 'Historial de comisiones',
    lostByCap: '{count} FOX perdidos por cap',
    credited: '{count} FOX acreditados',
    lost: '{count} FOX perdidos',
    noCommissions: 'Aun no hay comisiones.',
    foxPlayer: 'Jugador Fox',
    unknownCountry: 'Pais desconocido',
    noReferrals: 'Aun no hay referidos',
    shareTeam: 'Comparte tu link para empezar a construir tu equipo.',
    taskInviteFriends: 'Invita {count} amigos',
    taskInviteFriendsDesc: '{done}/{goal} referidos nuevos confirmados hoy.',
    taskInviteFriendsReady: 'Meta de referidos lista para confirmar.',
    referralTaskStepShare: 'Comparte tu link',
    referralTaskStepShareDesc: 'Envia tu link de invitacion a usuarios nuevos.',
    referralTaskStepWait: 'Espera nuevos ingresos',
    referralTaskStepWaitDesc: 'Cuentan cuando FoxPay crea su ID desde tu link.',
    referralTaskStepRegisterDesc: 'Cuentan cuando se registran con contrasena desde tu link.',
    referralTaskNotReady: 'Aun faltan {count} referidos.',
    networkMap: 'Mapa de red',
    back: 'Volver',
    you: 'Tu',
    noPlayers: 'Aun no hay jugadores',
    rankingFills: 'Este ranking se llenara cuando los usuarios califiquen.',
    leaderboard: 'Ranking',
    roulette: 'Ruleta',
    rouletteReady: 'Arena de giros',
    rouletteTickets: 'Tickets',
    rouletteSpin: 'Girar ruleta',
    rouletteNeedTicket: 'Completa tareas para ganar tickets de ruleta.',
    rouletteResult: 'Premio: {reward}',
    roulettePrizeTitle: 'Premio desbloqueado',
    rouletteNoPrizeTitle: 'Sigue intentando',
    roulettePrizeClose: 'Continuar',
    rouletteNoPrizeKeepTrying: 'Sigue intentando',
    rouletteNoPrizeThisTime: 'Sin premio',
    rouletteNoPrizeAlmost: 'Casi!',
    rouletteNoPrizeNextTime: 'Proxima',
    rouletteNoPrizeMiss: 'Fallaste',
    rouletteNoPrizeEmpty: 'Vacio',
    rouletteCost: 'Costo: {count} ticket',
    dailyTicketTitle: 'Ticket diario desbloqueado',
    dailyTicketBody: 'Completaste las tareas requeridas del dia y ganaste {count} ticket de ruleta.',
    dailyTicketUse: 'Usarlo en ruleta',
    dailyTicketStay: 'Quedarme aqui',
    skins: 'Skins',
    mySkins: 'Mis skins',
    activeSkins: 'Skins activas',
    noSkins: 'Aun no tienes skins',
    winSkinsRoulette: 'Gana skins en la ruleta para producir auto taps diarios.',
    selectSkin: 'Activar',
    selectedSkin: 'Activada',
    skinLimit: 'Puedes activar hasta 2 skins.',
    skinChangesNextClaim: 'Si ya reclamaste hoy, los cambios aplican al proximo cobro diario.',
    skinDaily: '+{count} FOX/dia',
    claimSkinTaps: 'Reclamar +{count} FOX',
    skinTapsReady: 'Tus skins produjeron {count} FOX hoy.',
    skinTapsClaimed: 'Auto taps de skin cobrados. Vuelve manana.',
    goSkins: 'Mis skins',
    skinClaimedToast: '+{count} FOX de skins',
    skinStore: 'Tienda de skins',
    skinShop: 'Tienda',
    skinInventory: 'Inventario',
    skinStoreLocked: 'La compra directa se desbloquea desde el Pack 60 USDT. Free y 30 USDT pueden ganar skins en ruleta.',
    buySkinUsdt: 'Comprar USDT',
    buySkinFox: 'Comprar FOX',
    skinRequiresPack: 'Requiere {pack}',
    skinCanGenerate: 'Puede generar {count} FOX/dia',
    ownedSkin: 'Comprada',
    confirmSkinFox: 'Confirma gastar {tokens} FOX por {name}.',
    skinPurchased: 'Skin desbloqueada',
    skinPurchasedInventory: 'Skin desbloqueada y activada.',
    insufficientTokens: 'FOX insuficientes.',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    backToEarn: 'Volver al inicio',
    goToTasks: 'Ir a Tareas',
    localMode: 'Modo local: API backend no conectada',
    totalCoins: 'Monedas totales',
    totalPlayer: 'Jugadores totales',
    season: 'TEMPORADA',
    ends: 'TERMINA',
    rankingOnly: 'Ranking general sin temporada activa',
    avatars: 'Avatares',
    selected: 'Seleccionado',
    use: 'Usar',
    premiumAvatar: 'Avatar premium',
    buyAvatarFox: 'FOX',
    buyAvatarUsdt: 'USDT',
    avatarPurchased: 'Avatar desbloqueado',
    usdtFrom: 'Pago USDT desde {amount}',
    navEarn: 'Ganar',
    navPacks: 'Packs',
    navTasks: 'Tareas',
    navRank: 'Rank',
    navFriends: 'Amigos',
    navCashout: 'Retiro',
    support: 'Soporte',
    supportCenter: 'Centro de soporte',
    supportProfileText: 'Envia un ticket y revisa respuestas del admin aqui.',
    contactSupport: 'Contactar soporte',
    supportMyTickets: 'Mis tickets',
    supportNewReply: 'nuevo',
    supportResponded: 'Respondido',
    supportOpen: 'Abierto',
    supportWaitingAdmin: 'Enviado',
    supportWaitingUser: 'Respondido',
    supportClosed: 'Cerrado',
    supportCategory: 'Categoria',
    supportMessage: 'Mensaje',
    supportImage: 'Imagen',
    supportImageOptional: 'Imagen opcional',
    supportImageHint: 'PNG, JPG o WebP hasta 10 MB. Se optimiza antes de enviar.',
    supportImageAttached: 'Imagen adjunta',
    supportImageProcessing: 'Optimizando imagen...',
    supportMessagePlaceholder: 'Escribe que paso con tu cuenta.',
    sendSupport: 'Enviar',
    supportReply: 'Responder',
    supportNoTickets: 'Aun no hay mensajes de soporte.',
    supportSent: 'Mensaje enviado',
    supportRead: 'Mensaje leido',
    supportWaitAdminReply: 'Soporte esta revisando tu mensaje. Podras responder cuando el admin conteste.',
    supportRateLimited: 'Espera un momento antes de enviar otro mensaje a soporte.',
    support_wait_admin_reply: 'Soporte esta revisando tu mensaje. Podras responder cuando el admin conteste.',
    support_rate_limited: 'Espera un momento antes de enviar otro mensaje a soporte.',
    support_daily_limited: 'Limite diario de soporte alcanzado. Intenta manana.',
    supportRateTitle: 'Califica este ticket',
    supportRatePrompt: 'Califica el ticket cerrado anterior antes de abrir uno nuevo.',
    supportRateSaved: 'Listo, ya puedes abrir otro ticket.',
    supportRateOpen: 'Abrir ticket',
    supportRating1: 'Muy mal',
    supportRating2: 'Mal',
    supportRating3: 'Regular',
    supportRating4: 'Bien',
    supportRating5: 'Excelente',
    support_message_too_short: 'Escribe al menos 10 caracteres.',
    support_image_invalid: 'No se pudo procesar la imagen. Intenta con otra imagen.',
    support_too_many_links: 'Envia menos enlaces en tu mensaje de soporte.',
    support_rating_required: 'Califica el ticket cerrado anterior antes de abrir uno nuevo.',
    blockedTitle: 'Acceso limitado',
    ipBlocked: 'Esta IP ya tiene una cuenta FoxPay activa.',
    deviceBlocked: 'Este dispositivo ya tiene una cuenta FoxPay activa.',
    accountDisabled: 'Esta cuenta fue desactivada por el administrador.',
    blockedHelp: 'Si crees que es un error, contacta al administrador.',
    taskDaily: 'Tarea diaria',
    taskTiming: 'Completa el tiempo requerido antes de validar la tarea.',
    taskCompleteReward: 'Completa esta tarea para marcar el check diario.',
    partnerTaskDesc: 'Completa la tarea del partner. FoxPay la validara automaticamente cuando llegue la confirmacion.',
    partnerOpen: 'Abrir tarea partner',
    partnerComplete: 'Completa la tarea en la app del partner.',
    partnerWait: 'Esperar verificacion',
    partnerWaitDesc: 'El check se marca solo cuando FoxPay recibe la confirmacion del partner.',
    partnerPendingToast: 'Tarea abierta. Esperando verificacion del partner.',
    continue: 'Continuar',
    openVideo: 'Abre el video',
    videoConfigured: 'Presiona Continuar, mira el video y vuelve para reclamar.',
    videoMissing: 'Este video aun no esta disponible.',
    watchTime: 'Tiempo de vista',
    stayVideo: 'Permanece en el video al menos {seconds} segundos.',
    returnFoxPay: 'Vuelve a FoxPay',
    waitReward: 'Vuelve y espera {seconds} segundos antes de validar el check.',
    openTask: 'Abre la tarea',
    visitSocial: 'Presiona Continuar y completa la accion social solicitada.',
    socialMissing: 'Esta tarea social aun no esta disponible.',
    completeIt: 'Completala',
    socialAction: 'Sigue la accion solicitada por la campana.',
    socialStay: 'Permanece en la pagina abierta al menos {seconds} segundos.',
    claimReward: 'Validar tarea',
    returnClaim: 'Vuelve a FoxPay para marcar esta tarea completada.',
    goEarn: 'Ve a Ganar',
    tapUntil: 'Toca hasta que tu contador diario llegue a la meta.',
    goal: 'Meta',
    completeCycle: 'Completa el ciclo diario de taps.',
    whenReady: 'Cuando este listo, continua para marcar la tarea completada.',
    dailyAction: 'Accion diaria',
    activateSession: 'Activa la sesion de hoy.',
    confirm: 'Confirmar',
    marksCompleted: 'Marca esta tarea diaria como completada.',
    reward: 'Ticket diario',
    continueClaim: 'Completa todas las tareas diarias para ganar 1 ticket de ruleta.',
    copied: 'Copiado',
    referralCopied: 'Link de referido copiado',
    referralShared: 'Link de referido listo',
    completeCaptcha: 'Completa el mini reto de seguridad',
    accountCreated: 'Cuenta creada',
    loggedIn: 'Sesion iniciada',
    installationUnavailable: 'Instalacion no disponible en este navegador',
    installing: 'Instalando FoxPay',
    installCanceled: 'Instalacion cancelada',
    installed: 'FoxPay instalado',
    paymentQr: 'QR de pago generado',
    freePackActivated: 'Pack gratis activado',
    withdrawalRequested: 'Retiro solicitado',
    invalidWallet: 'La direccion no coincide con la red seleccionada.',
    walletChangePassword: 'Contrasena',
    walletChangeNotice: 'Esto cambia tu wallet guardada de retiro. Confirma tu contrasena.',
    walletChangeTitle: 'Confirmar cambio de wallet',
    walletChangeBody: 'Por seguridad, ingresa tu contrasena antes de cambiar el destino guardado de retiro.',
    walletChangeConfirm: 'Confirmar',
    savedWithdrawalWallet: 'Wallet de retiro guardada',
    avatarUpdated: 'Avatar actualizado',
    capToast: 'Cap alcanzado. Compra otro pack para volver a ganar.',
    completeTasksFirst: 'Completa las tareas diarias primero',
    localTaskMarked: 'Modo local: tarea marcada',
    backendOffline: 'API backend no conectada',
    videoReturn: 'Vuelve en {seconds}s para validar',
    socialReturn: 'Vuelve despues de {seconds}s para validar',
    videoMissingSeconds: 'Aun faltan {seconds}s de video',
    videoReturnedEarly: 'Volviste antes de tiempo. Manten la tarea abierta hasta que termine el tiempo.',
    rewardIn: 'Validacion en {seconds}s',
    videoReadyToValidate: 'Listo para validar',
    validateShort: 'Validar',
    continueVideo: 'Continuar video',
    claimingReward: 'Validando tarea',
    videoClaimed: 'Tarea de video reclamada',
    socialClaimed: 'Tarea social reclamada',
    taskRewardAwarded: 'Tarea completada',
    dailyTicketAwarded: '+{count} ticket por completar las tareas diarias',
    taskCheckBadge: 'Reclamar',
    taskOpenBadge: 'Abrir',
    taskDoneBadge: 'Hecho',
    taskPendingBadge: 'Pendiente',
    finishActiveTask: 'Completa primero la tarea activa.',
    taskTicketHint: 'Completa todas las tareas diarias para ganar 1 ticket de ruleta.',
    payExact: 'Envia el monto exacto en la red seleccionada. FoxPay activa automaticamente despues de confirmar.',
    copyAmount: 'Copiar monto',
    copyAddress: 'Copiar direccion',
    pay: 'Paga {amount} USDT',
    paymentActivated: 'Paquete activado',
    avatarActivated: 'Avatar activado',
    paymentStatus: 'Pago {status}',
    registerCaptchaPrompt: 'Toca el token correcto',
    captchaFox: 'Toca la moneda FOX',
    captchaStar: 'Toca la estrella',
    captchaShield: 'Toca el escudo',
    captchaDiamond: 'Toca el diamante',
    taskDailyCheck: 'Check-in diario',
    taskDailyCheckDesc: 'Activa la sesion de hoy',
    taskTapGoal: 'Toca 100 veces',
    taskTapGoalDesc: 'Completa el ciclo diario de taps',
    taskWatchVideo: 'Ver video {number}',
    taskWatchVideoDesc: 'Mira al menos 30 segundos',
    taskVideoPending: 'Video pendiente de configurar',
    taskFollowChannel: 'Seguir canal',
    package_cap_reached: 'Cap del paquete alcanzado. Compra otro pack para iniciar un nuevo ciclo.',
    package_not_upgrade: 'Ya tienes activo un pack igual o superior.',
    activePack: 'Activo',
    lowerPack: 'Pack menor',
    daily_tasks_required: 'Completa el check-in diario y los videos antes de tapear.',
    energy_empty: 'La energia de hoy esta vacia.',
    insufficient_tokens: 'Balance insuficiente.',
    invalid_register_captcha: 'Completa el captcha de seguridad.',
    invalid_email: 'Ingresa un correo valido.',
    email_taken: 'Ese correo ya esta registrado.',
    email_required_for_withdrawal: 'Agrega tu correo antes de solicitar retiros.',
    wallet_change_password_required: 'Confirma tu contrasena para cambiar la wallet guardada.',
    invalid_wallet_password: 'Contrasena incorrecta.',
    account_login_required: 'Vuelve a iniciar sesion para continuar.',
    account_disabled: 'Esta cuenta fue desactivada por el administrador.',
    social_wait_required: 'Cumple la espera requerida de la tarea social antes de reclamar.',
  },
};

i18n.pt = {
  ...i18n.es,
  freeCapInfo: 'Limite único de saque gratuito: {cap} USD. Adquira um pacote para saques ilimitados.',
  minerMaxOffline: 'Acúmulo máximo: 3 horas fora do jogo',
  skinsLockedTitle: 'Skins Bloqueadas',
  skinsLockedDesc: 'O uso de Skins e a geração diária de FOX real é um recurso exclusivo para usuários com um pacote de mineração ativo.',
  skinsLockedBtn: 'Adquirir Pacote',
  installTitle: 'Instalar FoxPay',
  installText: 'Acesso rapido e carregamento otimizado.',
  install: 'Instalar',
  updateReadyTitle: 'Nova versao disponivel',
  updateReadyText: 'Atualize FoxPay quando terminar o que esta fazendo.',
  updateApp: 'Atualizar',
  updatingApp: 'Atualizando...',
  close: 'Fechar',
  pullRefreshPull: 'Puxe para atualizar',
  pullRefreshRelease: 'Solte para atualizar',
  pullRefreshRefreshing: 'Atualizando',
  generatesUpTo: 'Gera ate',
  packInfoTitle: 'Recuperacao do pack',
  packInfoTotal: 'Ganho total de recuperacao',
  packInfoDaily: 'Ganho diario estimado',
  packInfoDailyNote: 'Calculado como recuperacao total dividida em 30 dias. O ganho real depende das tarefas diarias e energia usada.',
  loadingTasks: 'Carregando tarefas...',
  secureAccount: 'Conta segura',
  createAccount: 'Criar conta',
  username: 'Usuario',
  passwordMin: 'Senha min 6 caracteres',
  securityQuest: 'Mini desafio de seguranca',
  tokenSelected: 'Token selecionado',
  chooseToken: 'Escolha um token para continuar',
  registerDevice: 'Registrar dispositivo',
  loginExisting: 'Entrar com conta',
  password: 'Senha',
  email: 'Email',
  emailPlaceholder: 'Endereco de email',
  emailMissingTitle: 'Adicione seu email',
  emailMissingText: 'Necessario antes de saques e util para suporte.',
  saveEmail: 'Salvar email',
  emailSaved: 'Email salvo',
  sessionExpiredToast: 'Sua conta foi aberta em outro dispositivo.',
  sessionExpiredTitle: 'Conta aberta em outro dispositivo',
  sessionExpiredText: 'Por seguranca, entre novamente se quiser usa-la aqui.',
  showPassword: 'Mostrar senha',
  hidePassword: 'Ocultar senha',
  login: 'Entrar',
  profile: 'Perfil',
  selected: 'Selecionado',
  use: 'Usar',
  premiumAvatar: 'Avatar premium',
  buyAvatarFox: 'FOX',
  buyAvatarUsdt: 'USDT',
  avatarPurchased: 'Avatar desbloqueado',
  skinPurchasedInventory: 'Skin desbloqueada e ativada.',
  usdtFrom: 'Pagamento USDT desde {amount}',
  deviceAccount: 'Conta do dispositivo',
  registeredAccount: 'Conta registrada',
  readyWithdrawals: 'Pronta para saques',
  registerBeforeWithdrawals: 'Registre-se antes de solicitar saques',
  streakDays: 'Sequencia diaria',
  streakDaysText: 'Dias consecutivos de check-in',
  streakDaysValue: '{count}D',
  rankRulesTitle: 'Regras de rank',
  rankRulesSubtitle: 'Suba de nivel com indicados diretos, volume da organizacao e ranks da equipe.',
  currentRank: 'Rank atual',
  yourProgress: 'Seu progresso',
  directReferrals: 'Indicados diretos',
  lifetimeEarned: 'Volume organizacao',
  teamRequirement: 'Requisito de equipe',
  noRequirement: 'Sem requisito',
  noTeamRequirement: 'Sem requisito de equipe',
  noTeamNeeded: 'Nao requer equipe',
  nextGoal: 'Sua proxima meta',
  allRanksReached: 'Todos os ranks alcancados',
  missingIntro: 'Falta',
  missingDirects: '{count} indicados diretos',
  missingEarned: '{count} USDT de organizacao',
  missingTeam: '{count} {rank} na sua equipe',
  totalProgress: 'Progresso total',
  rankInProgress: 'Em progresso',
  rankNotReached: 'Ainda nao alcancado',
  rankUnlocked: 'Desbloqueado',
  readyRequirement: 'Pronto',
  rankOrHigher: 'ou superior',
  rankReached: 'Alcancado',
  rankLocked: 'Bloqueado',
  withdrawalHistory: 'Historico de saques',
  historyPage: 'Pagina {page} de {total}',
  previousPage: 'Anterior',
  nextPage: 'Proxima',
  country: 'Pais',
  countryPending: 'Pais pendente pelos cabecalhos do servidor',
  sponsor: 'Patrocinador',
  sponsorId: 'ID do patrocinador',
  sponsorUsername: 'Usuario do patrocinador',
  sponsorNone: 'Sem patrocinador',
  sponsorUnregistered: 'Conta ainda nao registrada',
  projectInfo: 'Informacoes do projeto',
  projectInfoText: 'Leia a historia da FoxPay antes de usar recompensas, pacotes ou saques.',
  openStory: 'Historia FoxPay',
  openTerms: 'Termos e condicoes',
  acceptTerms: 'Li e aceito os termos e condicoes.',
  readTerms: 'Ler termos',
  termsRequired: 'Aceite os termos e condicoes para criar sua conta.',
  wallet: 'Carteira',
  foxWallet: 'Carteira FOX',
  walletBalance: 'Balanco atual',
  walletHint: 'Sua carteira continua quando voce inicia um novo pack.',
  currentPack: 'Pack atual',
  packProgress: 'Progresso do pack',
  generatedPack: 'Gerado neste pack',
  recentActivity: 'Atividade recente',
  noActivity: 'Ainda nao ha atividade.',
  allMovements: 'Todos',
  walletPurchases: 'Compras',
  walletCommissions: 'Comissoes',
  walletWithdrawals: 'Saques',
  packPurchase: 'Compra de pack',
  pendingPayment: 'Pagamento pendente',
  waitingPayment: 'Aguardando pagamento',
  continuePayment: 'Continuar pagamento',
  checkingPayment: 'Verificando pagamento',
  paymentStillPending: 'Pagamento pendente. Veja a Carteira.',
  pendingPackPayment: 'Pagamento pendente',
  pendingPackHeld: '{count} FOX retidos',
  cancelPayment: 'Cancelar pagamento',
  paymentCancelled: 'Pagamento cancelado. FOX liberado.',
  heldFox: 'FOX retido',
  heldFoxText: 'FOX reservado por pagamentos pendentes.',
  notCompleted: 'Nao concluido',
  foxUsed: 'FOX usado',
  usdtPaid: 'USDT pago',
  noMovements: 'Sem movimentos neste filtro.',
  openWallet: 'Abrir carteira',
  buyPacks: 'Comprar packs',
  payUsdt: 'Pagar USDT',
  useFox: 'Usar FOX',
  chooseFoxPayment: 'Escolher valor FOX',
  foxWalletAvailable: 'Disponivel na carteira',
  foxAmountToUse: 'FOX a usar',
  usdtToPay: 'USDT a pagar',
  minUsdtPayment: 'Pagamentos parciais mantem no minimo {amount} USDT como pagamento real.',
  minFoxPayment: 'Minimo para usar FOX: {tokens} FOX.',
  payWithSelection: 'Pagar',
  generatingPayment: 'Gerando pagamento...',
  allFoxAllowed: 'Voce pode cobrir este pack inteiro com FOX.',
  allFoxPayment: '100% FOX',
  foxApplied: 'Carteira FOX aplicada',
  payment: 'Pagamento',
  commission: 'Comissao',
  seasonReward: 'Premio da temporada',
  seasonRewardMeta: 'Premio do ranking',
  seasonPrize: 'Pool de premios {count} FOX',
  seasonScheduledTitle: 'Temporada programada',
  seasonScheduledBody: 'Comeca {date}',
  seasonActiveBody: 'Ranking em andamento',
  seasonEndedTitle: 'Temporada finalizada',
  seasonEndedReview: 'Vencedores em revisao',
  seasonPaidTitle: 'Temporada paga',
  seasonPaidBody: 'Veja sua Carteira FOX',
  seasonGeneralBody: 'A lista atual mostra o ranking geral da carteira.',
  referralLink: 'Seu link de indicacao',
  shareInvite: 'Compartilhe este link com seus convidados.',
  copyLink: 'Copiar link',
  referralBonus: 'Bonus de indicacao',
  referralBonusText: '10% do valor do pacote indicado, pago em FOX e contado no seu limite.',
  earnings: 'Ganhos',
  earningsTitle: 'Niveis por pack',
  openEarnings: 'Ver ganhos e niveis',
  currentPlan: 'Pack atual',
  realCredited: 'Real creditado',
  lostCapShort: 'Perdido por limite',
  infoEstimate: 'Estimativa informativa',
  directEstimateText: 'Esta estimativa nao e balance disponivel. Os creditos reais aparecem no historico de comissoes.',
  levelRules: 'Niveis por pack',
  levelRulesText: 'Seu pack ativo define quantos niveis voce recebe e o percentual de cada nivel.',
  levels: 'niveis',
  levelShort: 'L{level}',
  noLevel: 'Sem nivel',
  noActiveCommission: 'Este pack nao tem niveis de comissao.',
  navEarn: 'Ganhar',
  navPacks: 'Packs',
  navTasks: 'Tarefas',
  navRank: 'Rank',
  navFriends: 'Amigos',
  navCashout: 'Saque',
  support: 'Suporte',
  supportCenter: 'Central de suporte',
  supportProfileText: 'Envie um ticket e veja respostas do admin aqui.',
  contactSupport: 'Contatar suporte',
  supportMyTickets: 'Meus tickets',
  supportNewReply: 'novo',
  supportResponded: 'Respondido',
  supportOpen: 'Aberto',
  supportWaitingAdmin: 'Enviado',
  supportWaitingUser: 'Respondido',
  supportClosed: 'Fechado',
  supportCategory: 'Categoria',
  supportMessage: 'Mensagem',
  supportImage: 'Imagem',
  supportImageOptional: 'Imagem opcional',
  supportImageHint: 'PNG, JPG ou WebP ate 10 MB. Sera otimizada antes de enviar.',
  supportImageAttached: 'Imagem anexada',
  supportImageProcessing: 'Otimizando imagem...',
  supportMessagePlaceholder: 'Escreva o que aconteceu com sua conta.',
  sendSupport: 'Enviar',
  supportReply: 'Responder',
  supportNoTickets: 'Ainda nao ha mensagens de suporte.',
  supportSent: 'Mensagem enviada',
  supportRead: 'Mensagem lida',
  supportWaitAdminReply: 'O suporte esta analisando sua mensagem. Voce podera responder quando o admin responder.',
  supportRateLimited: 'Aguarde um momento antes de enviar outra mensagem.',
  support_wait_admin_reply: 'O suporte esta analisando sua mensagem. Voce podera responder quando o admin responder.',
  support_rate_limited: 'Aguarde um momento antes de enviar outra mensagem.',
  support_daily_limited: 'Limite diario de suporte atingido. Tente amanha.',
  supportRateTitle: 'Avalie este ticket',
  supportRatePrompt: 'Avalie o ticket fechado anterior antes de abrir um novo.',
  supportRateSaved: 'Obrigado, agora voce pode abrir outro ticket.',
  supportRateOpen: 'Abrir ticket',
  supportRating1: 'Muito ruim',
  supportRating2: 'Ruim',
  supportRating3: 'Regular',
  supportRating4: 'Bom',
  supportRating5: 'Excelente',
  support_message_too_short: 'Escreva pelo menos 10 caracteres.',
  support_image_invalid: 'Nao foi possivel processar a imagem. Tente outra imagem.',
  support_too_many_links: 'Envie menos links na mensagem.',
  support_rating_required: 'Avalie o ticket fechado anterior antes de abrir um novo.',
  withdrawalFeeNote: 'Cada saque aprovado desconta uma taxa de 20%.',
  invalidWallet: 'Endereco invalido para a rede selecionada.',
  walletChangePassword: 'Senha',
  walletChangeNotice: 'Isto altera sua carteira salva de saque. Confirme sua senha.',
  walletChangeTitle: 'Confirmar alteracao da carteira',
  walletChangeBody: 'Por seguranca, digite sua senha antes de alterar o destino salvo de saque.',
  walletChangeConfirm: 'Confirmar',
  savedWithdrawalWallet: 'Carteira de saque salva',
  copied: 'Copiado',
  referralCopied: 'Link de indicacao copiado',
  completeCaptcha: 'Complete o mini desafio de seguranca',
  accountCreated: 'Conta criada',
  loggedIn: 'Sessao iniciada',
  videoReturn: 'Volte em {seconds}s para validar',
  socialReturn: 'Volte depois de {seconds}s para validar',
  videoMissingSeconds: 'Ainda faltam {seconds}s de video',
  videoReturnedEarly: 'Voce voltou cedo. Mantenha a tarefa aberta ate o tempo terminar.',
  rewardIn: 'Validacao em {seconds}s',
  videoReadyToValidate: 'Pronto para validar',
  validateShort: 'Validar',
  continueVideo: 'Continuar video',
  claimingReward: 'Validando tarefa',
  videoClaimed: 'Tarefa de video reivindicada',
  socialClaimed: 'Tarefa social reivindicada',
  taskRewardAwarded: 'Tarefa concluida',
  dailyTicketAwarded: '+{count} ticket por concluir as tarefas diarias',
  taskCheckBadge: 'Resgatar',
  taskOpenBadge: 'Abrir',
  taskDoneBadge: 'Feito',
  taskPendingBadge: 'Pendente',
  finishActiveTask: 'Conclua primeiro a tarefa ativa.',
  package_not_upgrade: 'Voce ja tem um pack igual ou superior ativo.',
  wallet_change_password_required: 'Confirme sua senha para alterar a carteira salva.',
  invalid_email: 'Digite um email valido.',
  email_taken: 'Esse email ja esta registrado.',
  email_required_for_withdrawal: 'Adicione seu email antes de solicitar saques.',
  insufficient_tokens: 'Saldo insuficiente.',
  activePack: 'Ativo',
  lowerPack: 'Pack menor',
};

function tr(key, values = {}) {
  const text = i18n[appLang]?.[key] || i18n.en[key] || key;
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, value), text);
}

function localizedError(data = {}) {
  const key = data.error || data.message || 'request_failed';
  return i18n[appLang]?.[key] || i18n.en[key] || data.message || data.error || 'FoxPay request failed';
}

function taskNumber(task) {
  return String(task?.id || '').match(/_(\d+)$/)?.[1] || '';
}

function taskTitleText(task) {
  if (task.id === 'daily_check') return tr('taskDailyCheck');
  if (task.id === 'tap_goal') return tr('taskTapGoal');
  if (task.type === 'referral') return tr('taskInviteFriends', { count: fmt(task.goal || 1, 0) });
  if (task.type === 'youtube') return tr('taskWatchVideo', { number: taskNumber(task) || '1' });
  if (task.type === 'partner') return task.title || tr('partnerOpen');
  if (String(task.title || '').toLowerCase().includes('seguir canal')) return tr('taskFollowChannel');
  return task.title || tr('taskDaily');
}

function taskDescriptionText(task) {
  if (task.id === 'daily_check') return tr('taskDailyCheckDesc');
  if (task.id === 'tap_goal') return tr('taskTapGoalDesc');
  if (task.type === 'referral') {
    if (task.ready) return tr('taskInviteFriendsReady');
    return tr('taskInviteFriendsDesc', { done: fmt(task.progress || 0, 0), goal: fmt(task.goal || 1, 0) });
  }
  if (task.type === 'youtube') return task.url ? tr('taskWatchVideoDesc') : tr('taskVideoPending');
  if (task.type === 'partner') return task.description || tr('partnerTaskDesc');
  if (!task.description) return task.required === false ? tr('optional') : tr('required');
  return task.description;
}

function taskRewardToast(data = {}, task = {}) {
  const tickets = Number(data.earned_tickets || 0);
  const points = Number(data.earned_points || 0);
  const parts = [tr('taskRewardAwarded')];
  if (points > 0) {
    parts.push(`+${fmt(points)} GFOX`);
  }
  if (tickets > 0) {
    parts.push(tr('dailyTicketAwarded', { count: fmt(tickets, 0) }));
    dailyTicketReward = { tickets };
  }
  if (tickets > 0 || points > 0) render();
  toast(parts.join(' · '));
}

function captchaPromptText(prompt = '') {
  const value = String(prompt || '').toLowerCase();
  if (value.includes('fox')) return tr('captchaFox');
  if (value.includes('star')) return tr('captchaStar');
  if (value.includes('shield')) return tr('captchaShield');
  if (value.includes('diamond')) return tr('captchaDiamond');
  return tr('registerCaptchaPrompt');
}

function readVideoProgress() {
  try {
    return JSON.parse(localStorage.getItem(videoProgressStorage) || '{}');
  } catch {
    return {};
  }
}

// write video progress
function writeVideoProgress(progress) {
  localStorage.setItem(videoProgressStorage, JSON.stringify(progress));
}

function getVideoProgress(taskId) {
  return readVideoProgress()[videoProgressKey(taskId)] || null;
}

function setVideoProgress(taskId, value) {
  const progress = readVideoProgress();
  progress[videoProgressKey(taskId)] = value;
  writeVideoProgress(progress);
}

function clearVideoProgress(taskId) {
  const progress = readVideoProgress();
  delete progress[videoProgressKey(taskId)];
  writeVideoProgress(progress);
}

function clearAllVideoProgress() {
  localStorage.removeItem(videoProgressStorage);
}

function videoProgressState(task) {
  const progress = getVideoProgress(task.id);
  if (!progress) {
    return {
      progress: null,
      phase: 'idle',
      remainingWatch: 0,
      remainingClaim: 0,
      label: '',
    };
  }
  const waitSeconds = task.type === 'social' ? Number(task.wait_seconds || 15) : Number(task.watch_seconds || 30);
  const watchMs = Math.max(1, waitSeconds) * 1000;
  const savedMs = Math.max(0, Number(progress.watched_seconds || 0) * 1000);
  if (!progress.opened_at) {
    const remainingPaused = Math.max(0, Math.ceil((watchMs - savedMs) / 1000));
    return {
      progress,
      phase: remainingPaused > 0 ? 'paused' : 'ready',
      remainingWatch: remainingPaused,
      remainingClaim: 0,
      label: remainingPaused > 0
        ? tr('videoMissingSeconds', { seconds: fmt(remainingPaused, 0) })
        : tr('videoReadyToValidate'),
    };
  }
  const now = Date.now();
  const elapsed = savedMs + Math.max(0, now - Number(progress.opened_at || 0));
  const remainingWatch = Math.max(0, Math.ceil((watchMs - elapsed) / 1000));
  if (remainingWatch > 0) {
    return {
      progress,
      phase: 'watching',
      remainingWatch,
      remainingClaim: 0,
      label: tr('videoMissingSeconds', { seconds: fmt(remainingWatch, 0) }),
    };
  }
  const claimAfter = Number(progress.claim_after || 0);
  const remainingClaim = Math.max(0, Math.ceil((claimAfter - now) / 1000));
  if (claimAfter && remainingClaim > 0) {
    return {
      progress,
      phase: 'waiting',
      remainingWatch: 0,
      remainingClaim,
      label: tr('rewardIn', { seconds: fmt(remainingClaim, 0) }),
    };
  }
  return {
    progress,
    phase: 'ready',
    remainingWatch: 0,
    remainingClaim: 0,
    label: tr('videoReadyToValidate'),
  };
}

function videoCountdownText(state) {
  if (!state) return '';
  const seconds = state.phase === 'watching' ? state.remainingWatch : state.remainingClaim;
  return `${fmt(seconds, 0)}s`;
}

function videoProgressBadge(task, state = null) {
  state = state || (['youtube', 'social'].includes(task.type) ? videoProgressState(task) : null);
  if (!state?.progress) return '';
  if (state.phase === 'ready') return `${icon('ph:check-circle-bold')} ${tr('validateShort')}`;
  if (state.phase === 'paused') return `${icon('ph:play-circle-bold')} ${tr('continueVideo')}`;
  return `${icon('ph:timer-bold')} <span data-task-progress-countdown>${videoCountdownText(state)}</span>`;
}

function taskDefaultBadge(task, blocked = false) {
  if (task.claimed) return `${icon('ph:check-fat-fill')} ${tr('taskDoneBadge')}`;
  if (task.type === 'referral') {
    if (task.ready) return `${icon('ph:check-circle-bold')} ${tr('taskCheckBadge')}`;
    return `${icon('ph:users-three-bold')} ${fmt(task.progress || 0, 0)}/${fmt(task.goal || 1, 0)}`;
  }
  if (blocked || !task.ready) return `${icon('ph:clock-countdown-bold')} ${tr('taskPendingBadge')}`;
  if (task.type === 'partner') return `${icon('ph:link-simple-bold')} ${tr('taskOpenBadge')}`;
  if (['youtube', 'social'].includes(task.type)) return `${icon('ph:play-circle-bold')} ${tr('taskOpenBadge')}`;
  return `${icon('ph:check-circle-bold')} ${tr('taskCheckBadge')}`;
}

function setTaskBadgeHtml(badge, html, mode) {
  if (!badge || badge.dataset.badgeMode === mode) return;
  badge.dataset.badgeMode = mode;
  badge.innerHTML = html;
}

function updateVideoProgressNodes() {
  if (!dashboard) return;
  taskList().forEach((task) => {
    if (!['youtube', 'social'].includes(task.type)) return;
    const state = videoProgressState(task);
    const taskSelector = window.CSS?.escape ? CSS.escape(String(task.id)) : String(task.id).replace(/["\\]/g, '\\$&');
    const row = document.querySelector(`[data-task-row="${taskSelector}"]`);
    if (row) {
      const description = row.querySelector('[data-task-progress-description]');
      const badge = row.querySelector('[data-task-progress-badge]');
      row.classList.toggle('task-row--progress', Boolean(state.progress));
      if (description) {
        description.textContent = state.progress
          ? state.label
          : (task.type === 'youtube' && task.url ? tr('openYoutube', { watch: fmt(task.watch_seconds || 30), delay: fmt(task.reward_delay_seconds ?? 30) }) : taskDescriptionText(task));
      }
      if (badge) {
        badge.classList.toggle('task-check-badge--progress', Boolean(state.progress));
        if (state.phase === 'watching' || state.phase === 'waiting') {
          const counter = badge.querySelector('[data-task-progress-countdown]');
          if (counter) {
            counter.textContent = videoCountdownText(state);
          } else {
            setTaskBadgeHtml(badge, videoProgressBadge(task, state), `progress:${state.phase}`);
          }
        } else {
          setTaskBadgeHtml(
            badge,
            videoProgressBadge(task, state) || taskDefaultBadge(task, packageCapReached()),
            state.progress ? `progress:${state.phase}` : `default:${task.claimed}:${task.ready}`,
          );
        }
      }
    }
    if (pendingTaskId === task.id) {
      const description = document.querySelector('[data-task-modal-description]');
      const button = document.querySelector('[data-task-modal-continue]');
      const locked = state.phase === 'watching' || state.phase === 'waiting';
      const actionLabel = state.progress
        ? (state.phase === 'ready' ? tr('videoReadyToValidate') : (state.phase === 'paused' ? tr('continueVideo') : state.label))
        : tr('continue');
      if (description) description.textContent = state.progress ? state.label : description.textContent;
      if (button) {
        button.textContent = actionLabel;
        button.disabled = task.claimed || !task.ready || locked;
        button.classList.toggle('task-modal-continue--progress', Boolean(state.progress));
      }
    }
  });
}

function hasPendingVideoProgress() {
  return Boolean(taskList().find((task) => ['youtube', 'social'].includes(task.type) && !task.claimed && getVideoProgress(task.id)));
}

function activeExternalTaskLock() {
  if (!dashboard) return null;
  return taskList().find((task) => ['youtube', 'social'].includes(task.type) && !task.claimed && getVideoProgress(task.id)) || null;
}

function taskBlockedByActiveTask(taskId) {
  const lockedTask = activeExternalTaskLock();
  return Boolean(lockedTask && lockedTask.id !== taskId);
}

function syncVideoProgressUiTimer() {
  if (videoProgressUiTimer) {
    window.clearInterval(videoProgressUiTimer);
    videoProgressUiTimer = null;
  }
  if (!dashboard || !hasPendingVideoProgress()) return;
  videoProgressUiTimer = window.setInterval(() => {
    if (!dashboard || document.hidden) return;
    const liveProgress = taskList().some((task) => {
      const state = ['youtube', 'social'].includes(task.type) ? videoProgressState(task) : null;
      return state?.phase === 'watching' || state?.phase === 'waiting';
    });
    if (liveProgress && (activeView === 'tasks' || pendingTaskId)) updateVideoProgressNodes();
  }, 1000);
}

function youtubeVideoId(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || '';
  } catch {}
  return '';
}

function youtubeMobileUrl(url) {
  const target = String(url || '').trim();
  const id = youtubeVideoId(target);
  if (!id) return target;
  if (isAndroidDevice) {
    return `intent://www.youtube.com/watch?v=${encodeURIComponent(id)}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(target)};end`;
  }
  if (isIosDevice) return `youtube://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  return target;
}

function resolveExternalTaskUrl(url) {
  const encodedPlayerId = encodeURIComponent(playerId || '');
  return String(url || '').trim()
    .replaceAll('{USER_ID}', encodedPlayerId)
    .replaceAll('[USER_ID]', encodedPlayerId)
    .replaceAll('{user_id}', encodedPlayerId)
    .replaceAll('{subId}', encodedPlayerId);
}

function openExternalTaskUrl(url) {
  const target = resolveExternalTaskUrl(url);
  if (!target) return false;
  if (isMobileDevice) {
    window.location.href = youtubeMobileUrl(target);
    return true;
  }
  window.open(target, '_blank', 'noopener');
  return true;
}

async function shareReferralLink() {
  const link = dashboard?.player?.referral_link || `https://foxpay.live/?ref=${playerId}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'FoxPay', text: tr('shareInvite'), url: link });
      toast(tr('referralShared'));
      return;
    }
  } catch {
    // Fall back to copying when native share is cancelled or unavailable.
  }
  await navigator.clipboard?.writeText(link);
  toast(tr('referralCopied'));
}

function touchDistance(touches) {
  if (!touches || touches.length < 2) return 0;
  const left = touches[0];
  const right = touches[1];
  return Math.hypot(left.clientX - right.clientX, left.clientY - right.clientY);
}

let playerId = localStorage.getItem(playerKey);
if (!playerId) {
  playerId = createPlayerId();
  localStorage.setItem(playerKey, playerId);
}
let accountToken = localStorage.getItem(accountTokenKey) || '';
let deviceKey = localStorage.getItem(deviceKeyStorage) || '';

const ref = new URLSearchParams(location.search).get('ref') || '';
let dashboard = null;
function viewFromHash() {
  const hash = String(window.location.hash || '').replace(/^#/, '').toLowerCase();
  const hashViews = {
    game: 'earn',
    play: 'earn',
    earn: 'earn',
    wallet: 'wallet',
    packs: 'packs',
    package: 'packs',
    packages: 'packs',
    tasks: 'tasks',
    task: 'tasks',
    profile: 'profile',
    login: 'profile',
    support: 'support',
    soporte: 'support',
    avatars: 'avatars',
    avatar: 'avatars',
    leaderboard: 'leaderboard',
    rank: 'leaderboard',
    ranks: 'leaderboard',
  };
  return hashViews[hash] || 'earn';
}

let activeView = viewFromHash();
let activeMinerTab = 'marketing';
let leaderboardMode = 'premium';
let busy = false;
let activeVideoTask = null;
let videoTimer = null;
let videoProgressUiTimer = null;
let videoClaimInFlight = false;
let paymentNetwork = 'bep20';
let currentPayment = null;
let paymentPollTimer = null;
let paymentCountdownTimer = null;
let paymentExpiryPollInFlight = false;
let pendingPaymentExpiryTimer = null;
let seasonCountdownTimer = null;
let dashboardRefreshTimer = null;
let queuedTaps = 0;
let tapInFlight = false;
let tapFlushTimer = null;
let pendingTaskId = '';
let lastRouletteSpin = null;
let dailyTicketReward = null;
let roulettePrizeReward = null;
let skinPreviewId = '';
let skinsTab = 'shop';
let packsTab = 'miner';
let pendingSkinFoxPurchase = null;
let skinFoxError = '';
let pendingPackageFoxPurchase = null;
let packInfoId = '';
let pendingWithdrawalChange = null;
let pendingWithdrawalNotice = false;
let packageFoxPaymentInFlight = false;
let rouletteSpinCount = 0;
let showCapInfo = false;
let supportSelectedTicketId = '';
let rankRulesOpen = false;
let rankImagePreview = null;
let dismissedSkinClaimKey = localStorage.getItem(skinClaimDismissStorage) || '';
let loadingProgress = 8;
let loadingTimer = null;
let networkZoom = 1;
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let pullRefreshStartY = 0;
let pullRefreshStartX = 0;
let pullRefreshDistance = 0;
let pullRefreshTracking = false;
let pullRefreshActive = false;
let pullRefreshRefreshing = false;
let walletHistoryFilter = 'all';
let withdrawHistoryPage = 1;
let deferredInstallPrompt = null;
let canInstallPwa = false;
let installBannerDismissed = false;
let swUpdateRegistration = null;
let swUpdateReady = false;
let swApplyingUpdate = false;
const refreshingExpiredPayments = new Set();
const watchedServiceWorkerRegistrations = new WeakSet();
const preloadedAvatarImages = new Set();
const isAndroidDevice = /Android/i.test(navigator.userAgent || '');
const isIosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobileDevice = isAndroidDevice || isIosDevice || /Mobile/i.test(navigator.userAgent || '');
const isStandalonePwa = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const registerCaptcha = {
  selected: '',
};
let registerTermsAccepted = false;
let sessionExpiredNoticeShown = false;

function registerCaptchaOptions() {
  return (dashboard?.register_captcha?.options || []).map((item) => ({
    ...item,
    icon: item.icon === 'fox-coin' ? coinIcon('captcha-coin-img') : icon(item.icon),
  }));
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch {
        // The browser may already have decoded the image by onload.
      }
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function preloadCriticalAssets() {
  const avatarUrl = dashboard?.player?.avatar_url || foxImage;
  const critical = new Set([
    foxImage,
    coinImage,
    avatarUrl,
    './images/bakground.jpg',
    './images/icons/icons card/iconos_10.png',
    './images/icons/icons card/iconos_05.png',
    './images/icons/icons card/iconos_07.png',
    './images/icons/icons card/iconos_03.png',
    './images/icons/icons card/reloj.png',
    './images/icons/icons card/exchange.png',
  ]);
  await Promise.all([...critical].map(preloadImage));
}

async function api(path, body = null) {
  const options = body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {};
  const response = await fetch(path, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Backend API is not returning JSON');
    }
  }
  if (!data) {
    throw new Error('Backend API is not connected');
  }
  if (!response.ok || data.ok === false) {
    const error = new Error(localizedError(data));
    error.data = data;
    error.code = data.error || data.message || '';
    throw error;
  }
  return data;
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  app.appendChild(node);
  setTimeout(() => node.remove(), 1800);
}

function resizeSupportImageToWebp(file, maxWidth = 960, maxHeight = 960, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type || '')) return reject(new Error(tr('support_image_invalid')));
    if (file.size > 10 * 1024 * 1024) return reject(new Error(tr('support_image_invalid')));
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(image.src);
      const dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp;base64,') || dataUrl.length > 350000) {
        reject(new Error(tr('support_image_invalid')));
        return;
      }
      resolve(dataUrl);
    };
    image.onerror = () => reject(new Error(tr('support_image_invalid')));
    image.src = URL.createObjectURL(file);
  });
}

function storeAccountTokenFromResponse(data = {}) {
  if (!data.account_token) return;
  accountToken = data.account_token;
  localStorage.setItem(accountTokenKey, accountToken);
  sessionExpiredNoticeShown = false;
}

function handleSessionState(nextDashboard = dashboard) {
  if (!nextDashboard?.player?.is_registered || nextDashboard.session_valid !== false) return;
  if (accountToken) {
    localStorage.removeItem(accountTokenKey);
    accountToken = '';
  }
  activeView = 'profile';
  if (!sessionExpiredNoticeShown) {
    sessionExpiredNoticeShown = true;
    toast(tr('sessionExpiredToast'));
  }
}

function tokenUsd(tokens) {
  return Number(tokens || 0) * Number(dashboard?.settings?.token_price_usd || 0.0001);
}

function rewardUsdtText(tokens) {
  const value = tokenUsd(tokens);
  const digits = value > 0 && value < 0.01 ? 6 : 2;
  return `${fmt(value, digits)} USDT`;
}

function syncMaintenanceResetState(nextDashboard) {
  const version = String(nextDashboard?.maintenance_reset?.version || '');
  if (!version) return;
  const storedVersion = localStorage.getItem(maintenanceResetStorage) || '';
  if (storedVersion === version) return;
  localStorage.setItem(maintenanceResetStorage, version);
  clearAllVideoProgress();
  pendingTaskId = '';
  activeVideoTask = null;
  if (videoTimer) {
    window.clearTimeout(videoTimer);
    videoTimer = null;
  }
  if (videoProgressUiTimer) {
    window.clearInterval(videoProgressUiTimer);
    videoProgressUiTimer = null;
  }
}

function updateDashboard(next, options = {}) {
  if (next?.dashboard) {
    dashboard = next.dashboard;
  } else if (next?.player) {
    dashboard = next;
  }
  handleSessionState(dashboard);
  syncMaintenanceResetState(dashboard);
  scheduleExpiredPendingPaymentsRefresh();
  if (next?.spin) {
    lastRouletteSpin = next.spin;
  }
  if (options.skipRender) return;
  render();
  scheduleAvatarPreload();
}

function preloadAvatarImages() {
  (dashboard?.avatars || []).forEach((avatar) => {
    const url = avatar?.image_url || '';
    if (!url || preloadedAvatarImages.has(url)) return;
    preloadedAvatarImages.add(url);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  });
}

function scheduleAvatarPreload() {
  if (!dashboard?.avatars?.length) return;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadAvatarImages, { timeout: 1800 });
    return;
  }
  window.setTimeout(preloadAvatarImages, 250);
}

function cryptoNetworkSelector() {
  return `
    <div class="crypto-network-select">
      ${paymentNetworks.map(([value, label]) => `
        <button class="${paymentNetwork === value ? 'active' : ''}" type="button" data-pay-network="${value}">
          ${networkButtonContent(value, label)}
        </button>
      `).join('')}
    </div>
  `;
}

function paymentOverlay() {
  if (!currentPayment) return '';
  const seconds = paymentSecondsLeft(currentPayment);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `
    <section class="payment-overlay" role="dialog" aria-modal="true">
      <article class="payment-sheet">
        <button class="payment-close" type="button" data-action="payment-close" aria-label="Close">${icon('ph:x-bold')}</button>
        <span class="payment-network">${networkIcon(currentPayment.network)} ${currentPayment.network?.toUpperCase() || 'USDT'}</span>
        <h2>${tr('pay', { amount: fmt(currentPayment.amount_usdt, 2) })}</h2>
        <div class="payment-qr">
          ${currentPayment.qr_url ? `<img src="${currentPayment.qr_url}" alt="Payment QR" />` : icon('ph:qr-code-bold')}
        </div>
        <div class="payment-lines">
          <article class="payment-copy-row">
            <small>Amount</small>
            <strong>${fmt(currentPayment.pay_amount, 6)} ${String(currentPayment.pay_currency || 'USDT').toUpperCase()}</strong>
            <button type="button" data-copy-value="${currentPayment.pay_amount || ''}"><span>${icon('ph:copy-bold')}</span> ${tr('copyAmount')}</button>
          </article>
          <article class="payment-copy-row">
            <small>Address</small>
            <strong>${shortHash(currentPayment.pay_address || '')}</strong>
            <button type="button" data-copy-value="${currentPayment.pay_address || ''}"><span>${icon('ph:copy-bold')}</span> ${tr('copyAddress')}</button>
          </article>
        </div>
        <div class="payment-countdown">
          <span>${icon('ph:timer-bold')}</span>
          <strong id="paymentTimer">${mm}:${ss}</strong>
          <small>${currentPayment.status || 'waiting'}</small>
        </div>
        <p class="payment-note">${tr('payExact')}</p>
      </article>
    </section>
  `;
}

function rankRulesOverlay() {
  if (!rankRulesOpen) return '';
  const currentRank = dashboard?.player?.rank || defaultVisualRank();
  const progress = rankProgressForCurrentUser();
  const ranks = rankList();
  const rankCards = ranks.map((rank) => {
    const requirementProgress = rankRequirementProgress(rank);
    return {
      rank,
      requirementProgress,
      reached: rankRequirementReached(rank),
      totalProgress: rankTotalProgress(requirementProgress),
      missing: rankMissingItems(requirementProgress),
    };
  });
  const nextGoal = rankCards.find((item) => !item.reached);
  return `
    <section class="rank-rules-overlay" role="dialog" aria-modal="true">
      <article class="rank-rules-card">
        <button class="payment-close" type="button" data-action="close-rank-rules" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
        <header class="rank-rules-hero">
          <button class="rank-rules-current-art" type="button" data-action="open-rank-image" data-rank-image="${escapeAttr(currentRank.image_url || '')}" data-rank-name="${escapeAttr(currentRank.name || 'Free')}" aria-label="${tr('currentRank')} ${escapeAttr(currentRank.name || 'Free')}">
            ${currentRank.image_url ? `<img src="${escapeAttr(currentRank.image_url)}" alt="" />` : icon('ph:medal-bold')}
          </button>
          <div>
            <small>${tr('currentRank')}</small>
            <h2>${escapeHtml(currentRank.name || 'Free')}</h2>
            <p>${tr('rankRulesSubtitle')}</p>
          </div>
        </header>
        <section class="rank-progress-panel">
          <strong>${tr('yourProgress')}</strong>
          <div>
            <span><small>${tr('directReferrals')}</small><b>${fmt(progress.direct_count, 0)}</b></span>
            <span><small>${tr('lifetimeEarned')}</small><b>${fmt(progress.lifetime_earned_usd, 2)} USDT</b></span>
          </div>
        </section>
        <section class="rank-next-goal">
          <small>${icon('ph:target-bold')} ${tr('nextGoal')}</small>
          ${nextGoal ? `
            <strong>${escapeHtml(nextGoal.rank.name)}</strong>
            <ul>
              ${nextGoal.missing.length
                ? nextGoal.missing.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')
                : `<li>${tr('readyRequirement')}</li>`}
            </ul>
            <div class="rank-total-progress">
              <span>${tr('totalProgress')}</span>
              <b>${fmt(nextGoal.totalProgress, 0)}%</b>
              <i style="--progress:${nextGoal.totalProgress}%"><em></em></i>
            </div>
          ` : `
            <strong>${tr('allRanksReached')}</strong>
            <ul><li>${tr('rankUnlocked')}</li></ul>
          `}
        </section>
        <div class="rank-rules-list">
          ${rankCards.map(({ rank, reached, requirementProgress, totalProgress, missing }) => {
            const isNext = nextGoal?.rank?.id === rank.id;
            return `
              <article class="${reached ? 'is-reached' : ''} ${isNext ? 'is-next' : ''}" data-rank-accent="${escapeAttr(rank.id || '')}">
                <button class="rank-rule-icon" type="button" data-action="open-rank-image" data-rank-image="${escapeAttr(rank.image_url || '')}" data-rank-name="${escapeAttr(rank.name || '')}" aria-label="${escapeAttr(rank.name || '')}">
                  ${rank.image_url ? `<img src="${escapeAttr(rank.image_url)}" alt="" />` : icon('ph:medal-bold')}
                </button>
                <div>
                  <header>
                    <strong>${escapeHtml(rank.name)}</strong>
                    <span>${tr(reached ? 'rankUnlocked' : isNext ? 'rankInProgress' : 'rankNotReached')}</span>
                  </header>
                  ${isNext ? `<small class="rank-next-badge">${icon('ph:target-bold')} ${tr('nextGoal')}</small>` : ''}
                  <div class="rank-requirement-lines">
                    ${rankProgressLine(tr('directReferrals'), requirementProgress.directs.current, requirementProgress.directs.required)}
                    ${rankProgressLine(tr('lifetimeEarned'), requirementProgress.earned.current, requirementProgress.earned.required, ' USDT')}
                    ${rankTeamProgressBlock(requirementProgress)}
                    ${missing.length ? `<p class="rank-missing-text">${tr('missingIntro')}: ${escapeHtml(missing.slice(0, 2).join(' - '))}</p>` : `<p class="rank-missing-text is-ready">${tr('readyRequirement')}</p>`}
                  </div>
                </div>
                <b>${fmt(totalProgress, 0)}%</b>
              </article>
            `;
          }).join('')}
        </div>
      </article>
    </section>
  `;
}

function rankImagePreviewOverlay() {
  if (!rankImagePreview?.image_url) return '';
  const wide = rankImagePreview.type === 'wide';
  return `
    <section class="rank-image-preview-overlay" role="dialog" aria-modal="true">
      <article class="rank-image-preview-card ${wide ? 'rank-image-preview-card--wide' : ''}">
        <button class="payment-close" type="button" data-action="close-rank-image" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
        <span class="rank-image-preview-art ${wide ? 'rank-image-preview-art--wide' : ''}">
          <img src="${escapeAttr(rankImagePreview.image_url)}" alt="${escapeAttr(rankImagePreview.name || '')}" />
        </span>
        <strong>${escapeHtml(rankImagePreview.name || '')}</strong>
      </article>
      <button class="rank-image-preview-backdrop" type="button" data-action="close-rank-image" aria-label="${tr('close')}"></button>
    </section>
  `;
}

function taskInstructionSteps(task) {
  if (task.type === 'youtube') {
    return [
      [icon('ph:youtube-logo-fill'), tr('openVideo'), task.url ? tr('videoConfigured') : tr('videoMissing')],
      [icon('ph:timer-fill'), tr('watchTime'), tr('stayVideo', { seconds: fmt(task.watch_seconds || 30) })],
      [icon('ph:arrow-u-up-left-bold'), tr('returnFoxPay'), tr('waitReward', { seconds: fmt(task.reward_delay_seconds ?? 30) })],
    ];
  }
  if (task.type === 'social') {
    return [
      [icon(socialTaskIcon(task.platform)), tr('openTask'), task.url ? tr('visitSocial') : tr('socialMissing')],
      [icon('ph:timer-fill'), tr('watchTime'), tr('socialStay', { seconds: fmt(task.wait_seconds || 15) })],
      [icon('ph:check-circle-fill'), tr('claimReward'), tr('returnClaim')],
    ];
  }
  if (task.type === 'partner') {
    return [
      [icon('ph:link-simple-bold'), tr('partnerOpen'), task.url ? tr('partnerComplete') : tr('socialMissing')],
      [icon('ph:shield-check-fill'), tr('partnerWait'), tr('partnerWaitDesc')],
      [ticketIcon(), tr('reward'), tr('continueClaim')],
    ];
  }
  if (task.id === 'tap_goal') {
    return [
      [icon('ph:hand-tap-fill'), tr('goEarn'), tr('tapUntil')],
      [icon('ph:target-fill'), tr('goal'), taskDescriptionText(task) || tr('completeCycle')],
      [icon('ph:check-circle-fill'), tr('claimReward'), tr('whenReady')],
    ];
  }
  if (task.type === 'referral') {
    return [
      [icon('ph:share-network-fill'), tr('referralTaskStepShare'), tr('referralTaskStepShareDesc')],
      [icon('ph:users-three-fill'), tr('referralTaskStepWait'), task.validation === 'registered' ? tr('referralTaskStepRegisterDesc') : tr('referralTaskStepWaitDesc')],
      [icon('ph:target-fill'), tr('goal'), taskDescriptionText(task)],
    ];
  }
  return [
    [icon('ph:calendar-check-fill'), tr('dailyAction'), taskDescriptionText(task) || tr('activateSession')],
    [icon('ph:shield-check-fill'), tr('confirm'), tr('marksCompleted')],
    [ticketIcon(), tr('reward'), tr('continueClaim')],
  ];
}

function taskPromptOverlay() {
  if (!pendingTaskId) return '';
  const task = taskList().find((item) => item.id === pendingTaskId);
  if (!task) return '';
  const capReached = packageCapReached();
  const progressState = ['youtube', 'social'].includes(task.type) ? videoProgressState(task) : null;
  const progressLocked = progressState?.phase === 'watching' || progressState?.phase === 'waiting';
  const actionLabel = progressState?.progress
    ? (progressState.phase === 'ready'
      ? tr('videoReadyToValidate')
      : (progressState.phase === 'paused' ? tr('continueVideo') : progressState.label))
    : (task.type === 'partner' ? tr('partnerOpen') : (task.type === 'referral' && !task.ready ? tr('shareLink') : tr('continue')));
  const modalDescription = capReached
    ? tr('capReached', { cap: fmt(dashboard.player.cap_usd, 2) })
    : (progressState?.progress ? progressState.label : (task.type === 'youtube' ? tr('taskTiming') : (taskDescriptionText(task) || tr('taskCompleteReward'))));
  return `
    <section class="task-modal-overlay" role="dialog" aria-modal="true">
      <article class="task-modal">
        <button class="task-modal-close" type="button" data-action="task-cancel" aria-label="Close">${icon('ph:x-bold')}</button>
        <span class="task-modal-icon">${icon(task.claimed ? 'ph:check-circle-fill' : (task.type === 'referral' ? 'ph:users-three-duotone' : (task.type === 'partner' ? 'ph:link-simple-bold' : (task.type === 'social' ? socialTaskIcon(task.platform) : 'ph:play-circle-duotone'))))}</span>
        <div class="task-modal-head">
          <small>${tr('taskDaily')}</small>
          <h2>${taskTitleText(task)}</h2>
          <p data-task-modal-description>${modalDescription}</p>
        </div>
        <div class="task-modal-steps">
          ${taskInstructionSteps(task).map(([stepIcon, title, detail]) => `
            <article>
              <span>${stepIcon}</span>
              <div>
                <strong>${title}</strong>
                <small>${detail}</small>
              </div>
            </article>
          `).join('')}
        </div>
        <div class="task-modal-reward">
          <span>${ticketIcon()}</span>
          <strong>${tr('taskTicketHint')}</strong>
        </div>
        <button class="task-modal-continue ${progressState?.progress ? 'task-modal-continue--progress' : ''}" type="button" data-action="task-confirm" data-task="${task.id}" data-task-modal-continue ${task.claimed || (task.type !== 'referral' && !task.ready) || progressLocked ? 'disabled' : ''}>${actionLabel}</button>
      </article>
    </section>
  `;
}

function dailyTicketRewardOverlay() {
  if (!dailyTicketReward) return '';
  const tickets = Math.max(1, Math.floor(Number(dailyTicketReward.tickets || 1)));
  return `
    <section class="daily-ticket-overlay" role="dialog" aria-modal="true">
      <article class="daily-ticket-card">
        <span class="daily-ticket-icon">${ticketIcon()}</span>
        <div class="daily-ticket-copy">
          <small>${tr('rouletteReady')}</small>
          <h2>${tr('dailyTicketTitle')}</h2>
          <p>${tr('dailyTicketBody', { count: fmt(tickets, 0) })}</p>
        </div>
        <div class="daily-ticket-actions">
          <button class="daily-ticket-secondary" type="button" data-action="daily-ticket-close">${tr('dailyTicketStay')}</button>
          <button class="daily-ticket-primary" type="button" data-action="daily-ticket-roulette">${ticketIcon()} ${tr('dailyTicketUse')}</button>
        </div>
      </article>
    </section>
  `;
}

function updateText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function patchEarnAfterTap(data, event) {
  updateDashboard(data, { skipRender: true });
  patchEarnDom();
}

function patchEarnDom() {
  if (activeView !== 'earn') {
    render();
    return;
  }
  const player = dashboard.player;
  const isFree = player.active_package_id === 'free';
  const capLimitUsd = isFree ? Number(player.free_withdrawal_limit_usd || 10) : Number(player.cap_usd || 1);
  const capPercent = Math.min(100, (Number(player.total_earned_usd || 0) / Math.max(1, capLimitUsd)) * 100);
  const energyPercent = Math.min(100, (Number(player.energy || 0) / Math.max(1, Number(player.max_energy || 1))) * 100);
  
  updateText('[data-balance-value]', fmt(walletTokens(player)));
  
  if (isFree) {
    updateText('[data-main-balance]', fmt(player.game_fox_balance || 0));
    updateText('[data-cap-value]', `Retiro: ${fmt(player.total_earned_usd, 2)} / ${fmt(capLimitUsd, 2)} USDT`);
  } else {
    updateText('[data-main-balance]', fmt(packCycleTokens(player)));
    updateText('[data-cap-value]', `${fmt(player.total_earned_usd, 2)} / ${fmt(player.cap_usd, 2)} USDT`);
  }
  updateText('[data-energy-value]', `${fmt(player.energy)} / ${fmt(player.max_energy)}`);

  const energyBar = document.querySelector('[data-energy-bar]');
  const capBar = document.querySelector('[data-cap-bar]');
  if (energyBar) energyBar.style.width = `${energyPercent}%`;
  if (capBar) capBar.style.width = `${capPercent}%`;

  const balanceChip = document.querySelector('.balance-chip');
  if (balanceChip) {
    balanceChip.classList.toggle('balance-chip--xs', balanceSizeClass(walletTokens(player)) === 'balance-chip--xs');
    balanceChip.classList.toggle('balance-chip--sm', balanceSizeClass(walletTokens(player)) === 'balance-chip--sm');
  }

  const tapTarget = document.querySelector('.tap-target');
  const foxCharacter = document.querySelector('.fox-character');
  const taskButton = document.querySelector('.upgrade-button');
  const capNote = document.querySelector('.cap-note');
  const capReached = packageCapReached(player);
  const isOutOfEnergy = Number(player.energy || 0) <= 0;
  if (tapTarget) tapTarget.classList.toggle('tap-target--locked', !player.can_tap);
  if (tapTarget) tapTarget.classList.toggle('tap-target--sleeping', isOutOfEnergy);
  if (foxCharacter) foxCharacter.src = isOutOfEnergy ? sleepingFoxImage : foxImage;
  if (capNote) capNote.classList.toggle('cap-note--visible', showCapInfo || capReached);
  if (taskButton) {
    taskButton.classList.toggle('upgrade-button--ready', Boolean(player.can_tap));
    taskButton.classList.toggle('upgrade-button--locked', !player.can_tap);
    if (capReached) {
      taskButton.dataset.view = 'packs';
      taskButton.dataset.packsTab = 'shop';
      const label = taskButton.querySelector('strong');
      if (label) label.textContent = 'Compra otro pack';
    }
  }
}

function tapRewardPreview() {
  return Number(dashboard?.player?.package?.tap_reward_tokens || 1);
}

function tapPoint(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  return {
    x: event.clientX || touch?.clientX || window.innerWidth / 2,
    y: event.clientY || touch?.clientY || window.innerHeight / 2,
  };
}

function playTapFeedback(button, event) {
  const point = tapPoint(event);
  button.classList.remove('is-tapping');
  void button.offsetWidth;
  button.classList.add('is-tapping');
  window.setTimeout(() => button.classList.remove('is-tapping'), 150);
  const isFree = dashboard?.player?.active_package_id === 'free';
  showPop(point.x, point.y, `+${isFree ? '1' : fmt(tapRewardPreview())}`);
}

function applyOptimisticTap() {
  const player = dashboard?.player;
  if (!player?.can_tap || Number(player.energy || 0) <= 0) return;
  
  if (player.active_package_id === 'free') {
    dashboard = {
      ...dashboard,
      player: {
        ...player,
        game_fox_balance: Number(player.game_fox_balance || 0) + 1,
        energy: Math.max(0, Number(player.energy || 0) - 1),
      },
    };
    dashboard.player.can_tap = dashboard.player.energy > 0;
  } else {
    const reward = tapRewardPreview();
    dashboard = {
      ...dashboard,
      player: {
        ...player,
        token_balance: Number(player.token_balance || 0) + reward,
        total_earned_usd: Math.min(Number(player.cap_usd || Infinity), Number(player.total_earned_usd || 0) + tokenUsd(reward)),
        energy: Math.max(0, Number(player.energy || 0) - 1),
      },
    };
    dashboard.player.usdt_balance = tokenUsd(dashboard.player.token_balance);
    dashboard.player.can_tap = dashboard.player.energy > 0 && Number(dashboard.player.total_earned_usd || 0) < Number(dashboard.player.cap_usd || 0);
  }
  patchEarnDom();
}

function queueTap(button, event) {
  if (!dashboard?.player?.can_tap) return;
  playTapFeedback(button, event);
  applyOptimisticTap();
  queuedTaps += 1;
  clearTimeout(tapFlushTimer);
  tapFlushTimer = setTimeout(flushQueuedTaps, 90);
}

async function flushQueuedTaps() {
  if (tapInFlight || queuedTaps <= 0) return;
  tapInFlight = true;
  const taps = Math.min(100, queuedTaps);
  queuedTaps -= taps;
  try {
    const data = await api('/api/foxpay/tap', { player_id: playerId, taps, language: appLang });
    patchEarnAfterTap(data);
  } catch (error) {
    toast(error.message);
    await loadDashboard();
  } finally {
    tapInFlight = false;
    if (queuedTaps > 0) {
      tapFlushTimer = setTimeout(flushQueuedTaps, 40);
    }
  }
}

function updateLocalDashboard(mutator) {
  dashboard = {
    ...dashboard,
    player: { ...dashboard.player },
    referrals: { ...(dashboard.referrals || {}) },
    leaderboard: { ...(dashboard.leaderboard || {}) },
  };
  mutator(dashboard);
  dashboard.player.usdt_balance = tokenUsd(dashboard.player.token_balance);
  dashboard.leaderboard.total_coins = dashboard.player.token_balance;
  dashboard.leaderboard.rows = [{
    position: 1,
    player_id: playerId,
    username: dashboard.player.username,
    token_balance: dashboard.player.token_balance,
    total_earned_usd: dashboard.player.total_earned_usd,
    active_package_id: dashboard.player.active_package_id,
  }];
  render();
}

async function loadDashboard() {
  const startedAt = Date.now();
  try {
    deviceKey = await getDeviceKey();
    dashboard = await api(`/api/foxpay/me?${dashboardQuery()}`);
  } catch (error) {
    let recoveredAfterReset = false;
    if (error.code === 'stale_player_id_reset') {
      const prefix = error.data?.reset_player_prefix || 'fox_';
      const version = String(error.data?.maintenance_reset?.version || '');
      if (version) localStorage.setItem(maintenanceResetStorage, version);
      clearAllVideoProgress();
      localStorage.removeItem(accountTokenKey);
      accountToken = '';
      playerId = createPlayerId(prefix);
      localStorage.setItem(playerKey, playerId);
      try {
        dashboard = await api(`/api/foxpay/me?${dashboardQuery()}`);
        recoveredAfterReset = true;
      } catch (retryError) {
        error = retryError;
      }
    }
    if (['ip_already_used', 'device_already_used'].includes(error.code)) {
      dashboard = {
        blocked: true,
        reason: error.code,
      };
      render();
      return;
    }
    if (!recoveredAfterReset) {
      dashboard = fallbackDashboard();
      dashboard.api_error = error.message;
    }
  }
  const elapsed = Date.now() - startedAt;
  if (elapsed < 520) {
    await new Promise((resolve) => setTimeout(resolve, 520 - elapsed));
  }
  loadingProgress = Math.max(loadingProgress, 96);
  updateLoadingProgress();
  handleSessionState(dashboard);
  await preloadCriticalAssets();
  stopLoading();
  render();
  scheduleAvatarPreload();
  void refreshExpiredPendingPayments();
  scheduleExpiredPendingPaymentsRefresh();
  void resumeVideoTaskFromReturn().catch((error) => toast(error.message));
}

function startLoading() {
  loadingProgress = 8;
  renderLoading();
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    loadingProgress = Math.min(94, loadingProgress + Math.max(1, Math.round((96 - loadingProgress) * 0.12)));
    updateLoadingProgress();
  }, 150);
}

function stopLoading() {
  clearInterval(loadingTimer);
  loadingTimer = null;
  loadingProgress = 100;
}

function renderLoading() {
  const progress = Math.max(0, Math.min(100, Math.round(loadingProgress)));
  app.innerHTML = `
    <section class="loading-view fox-loading" aria-live="polite">
      <div class="loading-brand">
        <span class="loading-logo"><img src="${foxImage}" alt="" /></span>
        <div>
          <strong>FoxPay</strong>
          <small>Loading tap game</small>
        </div>
      </div>
      <div class="loading-track" style="--progress:${progress}%">
        <div class="loading-fill">
          <span class="loading-paws">paw paw paw paw paw paw</span>
        </div>
        <span class="loading-avatar"><img src="${foxImage}" alt="" /></span>
        <b data-loading-percent>${progress}%</b>
      </div>
    </section>
  `;
}

function updateLoadingProgress() {
  const progress = Math.max(0, Math.min(100, Math.round(loadingProgress)));
  const track = app.querySelector('.loading-track');
  const percent = app.querySelector('[data-loading-percent]');
  if (track) track.style.setProperty('--progress', `${progress}%`);
  if (percent) percent.textContent = `${progress}%`;
}

async function getDeviceKey() {
  if (!deviceKey) {
    deviceKey = `dev_${randomIdPart()}`;
    localStorage.setItem(deviceKeyStorage, deviceKey);
  }
  return deviceKey;
}

function fallbackDashboard() {
  return {
    ok: true,
    persistence: 'local',
    api_offline: true,
    settings: { token_price_usd: 0.0001, referral_rate: 0.1, season_reward_tokens: 0, season_start_at: '', season_end_at: '' },
    leaderboard: {
      total_players: 1,
      total_coins: 0,
      rows: [{ position: 1, player_id: playerId, username: tr('foxPlayer'), token_balance: 0, total_earned_usd: 0, active_package_id: 'free' }],
    },
    referrals: { total: 0, active: 0, estimated_bonus_usdt: 0, estimated_bonus_tokens: 0, rows: [] },
    withdrawals: [],
    purchases: [],
    payments: [],
    commissions: [],
    ranks: [{ id: 'free', name: 'Free', image_url: './images/fox-optimized.webp' }],
    avatars: [{ id: 'fox-default', name: 'Fox Starter', image_url: './images/fox-optimized.webp', is_free: true, price_tokens: 0, price_usdt: 0 }],
    register_captcha: {
      token: 'local',
      prompt: 'Tap the FOX coin',
      options: [
        { id: 'fox-coin', icon: 'fox-coin', label: 'FOX coin' },
        { id: 'star-token', icon: 'ph:star-four-fill', label: 'star token' },
        { id: 'shield-token', icon: 'ph:shield-check-fill', label: 'shield token' },
        { id: 'diamond-token', icon: 'ph:diamond-fill', label: 'diamond token' },
      ],
    },
    packages: [
      { id: 'free', name: 'Free Tap', price_usdt: 0, monthly_cap_usd: 3, daily_energy: 300, tap_reward_tokens: 1 },
      { id: 'p30', name: '30 USDT Pack', price_usdt: 30, monthly_cap_usd: 90, daily_energy: 500, tap_reward_tokens: 4 },
      { id: 'p60', name: '60 USDT Pack', price_usdt: 60, monthly_cap_usd: 180, daily_energy: 800, tap_reward_tokens: 5 },
      { id: 'p120', name: '120 USDT Pack', price_usdt: 120, monthly_cap_usd: 360, daily_energy: 1000, tap_reward_tokens: 8 },
      { id: 'p480', name: '480 USDT Pack', price_usdt: 480, monthly_cap_usd: 1440, daily_energy: 1600, tap_reward_tokens: 20 },
      { id: 'p960', name: '960 USDT Pack', price_usdt: 960, monthly_cap_usd: 2880, daily_energy: 2000, tap_reward_tokens: 32 },
    ],
    skins: [],
    roulette_settings: [{ package_id: 'free', ticket_cost: 1 }],
    player: {
      player_id: playerId,
      username: tr('foxPlayer'),
      is_registered: false,
      registered_at: null,
      country_code: '',
      country_name: '',
      signup_ip: '',
      device_key: deviceKey,
      device_label: navigator.platform || 'Device',
      selected_avatar_id: 'fox-default',
      owned_avatars: ['fox-default'],
      owned_skins: [],
      selected_skins: [],
      active_skins: [],
      skin_taps: { daily_tokens: 0, claimed_today: false, can_claim: false },
      avatar_url: './images/fox-optimized.webp',
      token_balance: 0,
      wallet_tokens: 0,
      roulette_tickets: 0,
      usdt_balance: 0,
      wallet_usdt: 0,
      pack_cycle_tokens: 0,
      pack_cycle_usdt: 0,
      total_earned_usd: 0,
      lifetime_earned_usd: 0,
      total_withdrawn_usd: 0,
      active_package_id: 'free',
      rank: { id: 'free', name: 'Free', image_url: './images/fox-optimized.webp' },
      package: { id: 'free', name: 'Free Tap', daily_energy: 300, tap_reward_tokens: 1 },
      roulette_ticket_cost: 1,
      cap_usd: 3,
      remaining_cap_usd: 3,
      energy: 300,
      max_energy: 300,
      streak_days: 0,
      daily_tasks: {},
      task_progress: { taps: 0 },
      can_tap: false,
      referral_link: `https://foxpay.live/?ref=${playerId}`,
    },
  };
}

function taskList() {
  const player = dashboard.player;
  if (Array.isArray(dashboard.tasks)) return dashboard.tasks;
  const tasks = [
    { id: 'daily_check', title: 'Daily check-in', description: 'Activa tu sesion diaria', reward_tokens: 0, ready: true },
    { id: 'youtube_1', type: 'youtube', title: 'Ver video 1', description: 'Mira al menos 30 segundos', reward_tokens: 0, ready: false },
    {
      id: 'tap_goal',
      title: 'Tap 100 veces',
      description: `${Math.min(100, player.task_progress?.taps || 0)} / 100 taps`,
      reward_tokens: 0,
      ready: Number(player.task_progress?.taps || 0) >= 100,
    },
  ];
  return tasks.map((task) => ({ ...task, claimed: Boolean(player.daily_tasks?.[task.id]) }));
}

function playerRank(player) {
  return Math.max(0, Math.floor(Number(player.streak_days || 0)));
}

function defaultVisualRank() {
  return { id: 'free', name: 'Free', image_url: './images/fox-optimized.webp', required_directs: 0, required_lifetime_usd: 0, team_requirements: {}, sort_order: 0 };
}

function rankList() {
  const ranks = Array.isArray(dashboard?.ranks) ? dashboard.ranks : [];
  return (ranks.length ? ranks : [defaultVisualRank()])
    .filter((rank) => rank && rank.active !== false)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
}

function rankById(rankId) {
  return rankList().find((rank) => rank.id === rankId) || null;
}

function rankTeamRequirementsText(rank = {}) {
  const entries = Object.entries(rank.team_requirements || {}).filter(([, count]) => Number(count) > 0);
  if (!entries.length) return tr('noTeamRequirement');
  return entries.map(([rankId, count]) => {
    const item = rankById(rankId);
    return `${fmt(count, 0)} ${item?.name || rankId} ${tr('rankOrHigher')}`;
  }).join(' + ');
}

function rankProgressForCurrentUser() {
  const rank = dashboard?.player?.rank || {};
  return {
    direct_count: Math.max(0, Math.floor(Number(rank.direct_count || 0))),
    lifetime_earned_usd: Math.max(0, Number(rank.network_volume_usd ?? rank.lifetime_earned_usd ?? 0)),
    network_volume_by_depth: rank.network_volume_by_depth || {},
    team_rank_counts: rank.team_rank_counts || {},
  };
}

function rankNetworkVolumeFor(rank = {}, progress = rankProgressForCurrentUser()) {
  const byDepth = progress.network_volume_by_depth || {};
  return Math.max(0, Number(byDepth[rank.id] ?? progress.lifetime_earned_usd ?? 0));
}

function rankRequirementReached(rank = {}) {
  const progress = rankProgressForCurrentUser();
  if (progress.direct_count < Number(rank.required_directs || 0)) return false;
  if (rankNetworkVolumeFor(rank, progress) < Number(rank.required_lifetime_usd || 0)) return false;
  const ranks = rankList();
  return Object.entries(rank.team_requirements || {}).every(([rankId, count]) => {
    const requiredRank = ranks.find((item) => item.id === rankId);
    if (!requiredRank) return false;
    const total = ranks
      .filter((item) => Number(item.sort_order || 0) >= Number(requiredRank.sort_order || 0))
      .reduce((sum, item) => sum + Number(progress.team_rank_counts?.[item.id] || 0), 0);
    return total >= Number(count || 0);
  });
}

function rankTeamRequirementProgress(rank = {}) {
  const progress = rankProgressForCurrentUser();
  const ranks = rankList();
  return Object.entries(rank.team_requirements || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([rankId, count]) => {
      const requiredRank = ranks.find((item) => item.id === rankId);
      const total = requiredRank
        ? ranks
          .filter((item) => Number(item.sort_order || 0) >= Number(requiredRank.sort_order || 0))
          .reduce((sum, item) => sum + Number(progress.team_rank_counts?.[item.id] || 0), 0)
        : 0;
      return {
        rankId,
        name: requiredRank?.name || rankId,
        current: Math.max(0, Math.floor(total)),
        required: Math.max(0, Math.floor(Number(count || 0))),
      };
    });
}

function rankRequirementProgress(rank = {}) {
  const progress = rankProgressForCurrentUser();
  return {
    directs: {
      current: Math.max(0, Math.floor(Number(progress.direct_count || 0))),
      required: Math.max(0, Math.floor(Number(rank.required_directs || 0))),
    },
    earned: {
      current: rankNetworkVolumeFor(rank, progress),
      required: Math.max(0, Number(rank.required_lifetime_usd || 0)),
    },
    team: rankTeamRequirementProgress(rank),
  };
}

function rankRequirementPercent(current, required) {
  const target = Number(required || 0);
  if (target <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((Number(current || 0) / target) * 100)));
}

function rankProgressLine(label, current, required, suffix = '') {
  const target = Number(required || 0);
  if (target <= 0) return '';
  const percent = rankRequirementPercent(current, target);
  return `
    <div class="rank-progress-line">
      <div>
        <span>${label}</span>
        <b>${fmt(current || 0, 0)}/${fmt(target, 0)}${suffix}</b>
      </div>
      <i style="--progress:${percent}%"><em></em></i>
    </div>
  `;
}

function rankMissingItems(requirementProgress = {}) {
  const items = [];
  const directMissing = Math.max(0, Number(requirementProgress.directs?.required || 0) - Number(requirementProgress.directs?.current || 0));
  const earnedMissing = Math.max(0, Number(requirementProgress.earned?.required || 0) - Number(requirementProgress.earned?.current || 0));
  if (directMissing > 0) items.push(tr('missingDirects', { count: fmt(directMissing, 0) }));
  if (earnedMissing > 0) items.push(tr('missingEarned', { count: fmt(earnedMissing, 0) }));
  (requirementProgress.team || []).forEach((item) => {
    const missing = Math.max(0, Number(item.required || 0) - Number(item.current || 0));
    if (missing > 0) items.push(tr('missingTeam', { count: fmt(missing, 0), rank: item.name }));
  });
  return items;
}

function rankTotalProgress(requirementProgress = {}) {
  const parts = [];
  if (Number(requirementProgress.directs?.required || 0) > 0) {
    parts.push(rankRequirementPercent(requirementProgress.directs.current, requirementProgress.directs.required));
  }
  if (Number(requirementProgress.earned?.required || 0) > 0) {
    parts.push(rankRequirementPercent(requirementProgress.earned.current, requirementProgress.earned.required));
  }
  (requirementProgress.team || []).forEach((item) => {
    if (Number(item.required || 0) > 0) parts.push(rankRequirementPercent(item.current, item.required));
  });
  if (!parts.length) return 100;
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function rankTeamProgressBlock(requirementProgress = {}) {
  const team = requirementProgress.team || [];
  if (!team.length) {
    return `<div class="rank-team-box is-ready">${icon('ph:check-circle-bold')} <span>${tr('noTeamNeeded')}</span></div>`;
  }
  return `
    <div class="rank-team-box">
      <strong>${tr('teamRequirement')}</strong>
      ${team.map((item) => {
        const percent = rankRequirementPercent(item.current, item.required);
        return `
          <span>
            <em>${fmt(item.current, 0)}/${fmt(item.required, 0)} ${escapeHtml(item.name)} ${tr('rankOrHigher')}</em>
            <i style="--progress:${percent}%"><b></b></i>
          </span>
        `;
      }).join('')}
    </div>
  `;
}

function packIconAsset(pack) {
  if (pack.id === 'free') return 'gift-pack.png';
  if (Number(pack.price_usdt || 0) >= 960) return 'fox-crown-wreath.png';
  if (Number(pack.price_usdt || 0) >= 480) return 'fox-gold-wreath.png';
  if (Number(pack.price_usdt || 0) >= 120) return 'fox-crown-wreath.png';
  if (Number(pack.price_usdt || 0) >= 60) return 'fox-diamond-badge.png';
  return 'paw-badge.png';
}

function leaderboardRows() {
  const player = dashboard.player;
  const paidOnly = leaderboardMode === 'premium';
  const freeAvatarUrl = (dashboard.avatars || []).find((avatar) => isEnabled(avatar.is_free) && avatar.active !== false && avatar.active !== 'false')?.image_url
    || foxImage;
  const current = {
    name: player.username || 'Wuffies',
    position: playerRank(player),
    playerRank: player.rank || defaultVisualRank(),
    coins: Number(player.token_balance || 0),
    avatar: player.avatar_url || freeAvatarUrl,
    countryCode: player.country_code || '',
    countryName: player.country_name || '',
    active: true,
  };
  const realRows = dashboard.leaderboard?.rows || [];
  const filteredRows = realRows.filter((row) => (paidOnly ? row.active_package_id !== 'free' : row.active_package_id === 'free'));
  if (filteredRows.length) {
    return filteredRows.map((row) => ({
      name: row.username || tr('foxPlayer'),
      position: Math.max(1, Math.min(99, row.position || 1)),
      playerRank: row.player_rank || defaultVisualRank(),
      coins: Number(row.token_balance || 0),
      avatar: row.player_id === player.player_id ? (player.avatar_url || freeAvatarUrl) : freeAvatarUrl,
      countryCode: row.country_code || '',
      countryName: row.country_name || '',
      active: row.player_id === player.player_id,
    }));
  }
  return paidOnly && player.active_package_id === 'free' ? [] : [current];
}

function seasonCountdown() {
  if (!seasonIsActive()) return '';
  const now = new Date();
  const end = new Date(dashboard.settings.season_end_at);
  const ms = end - now;
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${days} d ${hours} h ${minutes}m ${seconds}s`;
}

function updateSeasonCountdownNode() {
  if (!dashboard) return;
  const node = document.querySelector('[data-season-countdown]');
  if (!node) return;
  node.textContent = seasonCountdown();
}

function syncSeasonCountdownTimer() {
  if (seasonCountdownTimer) {
    window.clearInterval(seasonCountdownTimer);
    seasonCountdownTimer = null;
  }
  if (!seasonIsActive()) return;
  seasonCountdownTimer = window.setInterval(updateSeasonCountdownNode, 1000);
}

function seasonDateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(fmtLocale, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function seasonState() {
  const settings = dashboard?.settings || {};
  const start = settings.season_start_at ? new Date(settings.season_start_at) : null;
  const end = settings.season_end_at ? new Date(settings.season_end_at) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'none';
  const now = new Date();
  if (now < start) return 'scheduled';
  if (now <= end) return 'active';
  return settings.season_paid_key ? 'paid' : 'ended';
}

function seasonIsActive() {
  return seasonState() === 'active';
}

function seasonRewardLabel() {
  const tokens = Number(dashboard?.settings?.season_reward_tokens || 0);
  return tokens > 0 ? tr('seasonPrize', { count: fmt(tokens) }) : tr('rankingOnly');
}

function seasonImageMarkup(className = 'season-status-image') {
  const url = String(dashboard?.settings?.season_image_url || '').trim();
  if (!url) return '';
  const name = String(dashboard?.settings?.season_name || tr('season')).trim();
  return `
    <button class="season-status-image-button" type="button" data-action="open-rank-image" data-rank-image="${escapeAttr(url)}" data-rank-name="${escapeAttr(name)}" data-preview-type="wide" aria-label="${escapeAttr(name)}">
      <img class="${className}" src="${escapeAttr(url)}" alt="" loading="lazy" decoding="async" />
    </button>
  `;
}

function seasonStatusCard() {
  const state = seasonState();
  const settings = dashboard?.settings || {};
  const media = seasonImageMarkup();
  if (state === 'active') {
    return `
      <div class="season-clock season-clock--active">
        ${media}
        <span>${settings.season_name || tr('season')} ${tr('ends')}</span>
        <strong data-season-countdown>${seasonCountdown()}</strong>
        <small>${seasonRewardLabel()}</small>
      </div>
    `;
  }
  if (state === 'scheduled') {
    return `
      <div class="season-status-card season-status-card--scheduled">
        ${media || `<span>${icon('ph:calendar-check-duotone')}</span>`}
        <div>
          <strong>${tr('seasonScheduledTitle')}</strong>
          <small>${tr('seasonScheduledBody', { date: seasonDateLabel(settings.season_start_at) })}</small>
          <p>${seasonRewardLabel()}</p>
        </div>
      </div>
    `;
  }
  if (state === 'ended' || state === 'paid') {
    const paid = state === 'paid';
    return `
      <div class="season-status-card ${paid ? 'season-status-card--paid' : 'season-status-card--ended'}">
        ${media || `<span>${icon(paid ? 'ph:check-circle-duotone' : 'ph:hourglass-medium-duotone')}</span>`}
        <div>
          <strong>${tr(paid ? 'seasonPaidTitle' : 'seasonEndedTitle')}</strong>
          <small>${tr(paid ? 'seasonPaidBody' : 'seasonEndedReview')}</small>
          <p>${seasonRewardLabel()} - ${tr('seasonGeneralBody')}</p>
        </div>
      </div>
    `;
  }
  return `<div class="ranking-only">${tr('rankingOnly')}</div>`;
}

function topHud() {
  const player = dashboard.player;
  const avatarUrl = player.avatar_url || './images/fox-optimized.webp';
  const rank = player.rank || defaultVisualRank();
  const wallet = walletTokens(player);
  
  const ranks = rankList();
  const currentRankIndex = ranks.findIndex((r) => r.id === rank.id);
  const displayLevel = currentRankIndex !== -1 ? currentRankIndex + 1 : 1;
  const totalLevels = ranks.length || 10;
  const rankPercent = Math.min(100, Math.max(0, (displayLevel / totalLevels) * 100));

  return `
    <header class="game-head">
      <div class="profile-row">
        <button class="avatar-box" type="button" data-view="avatars" aria-label="Change avatar"><img src="${avatarUrl}" alt="" /></button>
        <div class="profile-copy">
          <strong>${player.username || 'Wuffies'}</strong>
          <button class="profile-rank-line" type="button" data-action="open-rank-rules" aria-label="${tr('rankRulesTitle')}">
            ${rank.image_url ? `<img src="${escapeAttr(rank.image_url)}" alt="" />` : icon('ph:medal-bold')}
            <b>${escapeHtml(rank.name || 'Free')}</b>
          </button>
        </div>
        <div class="balance-chip ${balanceSizeClass(wallet)}">
          <span><small>${tr('wallet')}</small><strong data-balance-value>${fmt(wallet)}</strong></span>
          <button class="plus-button" type="button" data-view="wallet" aria-label="${tr('openWallet')}">${icon('material-symbols:add-circle-rounded')}</button>
        </div>
        <button class="menu-button" type="button" data-view="profile" aria-label="Profile">${icon('ph:user-circle-bold')}</button>
      </div>
      
      <!-- Fila de estadísticas modernas debajo de profile-row -->
      <div class="hud-stats-row">
        <!-- Rango y progreso a la izquierda -->
        <button class="hud-rank-box" type="button" data-action="open-rank-rules" aria-label="${tr('rankRulesTitle')}">
          <div class="hud-rank-header">
            <span class="hud-rank-name">${escapeHtml(rank.name || 'Free')}</span>
            ${icon('ph:caret-right-bold')}
          </div>
          <span class="hud-rank-level-text">${displayLevel} / ${totalLevels}</span>
          <div class="hud-rank-bar">
            <span style="width: ${rankPercent}%"></span>
          </div>
        </button>

        <!-- Pastilla de stats a la derecha -->
        <div class="hud-right-pill">
          <!-- Botón de intercambio (billetera/redes) -->
          <button class="hud-pill-circle-btn exchange-btn" type="button" data-view="wallet" aria-label="Wallet">
            <img src="images/icons/icons card/exchange.png" alt="" />
          </button>
          
          <!-- Profit per hour -->
          <div class="hud-profit-box">
            <span class="hud-profit-title">Profit per hour</span>
            <div class="hud-profit-values">
              <span class="hud-profit-coin">${coinIcon()}</span>
              <strong class="hud-profit-amount">+${fmt(player.passive_income_per_hour || 0)}</strong>
              <span class="hud-profit-info">${icon('ph:info-bold')}</span>
            </div>
          </div>

          <!-- Botón de configuración/perfil -->
          <button class="hud-pill-circle-btn settings-btn" type="button" data-view="profile" aria-label="Profile">
            ${icon('ph:gear-fill')}
          </button>
        </div>
      </div>
      
      ${pwaInstallBanner()}
    </header>
  `;
}

function pwaInstallBanner() {
  if (activeView === 'roulette' || !isAndroidDevice || isStandalonePwa || !canInstallPwa || installBannerDismissed) return '';
  return `
    <aside class="install-banner">
      <span class="install-banner-icon">${icon('ph:device-mobile-camera-duotone')}</span>
      <div>
        <strong>${tr('installTitle')}</strong>
        <small>${tr('installText')}</small>
      </div>
      <button class="install-banner-action" type="button" data-action="install-pwa">${icon('ph:download-simple-bold')} ${tr('install')}</button>
      <button class="install-banner-close" type="button" data-action="dismiss-install" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
    </aside>
  `;
}

function earnView() {
  const player = dashboard.player;
  const pack = player.package || {};
  const cycleTokens = packCycleTokens(player);
  const isFree = player.active_package_id === 'free';
  const capLimitUsd = isFree ? Number(player.free_withdrawal_limit_usd || 10) : Number(player.cap_usd || 1);
  const capReached = !isFree && packageCapReached(player);
  const skinDismissKey = `${player.player_id}:${player.daily_key || 'today'}`;
  const skinClaimHidden = dismissedSkinClaimKey === skinDismissKey;
  
  const capText = isFree
    ? tr('freeCapInfo', { cap: fmt(capLimitUsd, 2) })
    : (capReached
      ? tr('capReached', { cap: fmt(player.cap_usd, 2) })
      : tr('capInfo', { cap: fmt(player.cap_usd, 2) }));
      
  const skins = isFree ? [] : activeSkins();
  const isOutOfEnergy = Number(player.energy || 0) <= 0;
  const skinDaily = isFree ? 0 : Number(player.skin_taps?.daily_tokens || 0);
  const skinClaimed = Boolean(player.skin_taps?.claimed_today);
  const skinClaimText = capReached
    ? tr('capReached', { cap: fmt(player.cap_usd, 2) })
    : skinDaily > 0
      ? (skinClaimed ? tr('skinTapsClaimed') : tr('skinTapsReady', { count: fmt(skinDaily, 0) }))
      : tr('winSkinsRoulette');
      
  const tapRewardValue = isFree ? '1' : fmt(pack?.tap_reward_tokens || 1);
  const balanceLabel = isFree ? `+${tapRewardValue} GFOX/tap` : tr('generatedPack');
  const balanceValue = isFree ? fmt(player.game_fox_balance || 0) : fmt(cycleTokens);
  
  const upgradeTargetView = isFree ? 'packs' : (capReached ? 'packs' : 'tasks');
  const upgradePacksTab = isFree ? 'miner' : 'shop';
  const upgradeLabel = isFree ? 'Optimizar Mineradora' : (capReached ? tr('buyAnotherPack') : (tasksDoneToday() ? tr('tomorrow') : (player.can_tap ? tr('dailyTasks') : tr('unlockTasks'))));
  const upgradeIcon = isFree ? 'ph:cpu-fill' : (capReached ? 'ph:package-fill' : (player.can_tap ? 'ph:clipboard-text-fill' : 'ph:lock-key-fill'));

  // Skins Card
  const hasSelectedSkins = (player.selected_skins || []).length > 0;
  const ownedSkinsCount = ownedSkins().length;
  const skinsLabel = 'Skins';
  const skinsTime = `${ownedSkinsCount} Skin${ownedSkinsCount !== 1 ? 's' : ''}`;
  const skinsCompleted = hasSelectedSkins;
  const skinsDot = !skinsCompleted && ownedSkinsCount > 0;

  // Miner Card
  const packName = isFree ? 'Gratis' : (pack.name || 'Premium');
  const minerLabel = isFree ? 'Minar' : 'Mineradoras';
  const minerTime = packName;
  const minerCompleted = !isFree;
  const minerDot = isFree && Number(player.energy || 0) > 0;

  // Tareas Card
  const allTasks = taskList().filter(t => t.required !== false);
  const completedTasks = allTasks.filter(t => t.claimed).length;
  const tasksTime = `${completedTasks}/${allTasks.length}`;
  const tasksCompleted = tasksDoneToday();
  const tasksDot = !tasksCompleted && allTasks.some(t => t.ready && !t.claimed);

  // Ruleta Card
  const ticketsCount = player.roulette_tickets || 0;
  const rouletteLabel = 'Ruleta';
  const rouletteTime = `${ticketsCount} Ticket${ticketsCount !== 1 ? 's' : ''}`;
  const rouletteDot = ticketsCount > 0;
  const rouletteCompleted = ticketsCount === 0 && tasksCompleted;

  return `
    <section class="hero-stage">
      <div class="hk-cards-spacer"></div>
      <div class="hk-cards-widget">
        <div class="content-panel">
          <div class="cards-grid">
            
            <button class="card ${skinsCompleted ? 'completed' : ''}" type="button" data-view="skins">
              ${skinsCompleted ? '<div class="check-badge"></div>' : (skinsDot ? '<div class="dot-badge"></div>' : '')}
              <div class="icon-3d-box"><img src="images/icons/icons card/iconos_10.png" alt="Skins" /></div>
              <div class="card-title">${skinsLabel}</div>
              <div class="card-time">${skinsTime}</div>
            </button>

            <button class="card ${minerCompleted ? 'completed' : ''}" type="button" data-view="packs">
              ${minerCompleted ? '<div class="check-badge"></div>' : (minerDot ? '<div class="dot-badge"></div>' : '')}
              <div class="icon-3d-box"><img src="images/icons/icons card/iconos_05.png" alt="Minar" /></div>
              <div class="card-title">${minerLabel}</div>
              <div class="card-time">${minerTime}</div>
            </button>

            <button class="card ${tasksCompleted ? 'completed' : ''}" type="button" data-view="tasks">
              ${tasksCompleted ? '<div class="check-badge"></div>' : (tasksDot ? '<div class="dot-badge"></div>' : '')}
              <div class="icon-3d-box"><img src="images/icons/icons card/iconos_07.png" alt="Tareas" /></div>
              <div class="card-title">Tareas</div>
              <div class="card-time">${tasksTime}</div>
            </button>

            <button class="card ${rouletteCompleted ? 'completed' : ''}" type="button" data-view="roulette">
              ${rouletteCompleted ? '<div class="check-badge"></div>' : (rouletteDot ? '<div class="dot-badge"></div>' : '')}
              <div class="icon-3d-box"><img src="images/icons/icons card/iconos_03.png" alt="Ruleta" /></div>
              <div class="card-title">${rouletteLabel}</div>
              <div class="card-time">${rouletteTime}</div>
            </button>

          </div>
        </div>
      </div>

      <div class="main-balance-wrap">
        <small>${balanceLabel}</small>
        <div class="main-balance"><span class="coin-icon">${coinIcon()}</span><span data-main-balance>${balanceValue}</span></div>
      </div>
      <div class="status-pills">
        <button class="status-pill-button" type="button" data-action="toggle-cap-info" aria-expanded="${showCapInfo || capReached ? 'true' : 'false'}">
          ${icon('ph:target-fill')}<b data-cap-value>${isFree ? `Retiro: ${fmt(player.total_earned_usd, 2)} / ${fmt(capLimitUsd, 2)} USDT` : `${fmt(player.total_earned_usd, 2)} / ${fmt(player.cap_usd, 2)} USDT`}</b>
        </button>
      </div>
      <div class="cap-note ${capReached ? 'cap-note--reached' : ''} ${showCapInfo || capReached ? 'cap-note--visible' : ''}">
        <span>${icon(capReached ? 'ph:lock-key-fill' : 'ph:info-fill')}</span>
        <small>${capText}</small>
      </div>
      <button class="tap-target ${player.can_tap ? '' : 'tap-target--locked'} ${isOutOfEnergy ? 'tap-target--sleeping' : ''}" type="button" data-action="tap" aria-label="Tap fox">
        <span class="character-shadow"></span>
        <img class="fox-character" src="${isOutOfEnergy ? sleepingFoxImage : foxImage}" alt="" draggable="false" />
        <span class="sleep-z sleep-z--1">Z</span>
        <span class="sleep-z sleep-z--2">Z</span>
        <span class="sleep-z sleep-z--3">Z</span>
        ${skins.map((skin, index) => `<img class="skin-companion skin-companion--${index + 1}" src="${skin.image_url}" alt="" draggable="false" />`).join('')}
      </button>
      ${skinClaimHidden ? `
        <div class="energy-shortcut-pill">
          ${icon('ph:lightning-fill')}<b data-energy-value>${fmt(player.energy)} / ${fmt(player.max_energy)}</b>
        </div>
      ` : `
      <article class="skin-claim-card ${skinDaily > 0 ? '' : 'skin-claim-card--empty'}">
        <button class="skin-claim-info" type="button" data-action="open-skins" aria-label="${tr('goSkins')}">
          <span>${skins.slice(0, 2).map((skin) => `<img src="${skin.image_url}" alt="" />`).join('') || icon('ph:sparkle-fill')}</span>
          <small>${tr('activeSkins')} · ${tr('goSkins')}</small>
          <strong>${skinClaimText}</strong>
        </button>
        <button class="skin-claim-action" type="button" ${capReached ? 'data-view="packs" data-packs-tab="shop"' : `data-action="${skinDaily > 0 ? 'claim-skin-taps' : 'open-skins'}"`} ${skinDaily > 0 && skinClaimed && !capReached ? 'disabled' : ''}>
          ${capReached ? tr('buyAnotherPack') : (skinDaily > 0 ? tr('claimSkinTaps', { count: fmt(skinDaily, 0) }) : tr('goSkins'))}
        </button>
        <button class="skin-claim-close" type="button" data-action="dismiss-skin-claim" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
      </article>
      `}
    </section>
  `;
}

function tasksDoneToday() {
  const tasks = taskList().filter((task) => task.required !== false);
  return tasks.length > 0 && tasks.every((task) => task.claimed);
}

function formatActivityDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(fmtLocale, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function walletActivities() {
  const hiddenClosedPurchaseStatuses = ['rejected', 'expired', 'failed', 'refunded', 'underpaid', 'cancelled', 'canceled'];
  const purchases = (dashboard.purchases || []).filter((item) => {
    const status = String(item.status || '').toLowerCase();
    return !hiddenClosedPurchaseStatuses.includes(status);
  }).map((item) => {
    const foxTokens = Math.max(0, Math.floor(Number(item.fox_tokens_paid || 0)));
    const foxUsdt = Number(item.fox_usdt_paid || 0);
    const usdtDue = Number(item.usdt_due || 0);
    const status = String(item.status || '').toLowerCase();
    const isApproved = ['approved', 'confirmed', 'finished'].includes(status);
    const isPending = ['pending', 'waiting'].includes(status);
    const isCancelled = ['cancelled', 'canceled'].includes(status);
    const isClosed = ['rejected', 'expired', 'failed', 'refunded', 'underpaid', 'cancelled', 'canceled'].includes(status);
    const usdtText = usdtDue > 0 ? `${tr('usdtPaid')}: ${fmt(usdtDue, 2)} USDT` : (foxTokens > 0 ? tr('allFoxPayment') : `${tr('usdtPaid')}: ${fmt(item.amount_usdt, 2)} USDT`);
    const foxText = foxTokens > 0 ? `${tr('foxUsed')}: ${fmt(foxTokens)} FOX (${fmt(foxUsdt, 2)} USDT)` : tr('payUsdt');
    return {
      category: 'purchases',
      type: isApproved ? tr('packPurchase') : (isPending ? tr('pendingPayment') : tr('notCompleted')),
      title: `${item.package_id || 'Pack'} - ${item.status || ''}`,
      meta: isPending ? `${tr('waitingPayment')} - ${foxText} - ${usdtText}` : (isClosed ? `${isCancelled ? tr('paymentCancelled') : tr('notCompleted')} - ${foxText}` : `${foxText} - ${usdtText}`),
      amount: isApproved ? (foxTokens > 0 ? `-${fmt(foxTokens)} FOX` : `-${fmt(item.amount_usdt, 2)} USDT`) : '0 USDT',
      tone: isApproved ? 'negative' : 'neutral',
      date: item.created_at || item.reviewed_at || '',
      icon: 'ph:package-fill',
      paymentId: item.id || '',
      canResume: isPending && (dashboard.payments || []).some((payment) => (
        payment.id === item.id
        && paymentIsOpen(payment)
        && paymentSecondsLeft(payment) > 0
      )),
      canCancel: false,
    };
  });
  const withdrawals = (dashboard.withdrawals || []).map((item) => ({
    category: 'withdrawals',
    type: tr('withdraw'),
    title: `${fmt(item.usdt_amount, 2)} USDT`,
    meta: `${fmt(item.tokens, 0)} FOX - ${item.status || ''}`,
    amount: `-${fmt(item.tokens, 0)} FOX`,
    tone: 'negative',
    date: item.created_at || item.reviewed_at || '',
    icon: 'ph:arrow-circle-up-right-fill',
  }));
  const payments = (dashboard.payments || []).map((item) => {
    const foxTokens = Math.max(0, Math.floor(Number(item.fox_tokens_paid || 0)));
    const creditedTokens = Math.max(0, Math.floor(Number(item.credited_tokens || 0)));
    if (item.item_type === 'season_reward') {
      return {
        category: 'commissions',
        type: tr('seasonReward'),
        title: `+${fmt(creditedTokens, 0)} FOX`,
        meta: `${tr('seasonRewardMeta')} - ${item.status || ''}`,
        amount: `+${fmt(creditedTokens, 0)} FOX`,
        tone: creditedTokens > 0 ? 'positive' : 'neutral',
        date: item.activated_at || item.created_at || item.updated_at || '',
        icon: 'ph:trophy-fill',
        itemType: item.item_type || '',
      };
    }
    const paidWithFox = foxTokens > 0 || String(item.network || '').toLowerCase() === 'fox';
    return {
      category: 'purchases',
      type: tr('payment'),
      title: `${item.item_type || 'item'} ${item.item_id || ''}`.trim(),
      meta: paidWithFox
        ? `${tr('foxUsed')}: ${fmt(foxTokens)} FOX (${fmt(item.fox_usdt_paid || item.amount_usdt, 2)} USDT) - ${item.status || ''}`
        : `${tr('usdtPaid')}: ${fmt(item.amount_usdt, 2)} USDT - ${item.status || ''}`,
      amount: paidWithFox ? `-${fmt(foxTokens)} FOX` : `-${fmt(item.amount_usdt, 2)} USDT`,
      tone: 'negative',
      date: item.created_at || item.updated_at || '',
      icon: item.item_type === 'skin' ? 'ph:sparkle-fill' : (item.item_type === 'avatar' ? 'ph:user-circle-fill' : 'ph:credit-card-fill'),
      itemType: item.item_type || '',
    };
  }).filter((item) => item.itemType !== 'package');
  const commissions = (dashboard.commissions || []).map((item) => ({
    category: 'commissions',
    type: tr('commission'),
    title: `${fmt(item.credited_tokens, 0)} FOX`,
    meta: `L${item.level || 1} - ${item.status || ''}`,
    amount: `+${fmt(item.credited_tokens, 0)} FOX`,
    tone: 'positive',
    date: item.created_at || '',
    icon: 'ph:users-three-fill',
  }));
  return [...purchases, ...withdrawals, ...payments, ...commissions]
    .filter((item) => walletHistoryFilter === 'all' || item.category === walletHistoryFilter)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, 24);
}

function walletView() {
  const player = dashboard.player;
  const wallet = walletTokens(player);
  const walletValue = walletUsdt(player);
  const heldFox = (dashboard.purchases || []).reduce((sum, item) => {
    const status = String(item.status || '').toLowerCase();
    return ['pending', 'waiting'].includes(status) ? sum + Math.max(0, Math.floor(Number(item.fox_tokens_paid || 0))) : sum;
  }, 0);
  const heldUsdt = heldFox * Number(dashboard?.settings?.token_price_usd || 0.0001);
  const cycleTokens = packCycleTokens(player);
  const capPercent = Math.min(100, (Number(player.total_earned_usd || 0) / Math.max(1, Number(player.cap_usd || 1))) * 100);
  const activities = walletActivities();
  const filters = [
    ['all', tr('allMovements')],
    ['purchases', tr('walletPurchases')],
    ['commissions', tr('walletCommissions')],
    ['withdrawals', tr('walletWithdrawals')],
  ];
  return `
    <section class="sheet-panel wallet-view">
      <div class="sheet-head"><span>${tr('wallet')}</span><strong>${tr('foxWallet')}</strong></div>
      <article class="wallet-hero-card">
        <span class="wallet-hero-icon">${coinIcon()}</span>
        <div>
          <small>${tr('walletBalance')}</small>
          <strong>${fmt(wallet)} FOX</strong>
          <p>${fmt(walletValue, 2)} USDT</p>
        </div>
      </article>
      ${heldFox > 0 ? `
        <article class="wallet-held-card">
          <span>${icon('ph:lock-key-fill')}</span>
          <div>
            <small>${tr('heldFox')}</small>
            <strong>${fmt(heldFox)} FOX</strong>
            <p>${tr('heldFoxText')} ${fmt(heldUsdt, 2)} USDT</p>
          </div>
        </article>
      ` : ''}
      <article class="wallet-cycle-card">
        <div>
          <small>${tr('currentPack')}</small>
          <strong>${player.package?.name || player.active_package_id || 'Pack'}</strong>
        </div>
        <div>
          <small>${tr('generatedPack')}</small>
          <strong>${fmt(cycleTokens)} FOX</strong>
        </div>
        <div class="wallet-progress">
          <span><b style="width:${capPercent}%"></b></span>
          <small>${fmt(player.total_earned_usd, 2)} / ${fmt(player.cap_usd, 2)} USDT</small>
        </div>
      </article>
      <div class="wallet-actions">
        <button type="button" data-view="withdraw">${icon('ph:arrow-circle-up-right-fill')} ${tr('withdraw')}</button>
        <button type="button" data-view="packs" data-packs-tab="shop">${icon('ph:package-fill')} ${tr('buyPacks')}</button>
      </div>
      <section class="wallet-history">
        <div class="wallet-history-head">
          <strong>${tr('recentActivity')}</strong>
        </div>
        <div class="wallet-history-tabs">
          ${filters.map(([value, label]) => `
            <button class="${walletHistoryFilter === value ? 'active' : ''}" type="button" data-wallet-filter="${value}">${label}</button>
          `).join('')}
        </div>
        ${activities.length ? activities.map((item) => `
          <article class="wallet-history-row wallet-history-row--${item.tone || 'neutral'}">
            <span>${icon(item.icon)}</span>
            <div>
              <small>${item.type} ${formatActivityDate(item.date)}</small>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.meta)}</p>
            </div>
            ${item.canResume
              ? `<div class="wallet-history-actions">
                  <button class="wallet-history-action" type="button" data-action="resume-payment" data-payment="${escapeAttr(item.paymentId)}">${icon('ph:qr-code-fill')} ${tr('continuePayment')}</button>
                  ${item.canCancel ? `<button class="wallet-history-action wallet-history-action--ghost" type="button" data-action="cancel-payment" data-payment="${escapeAttr(item.paymentId)}">${icon('ph:x-circle-fill')} ${tr('cancelPayment')}</button>` : ''}
                </div>`
              : `<b>${escapeHtml(item.amount || '')}</b>`}
          </article>
        `).join('') : `<p class="empty-state">${tr(walletHistoryFilter === 'all' ? 'noActivity' : 'noMovements')}</p>`}
      </section>
    </section>
  `;
}

function packageCapReached(player = dashboard?.player) {
  if (!player) return false;
  const capUsd = Number(player.cap_usd || 0);
  if (capUsd <= 0) return false;
  return Number(player.total_earned_usd || 0) >= capUsd;
}

function ownedSkins() {
  const owned = new Set(dashboard?.player?.owned_skins || []);
  return (dashboard?.skins || []).filter((skin) => skin.active !== false && owned.has(skin.id));
}

function activeSkins() {
  return dashboard?.player?.active_skins || ownedSkins().filter((skin) => (dashboard?.player?.selected_skins || []).includes(skin.id)).slice(0, 2);
}

const packageRank = (packageId = 'free') => ({
  free: 0,
  p30: 1,
  p60: 2,
  p120: 3,
  p480: 4,
  p960: 5,
}[packageId] ?? 0);

const minPartialUsdt = 20;
const minItemUsdtPayment = 20;
const closedPaymentStatuses = ['confirmed', 'finished', 'failed', 'expired', 'refunded', 'underpaid', 'cancelled', 'canceled'];

function paymentIsOpen(payment = {}) {
  return !closedPaymentStatuses.includes(String(payment.status || '').toLowerCase());
}

function paymentSecondsLeft(payment = {}) {
  if (payment.expires_at) {
    const expiresAt = new Date(payment.expires_at).getTime();
    if (!Number.isNaN(expiresAt)) return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  }
  return Math.max(0, Number(payment.seconds_left || 0));
}

function pendingPackagePayment(packageId = '') {
  const pendingPurchases = new Set((dashboard?.purchases || [])
    .filter((purchase) => (
      purchase.package_id === packageId
      && ['pending', 'waiting'].includes(String(purchase.status || '').toLowerCase())
    ))
    .map((purchase) => purchase.id));
  return (dashboard?.payments || []).find((payment) => (
    payment.item_type === 'package'
    && payment.item_id === packageId
    && paymentIsOpen(payment)
    && paymentSecondsLeft(payment) > 0
    && pendingPurchases.has(payment.id)
  )) || null;
}

function packageFoxPaymentLimits(pack) {
  const tokenPrice = Number(dashboard?.settings?.token_price_usd || 0.0001);
  const price = Number(pack?.price_usdt || 0);
  const wallet = walletTokens(dashboard?.player);
  const fullTokens = price > 0 ? Math.ceil((price / tokenPrice) - 1e-9) : 0;
  const minEffectiveTokens = tokenPrice > 0 ? Math.ceil(0.01 / tokenPrice) : 0;
  const partialMaxTokens = price > minPartialUsdt
    ? Math.floor(((price - minPartialUsdt) / tokenPrice) + 1e-9)
    : 0;
  const partialTokens = wallet >= minEffectiveTokens ? Math.min(wallet, partialMaxTokens) : 0;
  const maxTokens = wallet >= fullTokens ? fullTokens : partialTokens;
  return {
    tokenPrice,
    price,
    wallet,
    fullTokens,
    minEffectiveTokens,
    partialMaxTokens,
    maxTokens: Math.max(0, maxTokens),
  };
}

function normalizePackageFoxTokens(pack, requestedTokens) {
  const limits = packageFoxPaymentLimits(pack);
  const requested = Math.max(0, Math.floor(Number(requestedTokens || 0)));
  if (limits.wallet >= limits.fullTokens && requested >= limits.fullTokens) return limits.fullTokens;
  if (requested < limits.minEffectiveTokens) return 0;
  return Math.min(requested, limits.wallet, limits.partialMaxTokens);
}

function canUpgradeToPackage(packageId = 'free') {
  return packageRank(packageId) > packageRank(dashboard?.player?.active_package_id || 'free');
}

function canBuySkinsDirectly() {
  return true;
}

function skinBuyableForCurrentPack(skin = {}) {
  const buyerRank = packageRank(dashboard?.player?.active_package_id || 'free');
  const currentPack = dashboard?.player?.active_package_id || 'free';
  const packageIds = skin.roulette_package_ids || [];
  if (buyerRank < packageRank('p60')) return packageIds.includes(currentPack);
  if (!packageIds.length) return true;
  const eligibleRanks = packageIds.map((packId) => packageRank(packId));
  return buyerRank >= Math.min(...eligibleRanks);
}

function skinRequiredPackLabel(skin = {}) {
  const currentRank = packageRank(dashboard?.player?.active_package_id || 'free');
  const eligible = (skin.roulette_package_ids || [])
    .map((packId) => ({ id: packId, rank: packageRank(packId) }))
    .filter((item) => item.rank > currentRank)
    .sort((left, right) => left.rank - right.rank)[0];
  const fallback = currentRank < packageRank('p60') ? 'p60' : 'p960';
  const pack = (dashboard?.packages || []).find((item) => item.id === (eligible?.id || fallback));
  return pack?.name || (eligible?.id || fallback).toUpperCase();
}

function skinPriceTokens(skin = {}) {
  return Math.max(1, Math.ceil(Number(skin.price_usdt || 0) / Number(dashboard?.settings?.token_price_usd || 0.0001)));
}

function skinCardArt(skin, className = 'skin-art') {
  return `
    <button class="${className}" type="button" data-action="preview-skin" data-skin="${escapeAttr(skin.id)}" aria-label="${escapeAttr(skin.name)}">
      <img src="${skin.image_url}" alt="" loading="lazy" decoding="async" />
    </button>
  `;
}

function rouletteRewardMedia(reward = {}) {
  if (reward.reward_type === 'skin' && reward.item_id) {
    const skin = (dashboard?.skins || []).find((item) => item.id === reward.item_id);
    if (skin?.image_url) return `<img src="${skin.image_url}" alt="" loading="lazy" decoding="async" />`;
  }
  if (reward.reward_type === 'avatar' && reward.item_id) {
    const avatar = (dashboard?.avatars || []).find((item) => item.id === reward.item_id);
    if (avatar?.image_url) return `<img src="${avatar.image_url}" alt="" loading="lazy" decoding="async" />`;
  }
  if (reward.reward_type === 'tokens') return coinIcon();
  if (reward.reward_type === 'tickets') return ticketIcon();
  return icon('ph:x-circle-fill');
}

function skinRewardBonus(reward = {}) {
  const skin = (dashboard?.skins || []).find((item) => item.id === reward.item_id);
  return Math.max(0, Math.floor(Number(skin?.tap_bonus_per_day || 0)));
}

function rouletteLabelText(label = '') {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  return text.length > 16 ? `${text.slice(0, 14)}...` : text;
}

function rouletteTranslatedLabel(label = '') {
  const normalized = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const map = {
    'keep trying': tr('rouletteNoPrizeKeepTrying'),
    'try again': tr('rouletteNoPrizeKeepTrying'),
    'play again': tr('rouletteNoPrizeKeepTrying'),
    'no prize': tr('rouletteNoPrizeThisTime'),
    'no prize this time': tr('rouletteNoPrizeThisTime'),
    'almost': tr('rouletteNoPrizeAlmost'),
    'almost!': tr('rouletteNoPrizeAlmost'),
    'next time': tr('rouletteNoPrizeNextTime'),
    'miss': tr('rouletteNoPrizeMiss'),
    'empty': tr('rouletteNoPrizeEmpty'),
  };
  return map[normalized] || label;
}

function rouletteWheelText(reward = {}) {
  if (reward.reward_type === 'tokens') return rewardUsdtText(reward.amount || 0);
  if (reward.reward_type === 'tickets') return `+${fmt(reward.amount || 0, 0)} ticket`;
  if (reward.reward_type === 'skin') {
    const bonus = skinRewardBonus(reward);
    return bonus > 0 ? `Skin +${fmt(bonus, 0)}` : 'Skin';
  }
  if (reward.reward_type === 'avatar') return 'Avatar';
  return rouletteLabelText(rouletteTranslatedLabel(reward.label));
}

function roulettePrizeTitleText(spin = {}) {
  if (!spin || spin.reward_type === 'none') return tr('rouletteNoPrizeTitle');
  return tr('roulettePrizeTitle');
}

function roulettePrizeDisplayText(spin = {}) {
  const reward = {
    reward_type: spin.reward_type,
    item_id: spin.reward_item_id,
    amount: spin.reward_amount,
    label: spin.reward_label,
  };
  if (spin.reward_type === 'skin') {
    const bonus = skinRewardBonus(reward);
    return bonus > 0 ? `Skin +${fmt(bonus, 0)} FOX/day` : (spin.reward_label || 'Skin');
  }
  if (spin.reward_type === 'tokens') {
    return `${rewardUsdtText(spin.reward_amount || 0)} (${fmt(spin.reward_amount || 0, 0)} FOX)`;
  }
  return rouletteWheelText(reward);
}

function roulettePrizeOverlay() {
  if (!roulettePrizeReward) return '';
  const reward = {
    reward_type: roulettePrizeReward.reward_type,
    item_id: roulettePrizeReward.reward_item_id,
    amount: roulettePrizeReward.reward_amount,
    label: roulettePrizeReward.reward_label,
  };
  const isSkinPrize = roulettePrizeReward.reward_type === 'skin';
  return `
    <section class="roulette-prize-overlay" role="dialog" aria-modal="true">
      <article class="roulette-prize-card">
        <button class="roulette-prize-close" type="button" data-action="roulette-prize-close" aria-label="Close">${icon('ph:x-bold')}</button>
        <span class="roulette-prize-media">${rouletteRewardMedia(reward)}</span>
        <div class="roulette-prize-copy">
          <small>${tr('roulette')}</small>
          <h2>${roulettePrizeTitleText(roulettePrizeReward)}</h2>
          <p>${escapeHtml(roulettePrizeDisplayText(roulettePrizeReward))}</p>
        </div>
        <button class="roulette-prize-primary" type="button" data-action="${isSkinPrize ? 'roulette-prize-skins' : 'roulette-prize-close'}">${isSkinPrize ? tr('goSkins') : tr('roulettePrizeClose')}</button>
      </article>
    </section>
  `;
}

function skinPreviewOverlay() {
  if (!skinPreviewId) return '';
  const skin = (dashboard?.skins || []).find((item) => item.id === skinPreviewId);
  if (!skin) return '';
  return `
    <section class="skin-preview-overlay" role="dialog" aria-modal="true">
      <article class="skin-preview-card">
        <button class="skin-preview-close" type="button" data-action="close-skin-preview" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
        <span class="skin-preview-art"><img src="${skin.image_url}" alt="" /></span>
        <div class="skin-preview-copy">
          <small>${tr('skins')}</small>
          <h2>${escapeHtml(skin.name)}</h2>
          <p>${tr('skinDaily', { count: fmt(skin.tap_bonus_per_day, 0) })}</p>
        </div>
      </article>
    </section>
  `;
}

function skinFoxConfirmOverlay() {
  if (!pendingSkinFoxPurchase) return '';
  const skin = (dashboard?.skins || []).find((item) => item.id === pendingSkinFoxPurchase.skinId);
  if (!skin) return '';
  const priceTokens = skinPriceTokens(skin);
  return `
    <section class="skin-confirm-overlay" role="dialog" aria-modal="true">
      <article class="skin-confirm-card">
        <button class="skin-preview-close" type="button" data-action="skin-fox-cancel" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
        <span class="skin-preview-art"><img src="${skin.image_url}" alt="" /></span>
        <div class="skin-preview-copy">
          <small>${tr('skinStore')}</small>
          <h2>${escapeHtml(skin.name)}</h2>
          <p>${tr('confirmSkinFox', { tokens: fmt(priceTokens, 0), name: skin.name })}</p>
          <strong>${tr('skinDaily', { count: fmt(skin.tap_bonus_per_day, 0) })} · ${fmt(skin.price_usdt, 2)} USDT</strong>
          ${skinFoxError ? `<em class="skin-confirm-error">${escapeHtml(skinFoxError)}</em>` : ''}
        </div>
        <div class="skin-confirm-actions">
          <button class="skin-confirm-secondary" type="button" data-action="skin-fox-cancel">${tr('cancel')}</button>
          <button class="skin-confirm-primary" type="button" data-action="skin-fox-confirm" data-skin="${skin.id}">${coinIcon()} ${tr('confirm')}</button>
        </div>
      </article>
    </section>
  `;
}

function withdrawalChangeOverlay() {
  if (!pendingWithdrawalChange) return '';
  const request = pendingWithdrawalChange;
  return `
    <section class="skin-confirm-overlay withdraw-change-overlay" role="dialog" aria-modal="true">
      <article class="skin-confirm-card withdraw-change-card">
        <button class="payment-close" type="button" data-action="withdraw-change-cancel" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
        <span class="withdraw-change-icon">${icon('ph:shield-check-duotone')}</span>
        <div class="skin-preview-copy">
          <small>${tr('withdraw')}</small>
          <h2>${tr('walletChangeTitle')}</h2>
          <p>${tr('walletChangeBody')}</p>
        </div>
        <div class="withdraw-change-summary">
          <small>${request.network.toUpperCase()}</small>
          <strong>${shortHash(request.wallet)}</strong>
        </div>
        <label class="withdraw-change-password">
          ${icon('ph:lock-key-duotone')}
          <input id="withdraw-change-password" type="password" autocomplete="current-password" placeholder="${tr('walletChangePassword')}" />
        </label>
        <small class="withdraw-error" id="withdraw-change-password-error"></small>
        <div class="skin-confirm-actions">
          <button class="skin-confirm-secondary" type="button" data-action="withdraw-change-cancel">${tr('cancel')}</button>
          <button class="skin-confirm-primary" type="button" data-action="withdraw-change-confirm">${icon('ph:check-bold')} ${tr('walletChangeConfirm')}</button>
        </div>
      </article>
    </section>
  `;
}

function withdrawalPendingOverlay() {
  if (!pendingWithdrawalNotice) return '';
  return `
    <section class="skin-confirm-overlay withdraw-pending-overlay" role="dialog" aria-modal="true">
      <article class="skin-confirm-card withdraw-pending-card">
        <button class="payment-close" type="button" data-action="withdraw-pending-close" aria-label="${tr('close')}">${icon('ph:x-bold')}</button>
        <span class="withdraw-change-icon">${icon('ph:clock-countdown-duotone')}</span>
        <div class="skin-preview-copy">
          <small>${tr('withdraw')}</small>
          <h2>${tr('pendingApproval')}</h2>
        </div>
        <button class="roulette-prize-primary" type="button" data-action="withdraw-pending-close">${tr('continue')}</button>
      </article>
    </section>
  `;
}

function rouletteRewardTone(reward = {}) {
  if (reward.reward_type === 'skin') return 'skin';
  if (reward.reward_type === 'tokens') return 'tokens';
  if (reward.reward_type === 'tickets') return 'tickets';
  if (reward.reward_type === 'avatar') return 'avatar';
  return 'none';
}

function rouletteConicGradient(rewards = []) {
  const palette = ['#c5127f', '#e50742', '#ee4b1d', '#f7a715', '#f1ea18', '#5fb63a', '#159b69', '#1fa0cf', '#1d6ab6', '#46308c'];
  const count = Math.max(1, rewards.length);
  return rewards.map((reward, index) => {
    const start = (index / count) * 100;
    const end = ((index + 1) / count) * 100;
    const color = reward.reward_type === 'none' ? '#38507f' : palette[index % palette.length];
    return `${color} ${start}% ${end}%`;
  }).join(', ');
}

function rouletteSliceColor(reward = {}, index = 0) {
  const palette = ['#3f297e', '#20a56f', '#e6471d', '#1d61ac', '#c01486', '#67b83d', '#dc0936', '#18a7d7', '#f7a416', '#4b2f91', '#159b69', '#e5177b'];
  return palette[index % palette.length];
}

function rouletteRewardTypeClass(reward = {}) {
  if (reward.reward_type === 'tokens') return 'quiz';
  if (reward.reward_type === 'tickets') return 'time';
  if (reward.reward_type === 'none') return 'replay';
  if (reward.reward_type === 'skin' || reward.reward_type === 'avatar') return 'question';
  return '';
}

function rouletteWheelMarkup(rewards = [], spinDisabled = false) {
  const visibleRewards = rewards.length ? rewards : [{ label: tr('rouletteNeedTicket'), reward_type: 'none' }];
  const step = 360 / visibleRewards.length;
  const size = 346;
  const radius = size * 0.5;
  const borderTopWidth = size + (size * 0.0025);
  const borderRightWidth = size * Math.tan(step * Math.PI / 180);
  const textHeight = ((2 * Math.PI * radius) / visibleRewards.length) * 0.5;
  const labelX = textHeight * 1.03;
  const labelY = size * -0.25;
  const labelHeight = Math.floor(textHeight);
  const labelTextIndent = radius * 0.1;
  return `
    <div class="codepen-roulette" style="--wheel-size:${size}px">
      <div class="spinner">
      ${visibleRewards.map((reward, index) => `
        <div class="item" data-index="${index}" data-type="${rouletteRewardTypeClass(reward)}" style="border-top-width:${borderTopWidth}px; border-right-width:${borderRightWidth}px; border-top-color:${rouletteSliceColor(reward, index)}; transform:scale(2) rotate(${(step * (visibleRewards.length - index)) - 90 - (step * 0.5)}deg);">
          <span class="label" style="transform:translateY(${labelY}px) translateX(${labelX}px) rotateZ(${90 + (step * 0.5)}deg); height:${labelHeight}px; line-height:${labelHeight}px; text-indent:${labelTextIndent}px;">
            <span class="text">${escapeHtml(rouletteWheelText(reward))}</span>
          </span>
        </div>
      `).join('')}
      </div>
      <div class="shadow"></div>
      <div class="markers"><div class="triangle"></div></div>
      <button class="button" type="button" data-action="roulette-spin" ${spinDisabled ? 'disabled' : ''}><span>SPIN</span></button>
    </div>
  `;
}

function animateRouletteSpin(spin = {}, rewards = []) {
  const spinner = document.querySelector('.codepen-roulette .spinner');
  if (!spinner || !rewards.length) return Promise.resolve();
  const count = rewards.length;
  const step = 360 / count;
  const rewardIndex = Math.max(0, rewards.findIndex((reward) => reward.id === spin.reward_id));
  rouletteSpinCount += 1;
  const turns = 5 + (rouletteSpinCount % 2);
  const settle = Math.random() * Math.max(2, step * 0.28) - Math.max(1, step * 0.14);
  const target = (turns * 360) + (rewardIndex * step) + settle;
  spinner.classList.add('is-spinning');
  spinner.style.transition = 'none';
  spinner.style.transform = 'rotateZ(0deg)';
  spinner.offsetHeight;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      spinner.removeEventListener('transitionend', finish);
      spinner.classList.remove('is-spinning');
      resolve();
    };
    spinner.addEventListener('transitionend', finish);
    window.setTimeout(finish, 4700);
    window.requestAnimationFrame(() => {
      spinner.style.transition = 'transform 4400ms cubic-bezier(0.12, 0.72, 0.12, 1)';
      spinner.style.transform = `rotateZ(${target}deg)`;
    });
  });
}

function cardsViewContent() {
  const tokenPrice = Number(dashboard.settings?.token_price_usd || 0.0001);
  const wallet = walletTokens(dashboard.player);
  return `
      ${cryptoNetworkSelector()}
      <div class="pack-grid">
        ${dashboard.packages.map((pack) => {
          const price = Number(pack.price_usdt || 0);
          const isActivePack = dashboard.player.active_package_id === pack.id;
          const canUpgrade = canUpgradeToPackage(pack.id);
          const foxNeeded = price > 0 ? Math.ceil(price / tokenPrice) : 0;
          const foxLimits = packageFoxPaymentLimits(pack);
          const foxToUse = foxLimits.maxTokens;
          const canNearlyUseFox = canUpgrade && price > 0 && foxLimits.wallet > 0 && foxLimits.wallet < foxLimits.minEffectiveTokens;
          const canUseFox = canUpgrade && price > 0 && foxToUse > 0;
          const lockedLabel = isActivePack ? tr('activePack') : tr('lowerPack');
          const pendingPayment = pendingPackagePayment(pack.id);
          const pendingFox = Math.max(0, Math.floor(Number(pendingPayment?.fox_tokens_paid || 0)));
          const pendingExpired = pendingPayment && paymentSecondsLeft(pendingPayment) <= 0;
          const capValue = fmt(pack.monthly_cap_usd, Number(pack.monthly_cap_usd || 0) % 1 ? 2 : 0);
          return `
            <article class="pack-card ${dashboard.player.active_package_id === pack.id ? 'pack-card--active' : ''}">
              <button class="pack-card-art pack-info-trigger" type="button" data-action="pack-info-open" data-package="${pack.id}" aria-label="${tr('packInfoTitle')} ${escapeAttr(pack.name || pack.id)}">${packageIconMarkup(pack)}</button>
              <div class="pack-card-main">
                <strong class="pack-card-title">${pack.name}</strong>
                <div class="pack-cap-showcase">
                  <small>${tr('generatesUpTo')}</small>
                  <span>${capValue} USDT</span>
                </div>
                <small class="pack-energy"><svg class="pack-energy-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.2 2 4.8 13.1h6.2L9.8 22l8.4-12h-6.1L13.2 2Z" fill="currentColor"/></svg><span>Energia: ${fmt(pack.daily_energy)}</span></small>
              </div>
              <div class="pack-actions">
                ${pendingPayment ? `
                  <small class="pack-pending-note">${tr('pendingPackPayment')}${pendingFox ? ` - ${tr('pendingPackHeld', { count: fmt(pendingFox) })}` : ''}</small>
                  <button class="pack-continue-button" type="button" data-action="resume-payment" data-payment="${escapeAttr(pendingPayment.id)}">
                    ${icon(pendingExpired ? 'ph:clock-countdown-bold' : 'ph:qr-code-fill')} ${pendingExpired ? tr('checkingPayment') : tr('continuePayment')}
                  </button>
                ` : `
                  <button type="button" data-action="buy" data-package="${pack.id}" ${canUpgrade ? '' : 'disabled'}>
                    ${canUpgrade ? (price ? `${tr('payUsdt')} ${fmt(price)}` : tr('free')) : lockedLabel}
                  </button>
                  ${canUseFox ? `<button class="pack-fox-button" type="button" data-action="package-fox-open" data-package="${pack.id}" data-fox-tokens="${foxToUse}">
                    ${tr('useFox')} ${fmt(foxToUse)}
                  </button>` : (canNearlyUseFox ? `<small class="pack-fox-minimum">${tr('minFoxPayment', { tokens: fmt(foxLimits.minEffectiveTokens) })}</small>` : '')}
                `}
              </div>
            </article>
          `;
        }).join('')}
      </div>
  `;
}

function minerViewContent() {
  const player = dashboard.player;
  const levels = player.upgrade_cards_levels || {};
  const passiveRate = Number(player.passive_income_per_hour || 0);
  
  // Calculate offline claiming details
  const now = Date.now();
  const lastClaim = Date.parse(player.last_passive_claim_timestamp || new Date().toISOString());
  const msDiff = now - lastClaim;
  const hoursDiff = Math.max(0, msDiff / (1000 * 60 * 60));
  const cappedHours = Math.min(3.0, hoursDiff);
  const claimablePoints = Math.floor(cappedHours * passiveRate);

  const categories = [
    { id: 'marketing', label: 'Marketing', icon: 'ph:megaphone-fill' },
    { id: 'technology', label: 'Tecnología', icon: 'ph:cpu-fill' },
    { id: 'business', label: 'Negocios', icon: 'ph:briefcase-fill' }
  ];

  const cards = (dashboard.upgrade_cards || []).filter(c => c.category === activeMinerTab);
  const directCount = Number(player.rank?.direct_count || 0);

  function getCardIcon(cardId) {
    const iconsMap = {
      tg_channel: 'ph:telegram-logo-fill',
      wa_group: 'ph:whatsapp-logo-fill',
      tiktok_campaign: 'ph:tiktok-logo-fill',
      influencer_mkt: 'ph:users-three-fill',
      local_servers: 'ph:hard-drive-fill',
      aws_cloud: 'ph:cloud-fill',
      foxpay_validator: 'ph:shield-check-fill',
      ai_autotap: 'ph:cpu-fill',
      brand_registration: 'ph:trademark-registered-fill',
      fintech_license: 'ph:file-text-fill',
      smart_contract_audit: 'ph:shield-star-fill'
    };
    return iconsMap[cardId] || 'ph:cards-fill';
  }

  return `
    <style>
      @keyframes spin-slow {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes pulse-soft {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 0.95; }
      }
      @keyframes ellipsis-dots {
        0% { content: ""; }
        25% { content: "."; }
        50% { content: ".."; }
        75% { content: "..."; }
      }
      .ellipsis-dots::after {
        content: "";
        display: inline-block;
        width: 12px;
        text-align: left;
        animation: ellipsis-dots 1.5s steps(4, end) infinite;
      }
      @keyframes glowing-pulse {
        0% {
          transform: scale(1);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        }
        50% {
          transform: scale(1.02);
          box-shadow: 0 4px 25px rgba(16, 185, 129, 0.7), 0 0 10px rgba(16, 185, 129, 0.3);
        }
        100% {
          transform: scale(1);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        }
      }
    </style>
      <!-- Stats Board -->
      <div class="miner-stats-card" style="background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.05)); border: 1px solid rgba(168,85,247,0.3); border-radius: 20px; padding: 20px; margin-bottom: 20px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
        <div style="display: flex; justify-content: space-around; align-items: center; gap: 15px;">
          <div>
            <small style="color: rgba(255,255,255,0.6); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Producción por Hora</small>
            <div style="font-size: 1.5rem; font-weight: 800; color: #a855f7; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
              ${icon('ph:clock-fill')} +${fmt(passiveRate)} GFOX/h
            </div>
          </div>
          
          <div style="border-left: 1px solid rgba(255,255,255,0.1); height: 40px;"></div>
          
          <div>
            <small style="color: rgba(255,255,255,0.6); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Por reclamar</small>
            <div style="font-size: 1.5rem; font-weight: 800; color: #10b981; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
              +${fmt(claimablePoints)} GFOX
            </div>
          </div>
        </div>
        
        ${claimablePoints > 0 ? `
          <button class="claim-passive-btn" type="button" data-action="claim-passive" style="margin-top: 15px; width: 100%; background: #10b981; color: #fff; border: none; padding: 12px; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; animation: glowing-pulse 2s infinite ease-in-out;">
            Reclamar Ganancias Pasivas
          </button>
        ` : `
          <button type="button" disabled style="margin-top: 15px; width: 100%; background: rgba(16, 45, 111, 0.35); color: rgba(255, 255, 255, 0.5); border: 1px solid rgba(91, 177, 255, 0.15); padding: 12px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; animation: pulse-soft 2.5s ease-in-out infinite;">
            <span style="display: inline-flex; animation: spin-slow 4s linear infinite; font-size: 1.2rem; color: #7cecff;">
              ${icon('ph:clock-fill')}
            </span>
            <span>Minando<span class="ellipsis-dots"></span> (Reclamar cuando sume)</span>
          </button>
        `}
        <div style="margin-top: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.4);">
          ${tr('minerMaxOffline')}
        </div>
      </div>
      
      <!-- Category Tabs -->
      <div class="miner-tabs" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 5px; border: 1px solid rgba(91, 177, 255, 0.28); border-radius: 18px; background: rgba(6, 18, 58, 0.72); margin-bottom: 20px;">
        ${categories.map(cat => {
          const isActive = activeMinerTab === cat.id;
          return `
            <button class="miner-tab-btn ${isActive ? 'active' : ''}" type="button" data-action="miner-tab" data-tab="${cat.id}" style="min-height: 42px; border-radius: 14px; cursor: pointer; font-size: 13px; font-weight: 200; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; ${isActive ? 'color: #08205a; border: 1px solid rgba(255, 239, 157, 0.95); background: linear-gradient(180deg, #fff7aa 0%, #ffda5e 48%, #f2ad24 100%); box-shadow: 0 0 8px rgba(255, 226, 92, 0.8), 0 0 20px rgba(255, 188, 42, 0.52), inset 0 2px 0 rgba(255, 255, 255, 0.62), inset 0 -4px 8px rgba(155, 91, 0, 0.32); text-shadow: 0 1px 0 rgba(255, 255, 255, 0.28);' : 'border: none; color: rgba(255, 255, 255, 0.76); background: rgba(5, 17, 56, 0.72);'}">
              ${icon(cat.icon)} <span>${cat.label}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Upgrade Cards Grid -->
      <div class="cards-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        ${cards.map(c => {
          const currentLvl = Number(levels[c.id] || 0);
          const nextLvl = currentLvl + 1;
          const cost = Math.floor(c.baseCost * Math.pow(c.costMultiplier, currentLvl));
          const profit = c.baseProfit;
          const hasBalance = Number(player.game_fox_balance || 0) >= cost;

          // Check lock requirements
          let isLocked = false;
          let lockReason = '';
          
          if (c.requires) {
            const req = c.requires;
            if (req.type === 'card') {
              const reqLvl = Number(levels[req.id] || 0);
              const target = (dashboard.upgrade_cards || []).find(x => x.id === req.id);
              if (reqLvl < req.level) {
                isLocked = true;
                lockReason = `Requiere ${target ? target.name : req.id} Nivel ${req.level}`;
              }
            } else if (req.type === 'invites') {
              if (directCount < req.count) {
                isLocked = true;
                lockReason = `Requiere ${req.count} amigos invitados (${directCount}/${req.count})`;
              }
            } else if (req.type === 'card_and_invites') {
              const reqLvl = Number(levels[req.id] || 0);
              const target = (dashboard.upgrade_cards || []).find(x => x.id === req.id);
              if (reqLvl < req.level) {
                isLocked = true;
                lockReason = `Requiere ${target ? target.name : req.id} Nivel ${req.level}`;
              } else if (directCount < req.invites) {
                isLocked = true;
                lockReason = `Requiere ${req.invites} amigos invitados (${directCount}/${req.invites})`;
              }
            } else if (req.type === 'card_and_premium') {
              const reqLvl = Number(levels[req.id] || 0);
              const target = (dashboard.upgrade_cards || []).find(x => x.id === req.id);
              if (reqLvl < req.level) {
                isLocked = true;
                lockReason = `Requiere ${target ? target.name : req.id} Nivel ${req.level}`;
              } else if (player.active_package_id === 'free') {
                isLocked = true;
                lockReason = `Requiere paquete de pago activo`;
              }
            }
          }

          if (isLocked) {
            return `
              <article class="card-item locked" style="background: linear-gradient(180deg, rgba(16, 45, 111, 0.25), rgba(10, 22, 70, 0.15)); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px dashed rgba(91, 177, 255, 0.15); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; min-height: 135px; opacity: 0.8; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.25);">
                <div style="display: flex; gap: 10px; align-items: flex-start;">
                  <div style="background: rgba(255,255,255,0.02); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: rgba(255,255,255,0.25); border: 1px dashed rgba(255,255,255,0.08); flex-shrink: 0;">
                    ${icon('ph:lock-key-fill')}
                  </div>
                  <div>
                    <strong style="font-size: 0.8rem; color: rgba(255,255,255,0.4); font-weight: 700; line-height: 1.2; display: block; margin-bottom: 2px;">${c.name}</strong>
                    <small style="font-size: 0.62rem; color: rgba(255,255,255,0.25); display: block;">Profit per hour</small>
                    <div style="display: flex; align-items: center; gap: 4px; margin-top: 1px; opacity: 0.4;">
                      <span style="width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center;">${coinIcon()}</span>
                      <span style="font-size: 0.72rem; color: #fff; font-weight: 700;">+${fmt(profit)}</span>
                    </div>
                  </div>
                </div>
                
                <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 8px; text-align: center;">
                  <span style="font-size: 0.62rem; color: #fb7185; font-weight: 600; line-height: 1.2; background: rgba(244, 63, 94, 0.08); padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(244, 63, 94, 0.2); display: inline-block; max-width: 95%; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);">
                    ${lockReason}
                  </span>
                </div>
              </article>
            `;
          }

          return `
            <article class="card-item" style="background: linear-gradient(180deg, rgba(16, 45, 111, 0.55), rgba(10, 22, 70, 0.45)); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(91, 177, 255, 0.25); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; min-height: 135px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.25);">
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <div style="background: rgba(52, 139, 255, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: #7cecff; border: 1px solid rgba(52, 139, 255, 0.3); flex-shrink: 0;">
                  ${icon(getCardIcon(c.id))}
                </div>
                <div>
                  <strong style="font-size: 0.8rem; color: #fff; font-weight: 700; line-height: 1.2; display: block; margin-bottom: 2px; word-break: break-word; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${c.name}</strong>
                  <small style="font-size: 0.62rem; color: rgba(255,255,255,0.55); display: block;">Profit per hour</small>
                  <div style="display: flex; align-items: center; gap: 4px; margin-top: 1px;">
                    <span style="width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center;">${coinIcon()}</span>
                    <span style="font-size: 0.72rem; color: #34d399; font-weight: 800;">+${fmt(profit)}</span>
                  </div>
                </div>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
                <span style="font-size: 0.72rem; color: rgba(255,255,255,0.6); font-weight: 700;">lvl ${currentLvl}</span>
                <button class="upgrade-card-btn" type="button" data-action="upgrade-card" data-card="${c.id}" ${hasBalance ? '' : 'disabled'} style="border: none; padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; ${hasBalance ? 'background: linear-gradient(180deg, #57e7ff, #2b8cff); color: #10205a; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 4px 12px rgba(43, 140, 255, 0.25);' : 'background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.3); border: 1px solid rgba(255, 255, 255, 0.05);'}">
                  <span style="width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center;">${coinIcon()}</span>
                  <span>${fmt(cost)}</span>
                </button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
  `;
}

function packsView() {
  return `
    <section class="sheet-panel packs-view">
      <div class="sheet-head">
        <span>${tr('packages')}</span>
        <strong>${packsTab === 'miner' ? 'Mineradora' : tr('navPacks')}</strong>
      </div>
      
      <div class="skin-tabs" role="tablist" aria-label="${tr('packages')}">
        <button class="${packsTab === 'miner' ? 'active' : ''}" type="button" data-action="packs-tab" data-tab="miner" role="tab" aria-selected="${packsTab === 'miner'}">
          <img class="tab-pico-img" src="./images/pico.png" alt="" /> Mineradora
        </button>
        <button class="${packsTab === 'shop' ? 'active' : ''}" type="button" data-action="packs-tab" data-tab="shop" role="tab" aria-selected="${packsTab === 'shop'}">
          ${coinIcon('tab-coin-img')} Paquetes
        </button>
      </div>
      
      <div style="margin-top: 15px; width: 100%;">
        ${packsTab === 'miner' ? minerViewContent() : cardsViewContent()}
      </div>
    </section>
  `;
}

function packageFoxConfirmOverlay() {
  if (!pendingPackageFoxPurchase) return '';
  const pack = (dashboard?.packages || []).find((item) => item.id === pendingPackageFoxPurchase.packageId);
  if (!pack) return '';
  const limits = packageFoxPaymentLimits(pack);
  if (limits.maxTokens <= 0) return '';
  const selectedTokens = normalizePackageFoxTokens(pack, pendingPackageFoxPurchase.foxTokens || limits.maxTokens);
  const selectedUsdt = roundUsdtCents(Math.min(limits.price, selectedTokens * limits.tokenPrice));
  const usdtDue = selectedTokens >= limits.fullTokens ? 0 : ceilUsdtCents(Math.max(0, limits.price - selectedUsdt));
  const stepTokens = Math.max(1, limits.minEffectiveTokens);
  return `
    <section class="skin-confirm-overlay fox-upgrade-overlay" role="dialog" aria-modal="true">
      <article class="skin-confirm-card fox-upgrade-card">
        <button class="payment-close" type="button" data-action="package-fox-cancel" aria-label="Close">${icon('ph:x-bold')}</button>
        <span class="fox-upgrade-coin">${coinIcon()}</span>
        <div class="fox-upgrade-copy">
          <small>${pack.name}</small>
          <strong>${tr('chooseFoxPayment')}</strong>
        </div>
        <article class="fox-upgrade-wallet">
          <span>${icon('ph:wallet-duotone')}</span>
          <div>
            <small>${tr('foxWalletAvailable')}</small>
            <strong>${fmt(limits.wallet)} FOX</strong>
            <b>(${fmt(limits.wallet * limits.tokenPrice, 2)} USDT)</b>
          </div>
        </article>
        <div class="fox-upgrade-summary">
          <article>
            <span>${coinIcon()}</span>
            <small>${tr('foxAmountToUse')}</small>
            <strong><span data-fox-upgrade-tokens>${fmt(selectedTokens)}</span> FOX</strong>
          </article>
          <article>
            <span>${icon('ph:currency-dollar-duotone')}</span>
            <small>${tr('usdtToPay')}</small>
            <strong><span data-fox-upgrade-usdt>${fmt(usdtDue, 2)}</span> USDT</strong>
          </article>
        </div>
        <label class="fox-upgrade-control">
          <input type="range" min="0" max="${limits.maxTokens}" step="${stepTokens}" value="${selectedTokens}" data-fox-upgrade-range data-package="${pack.id}" />
          <span class="fox-upgrade-input-wrap">
            <small>${tr('foxAmountToUse')}</small>
            <input type="number" min="0" max="${limits.maxTokens}" step="${stepTokens}" value="${selectedTokens}" data-fox-upgrade-input data-package="${pack.id}" />
            <b>${coinIcon()} FOX</b>
          </span>
        </label>
        <p class="fox-upgrade-note">${icon('ph:info-duotone')} ${limits.wallet >= limits.fullTokens ? tr('allFoxAllowed') : tr('minUsdtPayment', { amount: fmt(minPartialUsdt, 0) })}</p>
        <div class="skin-confirm-actions">
          <button class="skin-confirm-secondary" type="button" data-action="package-fox-cancel">${tr('cancel')}</button>
          <button class="skin-confirm-primary" type="button" data-action="package-fox-confirm" data-package="${pack.id}" data-fox-tokens="${selectedTokens}">${coinIcon()} ${tr('payWithSelection')}</button>
        </div>
      </article>
    </section>
  `;
}

function packInfoOverlay() {
  if (!packInfoId) return '';
  const pack = (dashboard?.packages || []).find((item) => item.id === packInfoId);
  if (!pack) return '';
  const cap = Number(pack.monthly_cap_usd || 0);
  const daily = cap / 30;
  const price = Number(pack.price_usdt || 0);
  const capValue = fmt(cap, cap % 1 ? 2 : 0);
  const dailyValue = fmt(daily, daily % 1 ? 2 : 0);
  return `
    <section class="pack-info-overlay" role="dialog" aria-modal="true">
      <article class="pack-info-card">
        <button class="payment-close" type="button" data-action="pack-info-close" aria-label="Close">${icon('ph:x-bold')}</button>
        <span class="pack-info-art">${packageIconMarkup(pack)}</span>
        <div class="pack-info-head">
          <small>${tr('packInfoTitle')}</small>
          <strong>${pack.name || pack.id}</strong>
        </div>
        <div class="pack-info-stats">
          <article>
            <small>${tr('packInfoTotal')}</small>
            <strong>${capValue} USDT</strong>
          </article>
          <article>
            <small>${tr('packInfoDaily')}</small>
            <strong>${dailyValue} USDT</strong>
          </article>
        </div>
        <div class="pack-info-energy">
          <span><svg class="pack-energy-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.2 2 4.8 13.1h6.2L9.8 22l8.4-12h-6.1L13.2 2Z" fill="currentColor"/></svg> Energia: ${fmt(pack.daily_energy)}</span>
          <span>${price > 0 ? `${tr('payUsdt')} ${fmt(price)}` : tr('free')}</span>
        </div>
        <p>${tr('packInfoDailyNote')}</p>
        <button class="pack-info-primary" type="button" data-action="pack-info-close">${tr('continue')}</button>
      </article>
    </section>
  `;
}

function dailyStreakCalendarHtml() {
  const player = dashboard.player;
  const isFree = player.active_package_id === 'free';
  if (!isFree) return '';

  const streakDays = Math.max(0, Number(player.streak_days || 0));
  const checkinTask = taskList().find(t => t.id === 'daily_check');
  const claimedToday = checkinTask ? checkinTask.claimed : false;

  const currentDay = claimedToday 
    ? ((streakDays - 1) % 7) + 1 
    : (streakDays % 7) + 1;

  const rewards = [
    { day: 1, points: 10, tickets: 0 },
    { day: 2, points: 25, tickets: 0 },
    { day: 3, points: 50, tickets: 1 },
    { day: 4, points: 100, tickets: 0 },
    { day: 5, points: 250, tickets: 0 },
    { day: 6, points: 500, tickets: 2 },
    { day: 7, points: 1500, tickets: 5 }
  ];

  return `
    <div class="daily-streak-container" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-bottom: 20px;">
      <div class="streak-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <strong style="font-size: 0.95rem; color: #fff; display: flex; align-items: center; gap: 6px;">
          ${icon('ph:calendar-check-fill')} Racha Diaria
        </strong>
        <span style="font-size: 0.8rem; background: rgba(168, 85, 247, 0.2); color: #c084fc; padding: 2px 8px; border-radius: 99px; font-weight: 700;">
          Día ${streakDays} total
        </span>
      </div>
      
      <div class="streak-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
        ${rewards.map(r => {
          const isClaimed = r.day < currentDay || (r.day === currentDay && claimedToday);
          const isActive = r.day === currentDay && !claimedToday;
          
          let cardStyle = "background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); opacity: 0.6;";
          let iconColor = "color: rgba(255,255,255,0.4);";
          let labelColor = "color: rgba(255,255,255,0.4);";
          
          if (isClaimed) {
            cardStyle = "background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); opacity: 1;";
            iconColor = "color: #22c55e;";
            labelColor = "color: #86efac;";
          } else if (isActive) {
            cardStyle = "background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; box-shadow: 0 0 10px rgba(168, 85, 247, 0.3); opacity: 1;";
            iconColor = "color: #c084fc;";
            labelColor = "color: #fff;";
          }

          const ticketText = r.tickets > 0 ? ` +${r.tickets}🎟️` : '';
          const gridColumnSpan = r.day === 7 ? 'grid-column: span 2;' : '';

          return `
            <div class="streak-day-card" style="border-radius: 12px; padding: 10px 4px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; ${cardStyle} ${gridColumnSpan}">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; ${labelColor}">Día ${r.day}</span>
              <div style="font-size: 1.1rem; margin: 4px 0; ${iconColor}">
                ${isClaimed ? icon('ph:check-circle-fill') : (r.tickets > 0 ? icon('ph:ticket-fill') : icon('ph:coin-fill'))}
              </div>
              <span style="font-size: 0.75rem; font-weight: 800; ${labelColor}">
                +${fmt(r.points)}${ticketText}
              </span>
            </div>
          `;
        }).join('')}
      </div>

      ${!claimedToday ? `
        <button class="claim-streak-btn" type="button" data-action="task" data-task="daily_check" style="width: 100%; background: #a855f7; color: #fff; border: none; padding: 10px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: transform 0.2s;">
          Hacer Check-in Diario (+${fmt(rewards[currentDay - 1]?.points || 100)} GFOX)
        </button>
      ` : `
        <button class="claim-streak-btn claim-streak-btn--done" type="button" disabled style="width: 100%; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.08); padding: 10px; border-radius: 12px; font-weight: 800;">
          Check-in de hoy completado
        </button>
      `}
    </div>
  `;
}

function shopView() {
  if (dashboard.api_offline && !dashboard.api_error) {
    return `
      <section class="sheet-panel">
        <div class="sheet-head"><span>${tr('daily')}</span><strong>${tr('tasks')}</strong></div>
        <div class="task-loading-card" role="status" aria-live="polite">
          <span>${icon('ph:spinner-gap-bold')}</span>
          <strong>${tr('loadingTasks')}</strong>
        </div>
      </section>
    `;
  }
  const isFree = dashboard.player?.active_package_id === 'free';
  const rawTasks = taskList();
  const tasks = isFree ? rawTasks.filter(t => t.id !== 'daily_check') : rawTasks;
  const capReached = packageCapReached();
  const activeTaskLock = activeExternalTaskLock();
  return `
    <section class="sheet-panel">
      <div class="sheet-head"><span>${tr('daily')}</span><strong>${tr('tasks')}</strong></div>
      ${dailyStreakCalendarHtml()}
      ${capReached ? `<div class="offline-banner offline-banner--cap">${tr('capTasksBlocked')}</div>` : (tasksDoneToday() ? `<div class="offline-banner">${tr('tasksDone')}</div>` : '')}
      <div class="task-list">
        ${tasks.map((task) => {
          const progressState = ['youtube', 'social'].includes(task.type) ? videoProgressState(task) : null;
          const progressBadge = videoProgressBadge(task, progressState);
          const blockedByActiveTask = Boolean(activeTaskLock && activeTaskLock.id !== task.id);
          const description = progressState?.progress
            ? progressState.label
            : (task.type === 'youtube' && task.url ? tr('openYoutube', { watch: fmt(task.watch_seconds || 30), delay: fmt(task.reward_delay_seconds ?? 30) }) : taskDescriptionText(task));
          return `
          <button class="task-row ${task.claimed ? 'task-row--done' : ''} ${progressState?.progress ? 'task-row--progress' : ''} ${blockedByActiveTask ? 'task-row--locked' : ''}" type="button" data-action="task" data-task="${task.id}" data-task-row="${task.id}" ${capReached || task.claimed || (task.type !== 'referral' && !task.ready) ? 'disabled' : ''}>
            <span>${icon(task.claimed ? 'ph:check-circle-fill' : (task.type === 'referral' ? 'ph:users-three-duotone' : (task.type === 'partner' ? 'ph:link-simple-bold' : (task.type === 'social' ? socialTaskIcon(task.platform) : 'ph:play-circle-duotone'))))}</span>
            <div>
              <strong>${taskTitleText(task)}</strong>
              <small data-task-progress-description>${description}</small>
            </div>
            <b class="task-check-badge ${progressState?.progress ? 'task-check-badge--progress' : ''}" data-task-progress-badge data-badge-mode="${progressState?.progress ? `progress:${progressState.phase}` : `default:${task.claimed}:${task.ready}:${blockedByActiveTask}`}">${progressBadge || taskDefaultBadge(task, capReached || blockedByActiveTask)}</b>
          </button>
        `;
        }).join('')}
      </div>
    </section>
  `;
}

function earnMoreView() {
  const player = dashboard.player;
  if (!player.is_registered) {
    return accountGateView(tr('withdraw'));
  }
  const minUsdt = Number(dashboard.settings.withdrawal_min_usdt || 10);
  const pending = (dashboard.withdrawals || []).find((item) => item.status === 'pending');
  const pendingWithdrawal = Boolean(pending);
  const savedNetwork = ['bep20', 'polygon', 'tron'].includes(player.withdrawal_network) ? player.withdrawal_network : 'bep20';
  const savedWallet = player.withdrawal_wallet || '';
  const hasSavedWallet = Boolean(savedWallet);
  const withdrawalItems = dashboard.withdrawals || [];
  const withdrawalPageSize = 2;
  const withdrawalTotalPages = Math.max(1, Math.ceil(withdrawalItems.length / withdrawalPageSize));
  withdrawHistoryPage = Math.max(1, Math.min(withdrawHistoryPage, withdrawalTotalPages));
  const withdrawalStart = (withdrawHistoryPage - 1) * withdrawalPageSize;
  const visibleWithdrawals = withdrawalItems.slice(withdrawalStart, withdrawalStart + withdrawalPageSize);
  return `
    <section class="sheet-panel withdraw-view">
      <div class="sheet-head"><span>${tr('withdraw')}</span><strong>${tr('convertUsdt')}</strong></div>
      <article class="withdraw-card ${pendingWithdrawal ? 'withdraw-card--pending' : ''}">
        <div class="withdraw-headline">
          <span>${icon('ph:wallet-duotone')}</span>
          <div>
            <strong>${fmt(player.token_balance)} FOX</strong>
            <small>${fmt(player.usdt_balance, 2)} USDT · ${dashboard.settings.token_price_usd} USD/token</small>
          </div>
        </div>
        <div class="network-select">
          ${paymentNetworks.map(([value, label]) => `
            <button class="${savedNetwork === value ? 'active' : ''}" type="button" data-network-option="${value}">${networkButtonContent(value, label)}</button>
          `).join('')}
        </div>
        <input id="withdraw-network" type="hidden" value="${savedNetwork}" />
        ${hasSavedWallet ? `<small class="withdraw-saved-note">${tr('savedWithdrawalWallet')}: ${savedNetwork.toUpperCase()} - ${shortHash(savedWallet)}</small>` : ''}
        ${pendingWithdrawal ? '' : `
          <label class="withdraw-input-wrap">
            ${icon('ph:wallet-duotone')}
            <input id="withdraw-wallet" placeholder="${withdrawalPlaceholder(savedNetwork)}" value="${escapeAttr(savedWallet)}" data-saved-wallet="${escapeAttr(savedWallet)}" data-saved-network="${escapeAttr(savedNetwork)}" />
          </label>
          <small class="withdraw-error" id="withdraw-wallet-error"></small>
        `}
        ${pendingWithdrawal ? '' : `
          <label class="withdraw-input-wrap">
            ${icon('ph:currency-dollar-duotone')}
            <input id="withdraw-usdt" type="number" min="${minUsdt}" step="0.01" placeholder="Min ${fmt(minUsdt, 2)} USDT" />
          </label>
          <div class="withdraw-action-stack">
            <small class="withdraw-fee-note">${tr('withdrawalFeeNote')}</small>
            <button class="withdraw-submit" type="button" data-action="withdraw">${tr('requestWithdrawal')}</button>
          </div>
        `}
      </article>
      <section class="withdraw-history">
        <div class="withdraw-history-head">
          <strong>${tr('withdrawalHistory')}</strong>
          <small>${tr('historyPage', { page: fmt(withdrawHistoryPage, 0), total: fmt(withdrawalTotalPages, 0) })}</small>
        </div>
        <div class="withdraw-list">
          ${visibleWithdrawals.length ? visibleWithdrawals.map((item) => `
            <article class="withdraw-row">
              <div>
                <strong>${fmt(item.usdt_amount, 2)} USDT</strong>
                <small>${item.network || 'network'} - ${item.status}</small>
                ${item.tx_url ? `<a href="${item.tx_url}" target="_blank" rel="noopener">${shortHash(item.tx_hash)}</a>` : ''}
              </div>
              <b>${fmt(item.tokens)} FOX</b>
            </article>
          `).join('') : `<article class="withdraw-row withdraw-row--empty"><span>${tr('noActivity')}</span></article>`}
        </div>
        ${withdrawalTotalPages > 1 ? `
          <div class="withdraw-pagination">
            <button type="button" data-action="withdraw-page" data-page="${withdrawHistoryPage - 1}" ${withdrawHistoryPage <= 1 ? 'disabled' : ''}>${tr('previousPage')}</button>
            <span>${fmt(withdrawalStart + 1, 0)}-${fmt(Math.min(withdrawalStart + visibleWithdrawals.length, withdrawalItems.length), 0)} / ${fmt(withdrawalItems.length, 0)}</span>
            <button type="button" data-action="withdraw-page" data-page="${withdrawHistoryPage + 1}" ${withdrawHistoryPage >= withdrawalTotalPages ? 'disabled' : ''}>${tr('nextPage')}</button>
          </div>
        ` : ''}
      </section>
      <article class="withdraw-note">${tr('capWithdrawNote')}</article>
      ${serviceWorkerUpdatePrompt('inline')}
    </section>
  `;
}

function accountGateView(context = tr('profile')) {
  return `
    <section class="sheet-panel">
      <div class="sheet-head"><span>${context}</span><strong>${tr('secureAccount')}</strong></div>
      ${accountGateCards()}
    </section>
  `;
}

function accountGateCards(options = {}) {
  const loginOnly = Boolean(options.loginOnly);
  const captchaOptions = registerCaptchaOptions();
  const captchaPrompt = captchaPromptText(dashboard?.register_captcha?.prompt);
  return `
      ${loginOnly ? '' : `
      <article class="profile-card auth-card">
        <strong>${tr('createAccount')}</strong>
        <label class="auth-input-wrap">
          ${icon('ph:user-circle-duotone')}
          <input id="register-username" autocomplete="username" placeholder="${tr('username')}" />
        </label>
        <label class="auth-input-wrap">
          ${icon('ph:envelope-simple-duotone')}
          <input id="register-email" autocomplete="email" type="email" inputmode="email" placeholder="${tr('emailPlaceholder')}" />
        </label>
        <label class="auth-input-wrap auth-input-wrap--password">
          ${icon('ph:lock-key-duotone')}
          <input id="register-password" autocomplete="new-password" type="password" placeholder="${tr('passwordMin')}" />
          <button class="password-toggle-button" type="button" data-password-toggle="register-password" aria-label="${tr('showPassword')}" title="${tr('showPassword')}">
            ${icon('ph:eye-bold')}
          </button>
        </label>
        <div class="game-captcha" data-register-captcha>
          <div>
            <strong>${tr('securityQuest')}</strong>
            <small>${captchaPrompt}</small>
          </div>
          <div class="game-captcha-grid">
            ${captchaOptions.map((item) => `
              <button class="${registerCaptcha.selected === item.id ? 'is-selected' : ''}" type="button" data-captcha-choice="${item.id}" aria-label="${item.label}">
                ${item.icon}
              </button>
            `).join('')}
          </div>
          <small class="game-captcha-feedback" id="register-captcha-feedback">${registerCaptcha.selected ? tr('tokenSelected') : tr('chooseToken')}</small>
        </div>
        <label class="legal-accept-row">
          <input type="checkbox" data-action="terms-accept" ${registerTermsAccepted ? 'checked' : ''} />
          <span>${tr('acceptTerms')} <a href="/terms" target="_blank" rel="noopener">${tr('readTerms')}</a></span>
        </label>
        <button type="button" data-action="register" ${registerTermsAccepted ? '' : 'disabled'}>${icon('ph:shield-check-duotone')} ${tr('registerDevice')}</button>
      </article>
      `}
      <article class="profile-card auth-card">
        <strong>${tr('loginExisting')}</strong>
        <label class="auth-input-wrap">
          ${icon('ph:user-circle-duotone')}
          <input id="login-username" autocomplete="username" placeholder="${tr('username')}" />
        </label>
        <label class="auth-input-wrap auth-input-wrap--password">
          ${icon('ph:lock-key-duotone')}
          <input id="login-password" autocomplete="current-password" type="password" placeholder="${tr('password')}" />
          <button class="password-toggle-button" type="button" data-password-toggle="login-password" aria-label="${tr('showPassword')}" title="${tr('showPassword')}">
            ${icon('ph:eye-bold')}
          </button>
        </label>
        <button type="button" data-action="login">${icon('ph:sign-in-duotone')} ${tr('login')}</button>
      </article>
  `;
}

function sessionExpiredView() {
  return `
    <section class="sheet-panel session-expired-view">
      <article class="profile-card session-expired-card">
        <strong>${tr('sessionExpiredTitle')}</strong>
        <small>${tr('sessionExpiredText')}</small>
      </article>
      ${accountGateCards({ loginOnly: true })}
    </section>
  `;
}

function accountEmailCard() {
  const player = dashboard?.player || {};
  if (!player.is_registered || player.email) return '';
  return `
    <article class="profile-card auth-card email-required-card">
      <strong>${tr('emailMissingTitle')}</strong>
      <small>${tr('emailMissingText')}</small>
      <label class="auth-input-wrap">
        ${icon('ph:envelope-simple-duotone')}
        <input id="profile-email" autocomplete="email" type="email" inputmode="email" placeholder="${tr('emailPlaceholder')}" />
      </label>
      <button type="button" data-action="save-email">${icon('ph:check-circle-duotone')} ${tr('saveEmail')}</button>
    </article>
  `;
}

function supportUnreadCount() {
  return Math.max(0, Math.floor(Number(dashboard?.support?.unread_count || 0)));
}

function supportStatusLabel(status) {
  return ({
    open: tr('supportOpen'),
    waiting_admin: tr('supportWaitingAdmin'),
    waiting_user: tr('supportWaitingUser'),
    closed: tr('supportClosed'),
  }[status] || tr('supportOpen'));
}

const supportRatingOptions = [
  { rating: 1, emoji: '😠' },
  { rating: 2, emoji: '🙁' },
  { rating: 3, emoji: '😐' },
  { rating: 4, emoji: '🙂' },
  { rating: 5, emoji: '😄' },
];

function supportCategoryLabel(category) {
  return ({
    account: tr('profile'),
    purchase: tr('buyPacks'),
    withdrawal: tr('withdraw'),
    tasks: tr('tasks'),
    blocked: tr('blockedTitle'),
    other: tr('support'),
  }[category] || tr('support'));
}

function supportRatingLabel(rating) {
  return tr(`supportRating${Math.max(1, Math.min(5, Math.floor(Number(rating) || 0)))}`);
}

function supportRatingText(rating) {
  return tr(`supportRating${Math.max(1, Math.min(5, Math.floor(Number(rating) || 0)))}`);
}

function supportRatingMarkup(ticketId) {
  return `
    <div class="support-rating-grid" role="group" aria-label="${escapeHtml(tr('supportRateTitle'))}">
      ${supportRatingOptions.map((option) => `
        <button class="support-rating-button" type="button" data-action="support-rate" data-ticket="${ticketId}" data-rating="${option.rating}" aria-label="${option.rating} ${option.emoji} ${supportRatingText(option.rating)}">
          <span class="support-rating-emoji">${option.emoji}</span>
          <small class="support-rating-text">${supportRatingText(option.rating)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function supportBadgeMarkup(count = supportUnreadCount()) {
  return count > 0 ? `<span class="support-badge">${fmt(count, 0)}</span>` : '';
}

function profileView() {
  const player = dashboard.player;
  const sponsorId = player.sponsor_id || player.referrer_id || '';
  const sponsorUsername = player.sponsor_username || '';
  const unread = supportUnreadCount();
  const sessionExpired = player.is_registered && dashboard.session_valid === false;
  return `
    <section class="sheet-panel">
      <div class="sheet-head"><span>${tr('profile')}</span><strong>${player.is_registered ? player.username : tr('deviceAccount')}</strong></div>
      ${sessionExpired ? `
        <article class="profile-card session-expired-card">
          <strong>${tr('sessionExpiredTitle')}</strong>
          <small>${tr('sessionExpiredText')}</small>
        </article>
      ` : ''}
      <article class="profile-card">
        <strong>${player.is_registered ? tr('registeredAccount') : 'Device ID'}</strong>
        <small>${player.is_registered ? tr('readyWithdrawals') : tr('registerBeforeWithdrawals')}</small>
        <p>${player.player_id}</p>
        ${player.email ? `<small>${tr('email')}: ${escapeHtml(player.email)}</small>` : ''}
        <small>${player.country_name || player.country_code ? `${tr('country')}: ${player.country_name || player.country_code}` : tr('countryPending')}</small>
      </article>
      <article class="profile-card streak-profile-card">
        <span>${icon('ph:fire-duotone')}</span>
        <div>
          <strong>${tr('streakDays')}</strong>
          <small>${tr('streakDaysText')}</small>
        </div>
        <b>${tr('streakDaysValue', { count: playerRank(player) })}</b>
      </article>
      <article class="profile-card sponsor-profile-card">
        <div class="sponsor-card-head">
          <span>${icon('ph:users-three-duotone')}</span>
          <div>
            <strong>${tr('sponsor')}</strong>
            <small>${sponsorId ? tr('sponsorId') : tr('sponsorNone')}</small>
          </div>
        </div>
        ${sponsorId ? `
          <div class="sponsor-data-grid">
            <div>
              <small>${tr('sponsorId')}</small>
              <p>${escapeHtml(sponsorId)}</p>
            </div>
            <div>
              <small>${tr('sponsorUsername')}</small>
              <p>${escapeHtml(sponsorUsername || tr('sponsorUnregistered'))}</p>
            </div>
          </div>
        ` : `<p class="sponsor-empty">${tr('sponsorNone')}</p>`}
      </article>
      <article class="profile-card profile-links-card">
        <strong>${tr('projectInfo')}</strong>
        <small>${tr('projectInfoText')}</small>
        <div class="profile-link-grid">
          <a class="profile-link-button" href="/story">
            ${icon('ph:book-open-text-duotone')}
            <span>${tr('openStory')}</span>
          </a>
        </div>
      </article>
      ${sessionExpired ? accountGateCards({ loginOnly: true }) : (!player.is_registered ? accountGateCards() : accountEmailCard())}
      <article class="profile-card">
        <strong>${tr('referralLink')}</strong>
        <small>${tr('shareInvite')}</small>
        <p>${player.referral_link}</p>
        <button type="button" data-action="copy-ref">${icon('ph:copy-duotone')} ${tr('copyLink')}</button>
      </article>
      <article class="profile-card">
        <strong>${tr('referralBonus')}</strong>
        <small>${tr('referralBonusText')}</small>
      </article>
      <article class="profile-card support-entry-card ${unread ? 'support-entry-card--unread' : ''}">
        <span>${icon('ph:chat-circle-dots-duotone')}</span>
        <div>
          <strong>${tr('support')}${supportBadgeMarkup(unread)}</strong>
          <small>${tr('supportProfileText')}</small>
        </div>
        <button type="button" data-view="support">${tr('contactSupport')}</button>
      </article>
    </section>
  `;
}

function supportView() {
  const support = dashboard.support || { tickets: [], unread_count: 0 };
  const tickets = support.tickets || [];
  const pendingRatingTicket = tickets.find((ticket) => ticket.status === 'closed' && !Number(ticket.rating || 0)) || null;
  if (!supportSelectedTicketId && tickets.length) supportSelectedTicketId = pendingRatingTicket?.id || tickets[0].id;
  const selected = tickets.find((ticket) => ticket.id === supportSelectedTicketId) || pendingRatingTicket || tickets[0] || null;
  const selectedClosed = selected?.status === 'closed';
  const canReply = selected?.status === 'waiting_user';
  const canOpenNewTicket = !pendingRatingTicket;
  const ratingPrompt = pendingRatingTicket && pendingRatingTicket.id !== selected?.id ? `
    <article class="profile-card support-rating-card">
      <strong>${tr('supportRateTitle')}</strong>
      <small>${escapeHtml(tr('supportRatePrompt'))}</small>
      ${supportRatingMarkup(pendingRatingTicket.id)}
      <button class="ghost-button compact-button" type="button" data-action="support-open" data-ticket="${pendingRatingTicket.id}">
        ${tr('supportRateOpen')}
      </button>
    </article>
  ` : '';
  const composeCard = `
    <details class="profile-card support-compose-card support-compose-details" ${tickets.length ? '' : 'open'}>
      <summary>${icon('ph:plus-circle-bold')} ${tr('contactSupport')}</summary>
      <label>
        <small>${tr('supportCategory')}</small>
        <select id="support-category">
          <option value="account">${tr('profile')}</option>
          <option value="blocked">${tr('blockedTitle')}</option>
          <option value="purchase">${tr('buyPacks')}</option>
          <option value="withdrawal">${tr('withdraw')}</option>
          <option value="tasks">${tr('tasks')}</option>
          <option value="other">${tr('support')}</option>
        </select>
      </label>
      <label>
        <small>${tr('supportMessage')}</small>
        <textarea id="support-message" maxlength="1200" placeholder="${tr('supportMessagePlaceholder')}"></textarea>
      </label>
      <label class="support-image-picker">
        <small>${tr('supportImageOptional')}</small>
        <input id="support-image" type="file" accept="image/png,image/jpeg,image/webp" />
        <span>${tr('supportImageHint')}</span>
      </label>
      <button type="button" data-action="support-send">${icon('ph:paper-plane-tilt-bold')} ${tr('sendSupport')}</button>
    </details>
  `;
  return `
    <section class="sheet-panel support-view">
      <div class="sheet-head">
        <span>${tr('profile')}</span>
        <strong>${tr('supportCenter')}</strong>
      </div>
      ${ratingPrompt}
      ${tickets.length ? `<article class="profile-card support-ticket-panel">
        <div class="support-ticket-panel-head">
          <strong>${tr('supportMyTickets')}</strong>
          <small>${fmt(tickets.length, 0)}</small>
        </div>
        <div class="support-ticket-list">
          ${tickets.map((ticket) => {
            const lastMessage = (ticket.messages || []).slice(-1)[0] || {};
            const lastPreview = lastMessage.message || (lastMessage.image_url ? tr('supportImageAttached') : supportStatusLabel(ticket.status));
            return `
              <button class="support-ticket-row ${selected?.id === ticket.id ? 'is-active' : ''} ${ticket.has_unread ? 'has-unread' : ''}" type="button" data-action="support-open" data-ticket="${ticket.id}">
                <i></i>
                <span>
                  <strong>${supportCategoryLabel(ticket.category)}</strong>
                  <small>${escapeHtml(lastPreview)}</small>
                  <time>${formatActivityDate(lastMessage.created_at || ticket.last_message_at || ticket.created_at)}</time>
                </span>
                <em>${supportStatusLabel(ticket.status)}</em>
                ${ticket.unread_count > 0 ? `<b>${fmt(ticket.unread_count, 0)}</b>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </article>` : ''}
      ${selected ? `
        <article class="profile-card support-thread-card">
          <div class="support-thread-head">
            <strong>${supportCategoryLabel(selected.category)}</strong>
            <span class="support-status support-status--${selected.status}">${supportStatusLabel(selected.status)}</span>
          </div>
          <div class="support-messages">
            ${(selected.messages || []).map((message) => `
              <div class="support-message support-message--${message.sender_type}">
                ${message.message ? `<p>${escapeHtml(message.message)}</p>` : ''}
                ${message.image_url ? `<img class="support-message-image" src="${escapeAttr(message.image_url)}" alt="${tr('supportImageAttached')}" loading="lazy" decoding="async" />` : ''}
                <small>${formatActivityDate(message.created_at)}</small>
              </div>
            `).join('')}
          </div>
          ${selectedClosed && !Number(selected.rating || 0) ? `
            <article class="support-rating-card">
              <div class="support-rating-card-head">
                <strong>${tr('supportRateTitle')}</strong>
                <small>${escapeHtml(tr('supportRatePrompt'))}</small>
              </div>
              ${supportRatingMarkup(selected.id)}
            </article>
          ` : selected.rating ? `
            <div class="support-rating-result">
              <span class="support-rating-result-emoji">${supportRatingOptions.find((item) => item.rating === Number(selected.rating))?.emoji || '😄'}</span>
              <div>
                <strong>${supportRatingLabel(selected.rating)}</strong>
                <small>${tr('supportRateSaved')}</small>
              </div>
            </div>
          ` : ''}
          ${canReply ? `
            <label>
              <small>${tr('supportReply')}</small>
              <textarea id="support-reply-message" maxlength="1200" placeholder="${tr('supportMessagePlaceholder')}"></textarea>
            </label>
            <label class="support-image-picker">
              <small>${tr('supportImageOptional')}</small>
              <input id="support-reply-image" type="file" accept="image/png,image/jpeg,image/webp" />
              <span>${tr('supportImageHint')}</span>
            </label>
            <button type="button" data-action="support-reply" data-ticket="${selected.id}">${icon('ph:chat-circle-text-bold')} ${tr('supportReply')}</button>
          ` : (selectedClosed ? '' : `<div class="support-wait-note">${tr('supportWaitAdminReply')}</div>`)}
        </article>
      ` : ''}
      ${canOpenNewTicket ? composeCard : ''}
    </section>
  `;
}

async function rateSupportTicket(ticketId, rating) {
  const data = await api('/api/foxpay/support/rate', {
    player_id: playerId,
    ticket_id: ticketId,
    rating,
  });
  if (dashboard) dashboard.support = data.support || dashboard.support;
  if (data.ticket?.id) supportSelectedTicketId = data.ticket.id;
  render();
  toast(tr('supportRateSaved'));
}

function referralsView() {
  const player = dashboard.player;
  const referrals = dashboard.referrals || { total: 0, active: 0, estimated_bonus_usdt: 0, estimated_bonus_tokens: 0, rows: [] };
  const unilevel = dashboard.unilevel || { total_network: 0, by_level: [], rows: [] };
  const avatarUrl = player.avatar_url || './images/fox-optimized.webp';
  return `
    <section class="sheet-panel referrals-view">
      <div class="sheet-head"><span>${tr('friends')}</span><strong>${tr('referrals')}</strong></div>
      <article class="referral-hero-card">
        <span class="referral-profile-art"><img src="${avatarUrl}" alt="" loading="lazy" decoding="async" /></span>
        <div>
          <strong>${tr('invited', { count: fmt(referrals.total) })}</strong>
          <small>${tr('activePackages', { count: fmt(referrals.active) })}</small>
        </div>
        <button type="button" data-action="copy-ref">${icon('ph:copy-duotone')} ${tr('copy')}</button>
      </article>
      <button class="network-open-button" type="button" data-view="earnings">${icon('ph:chart-line-up-duotone')} ${tr('openEarnings')}</button>
      <article class="profile-card">
        <strong>${tr('inviteLink')}</strong>
        <p>${player.referral_link}</p>
      </article>
      <section class="unilevel-panel">
        <div class="unilevel-title">
          <strong>${tr('unilevelMap')}</strong>
          <small>${tr('usersNetwork', { count: fmt(unilevel.total_network || 0) })}</small>
        </div>
        <button class="network-open-button" type="button" data-view="network">${icon('ph:tree-structure-duotone')} ${tr('openNetwork')}</button>
        <div class="unilevel-level-chips">
          ${(unilevel.by_level || []).map((item) => `<span>L${item.level}<b>${item.count}</b></span>`).join('')}
        </div>
        <div class="unilevel-list">
          ${(unilevel.rows || []).slice(0, 40).map((row) => `
            <article>
              <span>L${row.level}</span>
              <div><strong>${row.username || row.player_id}</strong><small class="referral-country-line">${countryDisplayMarkup(row)} · ${row.active_package_id}</small></div>
              <b>${fmt(row.commission_rate, 2)}%</b>
            </article>
          `).join('') || `<p class="empty-state">${tr('noNetwork')}</p>`}
        </div>
      </section>
      <section class="unilevel-panel">
        <div class="unilevel-title">
          <strong>${tr('commissionHistory')}</strong>
          <small>${tr('lostByCap', { count: fmt((dashboard.commissions || []).reduce((sum, row) => sum + Number(row.lost_tokens || 0), 0), 0) })}</small>
        </div>
        <div class="unilevel-list">
          ${(dashboard.commissions || []).slice(0, 20).map((row) => `
            <article>
              <span>L${row.level}</span>
              <div><strong>${tr('credited', { count: fmt(row.credited_tokens, 0) })}</strong><small>${tr('lost', { count: fmt(row.lost_tokens, 0) })} - ${row.source_type} - ${row.status}</small></div>
              <b>${fmt(row.rate, 2)}%</b>
            </article>
          `).join('') || `<p class="empty-state">${tr('noCommissions')}</p>`}
        </div>
      </section>
      <div class="referral-list">
        ${(referrals.rows || []).length ? referrals.rows.map((row) => `
          <article class="referral-row">
            <span>${icon(row.active_package_id === 'free' ? 'ph:user-circle-duotone' : 'ph:star-four-fill')}</span>
            <div>
              <strong>${row.username || tr('foxPlayer')}</strong>
              <small class="referral-country-line">${countryDisplayMarkup(row)} · ${row.active_package_id}</small>
            </div>
            <b>${fmt(row.token_balance)} FOX</b>
          </article>
        `).join('') : `
          <article class="empty-state">
            <strong>${tr('noReferrals')}</strong>
            <small>${tr('shareTeam')}</small>
          </article>
        `}
      </div>
    </section>
  `;
}

function packLabel(pack) {
  if (!pack) return tr('unknown');
  const price = Number(pack.price_usdt || 0);
  return price > 0 ? `${pack.name || pack.id} - ${fmt(price, 0)} USDT` : (pack.name || pack.id || 'Free');
}

function packDisplayTitle(pack) {
  const price = Number(pack?.price_usdt || 0);
  if (price > 0) return `${fmt(price, 0)} USDT Pack`;
  return pack?.name || 'Free Tap';
}

function packLevelGridClass(count) {
  if (count <= 1) return 'is-one';
  if (count <= 2) return 'is-two';
  if (count <= 3) return 'is-three';
  return '';
}

function earningsView() {
  const player = dashboard.player;
  const settings = dashboard.settings || {};
  const config = settings.unilevel_config || {};
  const packs = (dashboard.packages || [])
    .filter((pack) => config[pack.id] || pack.id === player.active_package_id)
    .sort((left, right) => packageRank(left.id) - packageRank(right.id));
  return `
    <section class="sheet-panel earnings-view">
      <div class="network-toolbar">
        <button type="button" data-view="friends">${icon('ph:arrow-left-bold')} ${tr('back')}</button>
      </div>
      <header class="earnings-pack-head">
        <span></span>
        <div>
          <h2>${tr('earningsTitle')}</h2>
          <p>${tr('levelRulesText')}</p>
        </div>
      </header>
      <section class="earnings-rules-panel">
        <div class="pack-level-list">
          ${packs.map((pack) => {
            const rates = Array.isArray(config[pack.id]) ? config[pack.id] : [];
            const active = pack.id === player.active_package_id;
            return `
              <article class="pack-level-card ${active ? 'is-active' : ''}">
                <header>
                  <div class="pack-level-title">
                    <span class="pack-level-icon">${packageIconMarkup(pack)}</span>
                    <div>
                      <strong>${packDisplayTitle(pack)}</strong>
                      <small>${Number(pack.price_usdt || 0) > 0 ? `${fmt(pack.price_usdt, 0)} USDT` : ''} <em>${pack.id}</em> ${active ? `<mark>${icon('ph:check-circle-fill')} ${tr('activePack')}</mark>` : ''}</small>
                    </div>
                  </div>
                  <b>${rates.length ? `${rates.length} ${tr('levels')}` : tr('noLevel')}</b>
                </header>
                <div class="pack-level-grid ${packLevelGridClass(rates.length)}">
                  ${rates.length ? rates.map((rate, index) => `
                    <span class="${index === 0 ? 'is-primary' : ''}"><small>${tr('levelShort', { level: index + 1 })}</small><strong>${fmt(rate, 2)}%</strong></span>
                  `).join('') : `<p>${tr('noActiveCommission')}</p>`}
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    </section>
  `;
}

function networkMapView() {
  const player = dashboard.player;
  const unilevel = dashboard.unilevel || { total_network: 0, by_level: [], rows: [] };
  const rows = unilevel.rows || [];
  const rootId = player.player_id;
  const byParent = new Map();
  rows.forEach((row) => {
    const parentId = row.referrer_id || rootId;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(row);
  });
  const levels = Array.from({ length: 10 }, (_, index) => rows.filter((row) => Number(row.level) === index + 1));
  const rootChildren = byParent.get(rootId) || levels[0] || [];
  return `
    <section class="sheet-panel network-map-view">
      <div class="sheet-head">
        <span>${tr('friends')}</span>
        <strong>${tr('networkMap')}</strong>
      </div>
      <div class="network-toolbar">
        <button type="button" data-view="friends">${icon('ph:arrow-left-bold')} ${tr('back')}</button>
        <div>
          <button type="button" data-network-zoom="out">${icon('ph:magnifying-glass-minus-bold')}</button>
          <b data-network-zoom-label>${Math.round(networkZoom * 100)}%</b>
          <button type="button" data-network-zoom="in">${icon('ph:magnifying-glass-plus-bold')}</button>
        </div>
      </div>
      <div class="network-canvas">
        <div class="network-scale" style="--network-scale:${networkZoom}">
          <article class="network-root">
            <span><img src="${player.avatar_url || './images/fox-optimized.webp'}" alt="" /></span>
            <strong>${player.username || tr('you')}</strong>
            <small>${tr('you')}</small>
          </article>
          ${rows.length ? `
            <div class="network-branch ${rootChildren.length ? 'has-children' : ''}">
              ${levels.map((levelRows, index) => levelRows.length ? `
                <section class="network-level">
                  <header>L${index + 1}<b>${levelRows.length}</b></header>
                  <div>
                    ${levelRows.map((row) => `
                      <article class="network-node" title="${row.username || row.player_id}">
                        <span>${row.level <= 1 ? icon('ph:user-circle-duotone') : icon('ph:users-three-duotone')}</span>
                        <strong>${row.username || tr('foxPlayer')}</strong>
                        <small class="referral-country-line">${countryDisplayMarkup(row)} · ${row.active_package_id || 'free'} · ${fmt(row.commission_rate, 2)}%</small>
                      </article>
                    `).join('')}
                  </div>
                </section>
              ` : '').join('')}
            </div>
          ` : `<div class="empty-state network-empty"><strong>${tr('noNetwork')}</strong><small>${tr('shareTeam')}</small></div>`}
        </div>
      </div>
    </section>
  `;
}

function leaderboardView() {
  const rows = leaderboardRows();
  return `
    <section class="leaderboard-view">
      <div class="leader-title">
        <span>${icon('fluent-emoji:trophy')}</span>
        <strong>${tr('leaderboard')}</strong>
      </div>
      ${dashboard.api_offline ? `<div class="offline-banner">${tr('localMode')}</div>` : ''}
      ${seasonStatusCard()}
      <div class="leader-tabs" role="tablist" aria-label="Leaderboard type">
        <button class="${leaderboardMode === 'premium' ? 'active' : ''}" type="button" data-leader-mode="premium">Premium</button>
        <button class="${leaderboardMode === 'standard' ? 'active' : ''}" type="button" data-leader-mode="standard">Standard</button>
      </div>
      <div class="leaderboard-card">
        ${rows.length ? rows.map((row) => `
          <article class="leaderboard-row ${row.active ? 'is-current' : ''}">
            <span class="leader-avatar">
              ${row.avatar ? `<img src="${row.avatar}" alt="" loading="lazy" decoding="async" />` : uxImage(row.iconAsset || 'profile-icon.webp', 'ux-img')}
            </span>
            <div>
              <strong><span>${row.name}</span></strong>
              ${leaderboardRankBadge(row)}
            </div>
            <span class="leader-coins">${coinIcon()} ${fmt(row.coins)}</span>
          </article>
        `).join('') : `<article class="empty-state"><strong>${tr('noPlayers')}</strong><small>${tr('rankingFills')}</small></article>`}
      </div>
    </section>
  `;
}

function rouletteView() {
  const tickets = Math.max(0, Math.floor(Number(dashboard.player?.roulette_tickets || 0)));
  const rewards = dashboard.roulette_rewards || [];
  const cost = Math.max(1, Math.floor(Number(dashboard.player?.roulette_ticket_cost || 1)));
  const capReached = packageCapReached();
  const backTarget = capReached ? 'packs' : (tickets < cost ? 'tasks' : 'earn');
  const backLabel = capReached ? tr('buyAnotherPack') : (tickets < cost ? tr('goToTasks') : tr('backToEarn'));
  const backIcon = capReached ? 'ph:plus-bold' : (tickets < cost ? 'ph:clipboard-text-fill' : 'ph:arrow-left-bold');
  return `
    <section class="roulette-page">
      <div class="sheet-head">
        <span>${tr('rouletteReady')}</span>
        <strong>${tr('roulette')}</strong>
      </div>
      <div class="roulette-ticket-pill">${ticketIcon()} <strong>${fmt(tickets)}</strong> ${tr('rouletteTickets')}</div>
      <div class="roulette-stage">
        <span class="roulette-glow"></span>
        ${rouletteWheelMarkup(rewards, capReached || tickets < cost || !rewards.length)}
      </div>
      ${lastRouletteSpin ? `<p class="roulette-note roulette-note--result">${tr('rouletteResult', { reward: rouletteTranslatedLabel(lastRouletteSpin.reward_label) })}</p>` : `<p class="roulette-note">${rewards.length ? rewards.map((reward) => rouletteTranslatedLabel(reward.label)).slice(0, 4).join(' · ') : tr('rouletteNeedTicket')}</p>`}
      <button class="roulette-spin-button" type="button" data-action="roulette-spin" ${capReached || tickets < cost || !rewards.length ? 'disabled' : ''}>${ticketIcon()} ${capReached ? tr('buyAnotherPack') : (tickets < cost ? tr('rouletteNeedTicket') : tr('rouletteSpin'))}</button>
      <small class="roulette-cost">${tr('rouletteCost', { count: fmt(cost, 0) })}</small>
      <button class="roulette-back" type="button" data-view="${backTarget}">${icon(backIcon)} ${backLabel}</button>
    </section>
  `;
}

function skinsView() {
  const owned = ownedSkins();
  const selected = new Set(dashboard.player?.selected_skins || []);
  const ownedIds = new Set(dashboard.player?.owned_skins || []);
  const storeSkins = (dashboard.skins || [])
    .filter((skin) => skin.active !== false && !ownedIds.has(skin.id))
    .sort((left, right) => Number(left.tap_bonus_per_day || 0) - Number(right.tap_bonus_per_day || 0));
  const canPayAnyUsdt = storeSkins.some((skin) => skinBuyableForCurrentPack(skin) && Number(skin.price_usdt || 0) >= minItemUsdtPayment);
  const inventoryMarkup = `
      <article class="profile-card skin-section-card">
        <strong>${tr('activeSkins')}</strong>
        <small>${owned.length ? `${tr('skinLimit')} ${dashboard.player?.skin_taps?.claimed_today ? tr('skinChangesNextClaim') : ''}` : tr('winSkinsRoulette')}</small>
      </article>
      <div class="skin-grid">
        ${owned.length ? owned.map((skin) => {
          const isActive = selected.has(skin.id);
          return `
            <article class="skin-card ${isActive ? 'skin-card--active' : ''}">
              ${skinCardArt(skin)}
              <div>
                <strong>${skin.name}</strong>
                <small>${tr('skinDaily', { count: fmt(skin.tap_bonus_per_day, 0) })}</small>
              </div>
              <button type="button" data-action="toggle-skin" data-skin="${skin.id}">
                ${isActive ? tr('selectedSkin') : tr('selectSkin')}
              </button>
            </article>
          `;
        }).join('') : `
          <article class="empty-state">
            <strong>${tr('noSkins')}</strong>
            <small>${tr('winSkinsRoulette')}</small>
            <button type="button" data-view="roulette">${tr('roulette')}</button>
          </article>
        `}
      </div>
  `;
  const shopMarkup = `
      ${canPayAnyUsdt ? cryptoNetworkSelector() : ''}
      <article class="profile-card skin-section-card skin-store-intro">
        <strong>${tr('skinStore')}</strong>
        <small>${tr('skinLimit')}</small>
      </article>
      <div class="skin-grid skin-store-grid">
        ${storeSkins.length ? storeSkins.map((skin) => {
          const priceTokens = skinPriceTokens(skin);
          const canBuySkin = skinBuyableForCurrentPack(skin);
          const canPayUsdt = Number(skin.price_usdt || 0) >= minItemUsdtPayment;
          return `
            <article class="skin-card skin-card--store ${canBuySkin ? '' : 'skin-card--locked'}">
              ${skinCardArt(skin)}
              <div>
                <strong>${skin.name}</strong>
                <small class="skin-meta">
                  <span class="skin-generate-meta">Puede generar <strong>${fmt(skin.tap_bonus_per_day, 0)} FOX/dia</strong></span>
                  <span class="skin-price-meta"><strong>${fmt(skin.price_usdt, 2)} USDT</strong> - <strong>${fmt(priceTokens, 0)} FOX</strong></span>
                </small>
              </div>
              ${canBuySkin ? `
                <span class="skin-buy-actions">
                  ${canPayUsdt ? `<button type="button" data-action="skin-pay-usdt" data-skin="${skin.id}">${tr('buySkinUsdt')}</button>` : `<small class="avatar-pay-note avatar-pay-note--usdt"><span class="usdt-note-icon">USDT</span> ${tr('usdtFrom', { amount: fmt(minItemUsdtPayment, 0) })}</small>`}
                  <button type="button" data-action="skin-pay-fox" data-skin="${skin.id}">${tr('buySkinFox')}</button>
                </span>
              ` : `
                <span class="skin-lock-note">${icon('ph:lock-key-fill')} ${tr('skinRequiresPack', { pack: skinRequiredPackLabel(skin) })}</span>
              `}
            </article>
          `;
        }).join('') : `
          <article class="empty-state">
            <strong>${tr('ownedSkin')}</strong>
            <small>${tr('winSkinsRoulette')}</small>
          </article>
        `}
      </div>
  `;
  const isFree = dashboard.player?.active_package_id === 'free';
  if (isFree) {
    return `
      <section class="sheet-panel skins-view" style="position: relative;">
        <div class="sheet-head"><span>${tr('skins')}</span><strong>${tr('skins')}</strong></div>
        
        <!-- Locked overlay with blur -->
        <div class="skins-locked-overlay">
          <div class="skins-locked-card">
            <div class="lock-icon-wrap">
              ${icon('ph:lock-key-fill')}
            </div>
            <h3>${tr('skinsLockedTitle')}</h3>
            <p>${tr('skinsLockedDesc')}</p>
            <button class="hud-btn-primary" type="button" data-view="packs" data-packs-tab="shop">
              ${tr('skinsLockedBtn')}
            </button>
          </div>
        </div>
        
        <!-- Blurred background content just for display -->
        <div style="filter: blur(2px); opacity: 0.35; pointer-events: none; width: 100%;">
          <div class="skin-tabs" role="tablist">
            <button class="active" type="button">${tr('skinShop')}</button>
            <button type="button">${tr('skinInventory')}</button>
          </div>
          ${shopMarkup}
        </div>
        
        <button class="roulette-back" type="button" data-view="earn" style="position: relative; z-index: 11; margin-top: 15px;">${icon('ph:arrow-left-bold')} ${tr('backToEarn')}</button>
      </section>
    `;
  }

  return `
    <section class="sheet-panel skins-view">
      <div class="sheet-head"><span>${tr('skins')}</span><strong>${skinsTab === 'shop' ? tr('skinStore') : tr('mySkins')}</strong></div>
      <div class="skin-tabs" role="tablist" aria-label="${tr('skins')}">
        <button class="${skinsTab === 'shop' ? 'active' : ''}" type="button" data-action="skin-tab" data-tab="shop" role="tab" aria-selected="${skinsTab === 'shop'}">${tr('skinShop')}</button>
        <button class="${skinsTab === 'inventory' ? 'active' : ''}" type="button" data-action="skin-tab" data-tab="inventory" role="tab" aria-selected="${skinsTab === 'inventory'}">${tr('skinInventory')}</button>
      </div>
      ${skinsTab === 'shop' ? shopMarkup : inventoryMarkup}
      <button class="roulette-back" type="button" data-view="earn">${icon('ph:arrow-left-bold')} ${tr('backToEarn')}</button>
    </section>
  `;
}

function mainView() {
  if (activeView === 'packs') {
    return packsView();
  }
  if (activeView === 'avatars') return avatarsView();
  if (activeView === 'tasks') return shopView();
  if (activeView === 'leaderboard') return leaderboardView();
  if (activeView === 'roulette') return rouletteView();
  if (activeView === 'skins') return skinsView();
  if (activeView === 'friends') return referralsView();
  if (activeView === 'earnings') return earningsView();
  if (activeView === 'network') return networkMapView();
  if (activeView === 'wallet') return walletView();
  if (activeView === 'withdraw') return earnMoreView();
  if (activeView === 'profile') return profileView();
  if (activeView === 'support') return supportView();
  return earnView();
}

function avatarsView() {
  const owned = new Set(dashboard.player.owned_avatars || []);
  const tokenPrice = Number(dashboard?.settings?.token_price_usd || 0.0001);
  const canPayAnyUsdt = (dashboard.avatars || []).some((avatar) => !isEnabled(avatar.is_free) && !owned.has(avatar.id) && Number(avatar.price_usdt || 0) >= minItemUsdtPayment);
  return `
    <section class="sheet-panel">
      <div class="sheet-head sheet-head--avatars"><span>${tr('profile')}</span><strong>${tr('avatars')}</strong></div>
      ${canPayAnyUsdt ? cryptoNetworkSelector() : ''}
      <div class="avatar-grid">
        ${(dashboard.avatars || []).map((avatar) => {
          const avatarFree = isEnabled(avatar.is_free);
          const isOwned = avatarFree || owned.has(avatar.id);
          const selected = dashboard.player.selected_avatar_id === avatar.id && isOwned;
          const canUse = selected && isOwned;
          const priceUsdt = Number(avatar.price_usdt || 0);
          const priceTokens = Math.max(0, Number(avatar.price_tokens || Math.ceil(priceUsdt / tokenPrice)));
          const canPayUsdt = priceUsdt >= minItemUsdtPayment;
          return `
            <article class="avatar-card ${selected ? 'avatar-card--active' : ''}">
              <span><img src="${avatar.image_url}" alt="" loading="eager" decoding="async" fetchpriority="high" /></span>
              <strong>${avatar.name}</strong>
              <small>${avatarFree ? tr('free') : `${tr('premiumAvatar')} · ${fmt(priceUsdt, 2)} USDT`}</small>
              ${isOwned ? `
                <button type="button" data-action="avatar" data-avatar="${avatar.id}" ${canUse ? 'disabled' : ''}>${selected ? tr('selected') : tr('use')}</button>
              ` : `
                <div class="avatar-actions">
                  <button class="avatar-fox-button" type="button" data-action="avatar-buy-fox" data-avatar="${avatar.id}">${fmt(priceTokens, 0)} FOX</button>
                  ${canPayUsdt ? `<button class="avatar-usdt-button" type="button" data-action="avatar-pay" data-avatar="${avatar.id}">${tr('buyAvatarUsdt')}</button>` : `<small class="avatar-pay-note">${tr('usdtFrom', { amount: fmt(minItemUsdtPayment, 0) })}</small>`}
                </div>
              `}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function nav() {
  const isFree = dashboard?.player?.active_package_id === 'free';
  const items = [
    ['earn', tr('navEarn'), 'images/exchange.png'],
    ['packs', isFree ? 'Minar' : tr('navPacks'), isFree ? 'images/pico.png' : 'ph:credit-card-fill'],
    ['tasks', tr('navTasks'), 'ph:clipboard-text-fill'],
    ['leaderboard', tr('navRank'), 'ph:trophy-fill'],
    ['friends', tr('navFriends'), 'ph:users-three-fill'],
    ['withdraw', tr('navCashout'), 'ph:coin-fill'],
  ];
  return `
    <nav class="bottom-nav" aria-label="Navigation">
      ${items.map(([view, label, itemIcon]) => `
        <button class="nav-item ${activeView === view ? 'active' : ''}" type="button" data-view="${view}">
          ${itemIcon.includes('/') ? `<img class="nav-icon-img" src="${itemIcon}" alt="" />` : icon(itemIcon)}${label}
        </button>
      `).join('')}
    </nav>
    <span class="home-indicator"></span>
  `;
}

function serviceWorkerUpdatePrompt(mode = 'floating') {
  if (!swUpdateReady) return '';
  const inlineClass = mode === 'inline' ? ' app-update-prompt--inline' : '';
  return `
    <aside class="app-update-prompt${inlineClass}" role="status" aria-live="polite">
      <span>${icon('ph:arrow-clockwise-bold')}</span>
      <div>
        <strong>${tr('updateReadyTitle')}</strong>
        <small>${tr('updateReadyText')}</small>
      </div>
      <button type="button" data-action="apply-update">${swApplyingUpdate ? tr('updatingApp') : tr('updateApp')}</button>
    </aside>
  `;
}

function render() {
  if (!dashboard) {
    renderLoading();
    return;
  }
  if (dashboard.blocked) {
    app.innerHTML = `
      <section class="loading-view blocked-view">
        <iconify-icon icon="ph:shield-warning-fill"></iconify-icon>
        <h1>${tr('blockedTitle')}</h1>
        <p>${dashboard.reason === 'account_disabled' ? tr('accountDisabled') : (dashboard.reason === 'ip_already_used' ? tr('ipBlocked') : tr('deviceBlocked'))}</p>
        <small>${tr('blockedHelp')}</small>
        <div class="blocked-support-form">
          <textarea id="blocked-support-message" maxlength="1200" placeholder="${tr('supportMessagePlaceholder')}"></textarea>
          <label class="support-image-picker">
            <small>${tr('supportImageOptional')}</small>
            <input id="blocked-support-image" type="file" accept="image/png,image/jpeg,image/webp" />
            <span>${tr('supportImageHint')}</span>
          </label>
          <button type="button" data-action="support-blocked">${icon('ph:chat-circle-dots-bold')} ${tr('contactSupport')}</button>
        </div>
      </section>
      ${serviceWorkerUpdatePrompt()}
    `;
    return;
  }
  if (dashboard.player?.is_registered && dashboard.session_valid === false) {
    app.classList.remove('is-leaderboard', 'is-free-pack', 'has-install-banner');
    app.classList.toggle('has-update-prompt', Boolean(swUpdateReady));
    app.innerHTML = `${sessionExpiredView()}${serviceWorkerUpdatePrompt()}`;
    return;
  }
  app.classList.toggle('is-leaderboard', activeView === 'leaderboard');
  app.classList.toggle('is-free-pack', dashboard.player?.active_package_id === 'free');
  app.classList.toggle('has-install-banner', Boolean(!isStandalonePwa && canInstallPwa && !installBannerDismissed));
  app.classList.toggle('has-update-prompt', Boolean(swUpdateReady));
  app.innerHTML = `${activeView === 'leaderboard' ? '' : topHud()}${mainView()}${nav()}${paymentOverlay()}${rankRulesOverlay()}${rankImagePreviewOverlay()}${taskPromptOverlay()}${dailyTicketRewardOverlay()}${roulettePrizeOverlay()}${skinPreviewOverlay()}${skinFoxConfirmOverlay()}${withdrawalChangeOverlay()}${withdrawalPendingOverlay()}${packageFoxConfirmOverlay()}${packInfoOverlay()}${activeView === 'withdraw' ? '' : serviceWorkerUpdatePrompt()}`;
  updatePaymentTimerNode();
  syncSeasonCountdownTimer();
  syncVideoProgressUiTimer();
}

function showPop(clientX, clientY, text) {
  const bounds = app.getBoundingClientRect();
  const x = Math.max(18, Math.min(bounds.width - 18, clientX - bounds.left));
  const y = Math.max(18, Math.min(bounds.height - 18, clientY - bounds.top));
  const pop = document.createElement('span');
  pop.className = 'tap-pop';
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  pop.textContent = text;
  app.appendChild(pop);
  setTimeout(() => pop.remove(), 820);
}

function scheduleVideoClaim(task, delayMs) {
  if (videoTimer) window.clearTimeout(videoTimer);
  videoTimer = window.setTimeout(() => {
    void validateVideoReturn(task, { automatic: true });
  }, Math.max(0, delayMs) + 250);
}

function pendingVideoTask() {
  if (!dashboard) return null;
  if (activeVideoTask && getVideoProgress(activeVideoTask.id)) return activeVideoTask;
  return taskList().find((task) => ['youtube', 'social'].includes(task.type) && !task.claimed && getVideoProgress(task.id)) || null;
}

async function claimVideoTask(task, progress = {}) {
  if (videoClaimInFlight) return;
  videoClaimInFlight = true;
  try {
    if (videoTimer) window.clearTimeout(videoTimer);
    videoTimer = null;
    clearVideoProgress(task.id);
    activeVideoTask = null;
    const watchedSeconds = Math.max(Number(task.watch_seconds || 30), Math.floor(Number(progress.watched_seconds || 0)));
    const visitedSeconds = Math.max(Number(task.wait_seconds || 0), Math.floor(Number(progress.watched_seconds || 0)));
    const payload = {
      player_id: playerId,
      task_id: task.id,
      language: appLang,
    };
    if (task.type === 'social') {
      payload.visited = true;
      payload.visited_seconds = visitedSeconds;
    } else {
      payload.watched_seconds = watchedSeconds;
    }
    const data = await api('/api/foxpay/tasks/claim', payload);
    updateDashboard(data);
    taskRewardToast(data, task);
  } finally {
    videoClaimInFlight = false;
  }
}

async function validateVideoReturn(task, options = {}) {
  const now = Date.now();
  const waitSeconds = task.type === 'social' ? Number(task.wait_seconds || 15) : Number(task.watch_seconds || 30);
  const watchMs = waitSeconds * 1000;
  const delayMs = Number(task.reward_delay_seconds ?? (task.type === 'social' ? 0 : 30)) * 1000;
  const progress = getVideoProgress(task.id);
  if (!progress) return false;
  const previousMs = Math.max(0, Number(progress.watched_seconds || 0) * 1000);
  const sessionMs = progress.opened_at ? Math.max(0, now - Number(progress.opened_at || 0)) : 0;
  const earlyReturnGraceMs = isMobileDevice ? Math.min(10000, Math.max(2500, watchMs * 0.35)) : 1500;
  if (!progress.opened_at) {
    if (previousMs < watchMs && options.manual) {
      if (task.type === 'social') await claimSocialTask(task);
      else await handleVideoTask(task);
      return true;
    }
    if (previousMs < watchMs) {
      return false;
    }
  }
  if (!options.manual && now < Number(progress.ignore_until || 0)) return false;
  if (!options.manual && progress.opened_at && sessionMs < earlyReturnGraceMs) {
    scheduleVideoClaim(task, Math.max(earlyReturnGraceMs - sessionMs, 800));
    return false;
  }

  const elapsed = previousMs + sessionMs;
  if (elapsed < watchMs) {
    if (videoTimer) window.clearTimeout(videoTimer);
    videoTimer = null;
    activeVideoTask = task;
    const remaining = Math.ceil((watchMs - elapsed) / 1000);
    setVideoProgress(task.id, {
      ...progress,
      watched_seconds: Math.max(0, Math.floor(elapsed / 1000)),
      opened_at: null,
      ignore_until: null,
    });
    toast(options.manual ? tr('videoMissingSeconds', { seconds: fmt(remaining, 0) }) : tr('videoReturnedEarly'));
    if (dashboard && (activeView === 'tasks' || pendingTaskId)) render();
    return true;
  }

  if (!progress.claim_after) {
    const claimAfter = now + delayMs;
    const nextProgress = {
      ...progress,
      watched_seconds: Math.floor(elapsed / 1000),
      claim_after: claimAfter,
    };
    setVideoProgress(task.id, nextProgress);
    toast(delayMs > 0 ? tr('rewardIn', { seconds: Math.ceil(delayMs / 1000) }) : tr('claimingReward'));
    if (delayMs > 0) {
      scheduleVideoClaim(task, delayMs);
      if (dashboard && (activeView === 'tasks' || pendingTaskId)) render();
      return true;
    }
    await claimVideoTask(task, nextProgress);
    return true;
  }

  const readyAt = Number((getVideoProgress(task.id) || {}).claim_after || now);
  if (Date.now() < readyAt) {
    if (options.manual) toast(tr('rewardIn', { seconds: Math.ceil((readyAt - Date.now()) / 1000) }));
    scheduleVideoClaim(task, readyAt - Date.now());
    if (dashboard && (activeView === 'tasks' || pendingTaskId)) render();
    return true;
  }

  await claimVideoTask(task, getVideoProgress(task.id) || progress);
  return true;
}

async function resumeVideoTaskFromReturn() {
  const task = pendingVideoTask();
  if (!task || document.hidden) return;
  await validateVideoReturn(task);
}

async function handleVideoTask(task) {
  const now = Date.now();
  const progress = getVideoProgress(task.id);
  if (progress?.opened_at) {
    activeVideoTask = task;
    await validateVideoReturn(task, { manual: true });
    return;
  }
  if (videoTimer) window.clearTimeout(videoTimer);
  videoTimer = null;
  if (task.url) {
    activeVideoTask = task;
    setVideoProgress(task.id, {
      ...(progress || {}),
      opened_at: now,
      ignore_until: now + 1200,
      watched_seconds: Math.max(0, Math.floor(Number(progress?.watched_seconds || 0))),
    });
    openExternalTaskUrl(task.url);
    const remaining = Math.max(1, Number(task.watch_seconds || 30) - Number(progress?.watched_seconds || 0));
    toast(tr('videoReturn', { seconds: fmt(remaining, 0) }));
    return;
  }
  toast(tr('videoMissing'));
}

async function claimSocialTask(task) {
  const now = Date.now();
  const progress = getVideoProgress(task.id);
  if (progress?.opened_at) {
    activeVideoTask = task;
    await validateVideoReturn(task, { manual: true });
    return;
  }
  if (videoTimer) window.clearTimeout(videoTimer);
  videoTimer = null;
  if (!task.url) {
    toast(tr('socialMissing'));
    return;
  }
  activeVideoTask = task;
  setVideoProgress(task.id, {
    ...(progress || {}),
    opened_at: now,
    ignore_until: now + 1200,
    watched_seconds: Math.max(0, Math.floor(Number(progress?.watched_seconds || 0))),
  });
  openExternalTaskUrl(task.url);
  const remaining = Math.max(1, Number(task.wait_seconds || 15) - Number(progress?.watched_seconds || 0));
  toast(tr('socialReturn', { seconds: fmt(remaining, 0) }));
}

function updatePaymentTimerNode() {
  if (!currentPayment) return;
  const node = document.getElementById('paymentTimer');
  if (!node) return;
  const seconds = Math.max(0, Number(currentPayment.seconds_left || 0));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  node.textContent = `${mm}:${ss}`;
}

function stopPaymentWatcher() {
  if (paymentPollTimer) window.clearInterval(paymentPollTimer);
  if (paymentCountdownTimer) window.clearInterval(paymentCountdownTimer);
  paymentPollTimer = null;
  paymentCountdownTimer = null;
}

async function pollPaymentStatus() {
  if (!currentPayment?.id) return;
  const paymentId = currentPayment.id;
  const data = await api(`/api/foxpay/payment/status?player_id=${encodeURIComponent(playerId)}&id=${encodeURIComponent(paymentId)}`);
  paymentExpiryPollInFlight = false;
  if (data.payment) currentPayment = data.payment;
  if (data.dashboard) dashboard = data.dashboard;
  if (['confirmed', 'finished'].includes(String(currentPayment.status || '').toLowerCase())) {
    stopPaymentWatcher();
    const paidItem = currentPayment.item_type === 'avatar'
      ? tr('avatarActivated')
      : currentPayment.item_type === 'skin'
        ? tr('skinPurchased')
        : tr('paymentActivated');
    currentPayment = null;
    updateDashboard(data);
    toast(paidItem);
    return;
  }
  if (['failed', 'expired', 'refunded', 'cancelled', 'canceled', 'underpaid'].includes(String(currentPayment.status || '').toLowerCase())) {
    stopPaymentWatcher();
    const status = currentPayment.status;
    currentPayment = null;
    updateDashboard(data);
    toast(tr('paymentStatus', { status }));
    return;
  }
  render();
}

async function refreshDashboardSilently() {
  if (!dashboard || document.hidden) return;
  try {
    const next = await api(`/api/foxpay/me?${dashboardQuery()}`);
    updateDashboard(next);
  } catch {
    // Keep the current screen if the background refresh fails.
  }
}

function activeScrollContainer() {
  return document.querySelector('.sheet-panel, .panel-view, .leaderboard-card, .leaderboard-view, .roulette-page, .hero-stage');
}

function canStartPullRefresh(event) {
  if (pullRefreshRefreshing || event.touches.length !== 1) return false;
  const target = event.target;
  if (!target || target.closest?.([
    'button',
    'a',
    'input',
    'textarea',
    'select',
    'label',
    '[contenteditable="true"]',
    '[role="dialog"]',
    '.tap-target',
    '.roulette-float',
    '.roulette-stage',
    '.codepen-roulette',
    '.bottom-nav',
    '.install-banner',
    '.network-canvas',
    '.payment-overlay',
    '.task-modal-overlay',
    '.daily-ticket-overlay',
    '.roulette-prize-overlay',
    '.skin-preview-overlay',
    '.skin-confirm-overlay',
    '.withdraw-change-overlay',
    '.rank-rules-overlay',
    '.rank-image-preview-overlay'
  ].join(','))) {
    return false;
  }
  const container = target.closest?.('.sheet-panel, .panel-view, .leaderboard-card, .leaderboard-view, .roulette-page, .hero-stage') || activeScrollContainer();
  if (container && container.scrollTop > 2) return false;
  return true;
}

function pullRefreshIndicator() {
  let node = document.querySelector('.pull-refresh-indicator');
  if (node) return node;
  node = document.createElement('div');
  node.className = 'pull-refresh-indicator';
  node.setAttribute('aria-live', 'polite');
  node.innerHTML = `
    <span>${icon('ph:arrow-clockwise-bold')}</span>
    <small>${tr('pullRefreshPull')}</small>
  `;
  app.appendChild(node);
  return node;
}

function updatePullRefreshIndicator(distance, state = 'pull') {
  const node = pullRefreshIndicator();
  const progress = Math.max(0, Math.min(1, distance / 86));
  const offset = Math.round(-54 + (progress * 78));
  node.style.transform = `translate3d(-50%, ${offset}px, 0) scale(${0.88 + (progress * 0.12)})`;
  node.classList.toggle('is-visible', distance > 8 || state === 'refreshing');
  node.classList.toggle('is-ready', state === 'release');
  node.classList.toggle('is-refreshing', state === 'refreshing');
  const label = node.querySelector('small');
  if (label) {
    label.textContent = state === 'refreshing'
      ? tr('pullRefreshRefreshing')
      : (state === 'release' ? tr('pullRefreshRelease') : tr('pullRefreshPull'));
  }
}

function resetPullRefreshIndicator(delayMs = 0) {
  window.setTimeout(() => {
    pullRefreshDistance = 0;
    pullRefreshTracking = false;
    pullRefreshActive = false;
    const node = document.querySelector('.pull-refresh-indicator');
    if (!node) return;
    node.classList.remove('is-visible', 'is-ready', 'is-refreshing');
    node.style.transform = 'translate3d(-50%, -54px, 0) scale(0.88)';
  }, delayMs);
}

function refreshInstalledServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  return navigator.serviceWorker.getRegistration()
    .then((registration) => {
      if (!registration) return null;
      watchServiceWorkerUpdate(registration);
      if (registration.waiting) notifyServiceWorkerUpdate(registration);
      return registration.update()
        .then(() => {
          if (registration.waiting) notifyServiceWorkerUpdate(registration);
        })
        .catch(() => {});
    })
    .catch(() => {});
}

function notifyServiceWorkerUpdate(registration = null) {
  if (!navigator.serviceWorker?.controller) return;
  swUpdateRegistration = registration || swUpdateRegistration;
  swUpdateReady = true;
  if (dashboard) render();
}

function watchServiceWorkerUpdate(registration) {
  if (!registration || watchedServiceWorkerRegistrations.has(registration)) return;
  watchedServiceWorkerRegistrations.add(registration);
  if (registration.waiting) notifyServiceWorkerUpdate(registration);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        notifyServiceWorkerUpdate(registration);
      }
    });
  });
}

function applyServiceWorkerUpdate() {
  if (!swUpdateReady || swApplyingUpdate) return;
  swApplyingUpdate = true;
  render();
  const waitingWorker = swUpdateRegistration?.waiting;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  window.location.reload();
}

async function runPullRefresh() {
  if (pullRefreshRefreshing) return;
  pullRefreshRefreshing = true;
  updatePullRefreshIndicator(86, 'refreshing');
  try {
    await refreshInstalledServiceWorker();
    if (dashboard) {
      await refreshDashboardSilently();
    } else {
      await loadDashboard();
    }
  } finally {
    pullRefreshRefreshing = false;
    resetPullRefreshIndicator(280);
  }
}

function startDashboardRefreshTimer() {
  if (dashboardRefreshTimer) window.clearInterval(dashboardRefreshTimer);
  dashboardRefreshTimer = window.setInterval(refreshDashboardSilently, 60000);
}

function startPaymentWatcher(payment) {
  currentPayment = payment;
  paymentExpiryPollInFlight = false;
  stopPaymentWatcher();
  render();
  paymentCountdownTimer = window.setInterval(() => {
    if (!currentPayment) return;
    currentPayment.seconds_left = Math.max(0, Number(currentPayment.seconds_left || 0) - 1);
    updatePaymentTimerNode();
    if (currentPayment.seconds_left <= 0 && !paymentExpiryPollInFlight) {
      paymentExpiryPollInFlight = true;
      void pollPaymentStatus().catch((error) => {
        paymentExpiryPollInFlight = false;
        toast(error.message);
      });
    }
  }, 1000);
  paymentPollTimer = window.setInterval(() => {
    void pollPaymentStatus().catch((error) => toast(error.message));
  }, 7000);
}

async function resumeStoredPayment(paymentId) {
  const localPayment = (dashboard?.payments || []).find((item) => item.id === paymentId);
  if (localPayment && paymentIsOpen(localPayment) && paymentSecondsLeft(localPayment) > 0) {
    startPaymentWatcher(localPayment);
    void pollPaymentStatus().catch((error) => toast(error.message));
    return;
  }
  const data = await api(`/api/foxpay/payment/status?player_id=${encodeURIComponent(playerId)}&id=${encodeURIComponent(paymentId)}`);
  updateDashboard(data, { skipRender: true });
  if (data.payment && paymentIsOpen(data.payment) && paymentSecondsLeft(data.payment) > 0) {
    startPaymentWatcher(data.payment);
    return;
  }
  render();
  toast(tr('paymentStatus', { status: data.payment?.status || 'closed' }));
}

function scheduleExpiredPendingPaymentsRefresh() {
  if (pendingPaymentExpiryTimer) {
    window.clearTimeout(pendingPaymentExpiryTimer);
    pendingPaymentExpiryTimer = null;
  }
  if (!dashboard || dashboard.api_offline) return;
  const pendingPurchaseIds = new Set((dashboard.purchases || [])
    .filter((purchase) => ['pending', 'waiting'].includes(String(purchase.status || '').toLowerCase()))
    .map((purchase) => purchase.id));
  const secondsUntilExpiry = (dashboard.payments || [])
    .filter((payment) => (
      paymentIsOpen(payment)
      && (payment.item_type !== 'package' || pendingPurchaseIds.has(payment.id))
    ))
    .map(paymentSecondsLeft)
    .filter((seconds) => seconds > 0);
  if (!secondsUntilExpiry.length) return;
  const nextSeconds = Math.min(...secondsUntilExpiry);
  pendingPaymentExpiryTimer = window.setTimeout(() => {
    pendingPaymentExpiryTimer = null;
    void refreshExpiredPendingPayments();
  }, Math.min((nextSeconds + 1) * 1000, 2147483647));
}

async function refreshExpiredPendingPayments() {
  if (!dashboard || dashboard.api_offline) return;
  const pendingPurchaseIds = new Set((dashboard.purchases || [])
    .filter((purchase) => ['pending', 'waiting'].includes(String(purchase.status || '').toLowerCase()))
    .map((purchase) => purchase.id));
  const expired = (dashboard.payments || []).filter((payment) => (
    paymentIsOpen(payment)
    && (payment.item_type !== 'package' || pendingPurchaseIds.has(payment.id))
    && paymentSecondsLeft(payment) <= 0
    && !refreshingExpiredPayments.has(payment.id)
  ));
  for (const payment of expired) {
    refreshingExpiredPayments.add(payment.id);
    try {
      const data = await api(`/api/foxpay/payment/status?player_id=${encodeURIComponent(playerId)}&id=${encodeURIComponent(payment.id)}`);
      updateDashboard(data, { skipRender: true });
    } catch {
      // Keep the pending payment visible if the status provider cannot be reached.
    } finally {
      refreshingExpiredPayments.delete(payment.id);
    }
  }
  scheduleExpiredPendingPaymentsRefresh();
  if (expired.length) render();
}

async function doAction(action, button, event) {
  if (action === 'apply-update') {
    applyServiceWorkerUpdate();
    return;
  }
  if (action === 'daily-ticket-close') {
    dailyTicketReward = null;
    render();
    return;
  }
  if (action === 'daily-ticket-roulette') {
    dailyTicketReward = null;
    activeView = 'roulette';
    render();
    return;
  }
  if (action === 'roulette-prize-close') {
    roulettePrizeReward = null;
    render();
    return;
  }
  if (action === 'roulette-prize-skins') {
    roulettePrizeReward = null;
    skinsTab = 'inventory';
    activeView = 'skins';
    render();
    return;
  }
  if (action === 'skin-tab') {
    skinsTab = button.dataset.tab === 'inventory' ? 'inventory' : 'shop';
    render();
    return;
  }
  if (action === 'preview-skin') {
    skinPreviewId = button.dataset.skin || '';
    render();
    return;
  }
  if (action === 'close-skin-preview') {
    skinPreviewId = '';
    render();
    return;
  }
  if (action === 'skin-fox-cancel') {
    pendingSkinFoxPurchase = null;
    skinFoxError = '';
    render();
    return;
  }
  if (action === 'withdraw-change-cancel') {
    pendingWithdrawalChange = null;
    render();
    return;
  }
  if (action === 'dismiss-skin-claim') {
    const player = dashboard?.player || {};
    dismissedSkinClaimKey = `${player.player_id}:${player.daily_key || 'today'}`;
    localStorage.setItem(skinClaimDismissStorage, dismissedSkinClaimKey);
    render();
    return;
  }
  if (action === 'toggle-cap-info') {
    showCapInfo = !showCapInfo;
    render();
    return;
  }
  if (action === 'open-rank-rules') {
    rankRulesOpen = true;
    render();
    return;
  }
  if (action === 'open-rank-image') {
    const imageUrl = button.dataset.rankImage || '';
    if (!imageUrl) return;
    rankImagePreview = {
      image_url: imageUrl,
      name: button.dataset.rankName || '',
      type: button.dataset.previewType || '',
    };
    render();
    return;
  }
  if (action === 'close-rank-image') {
    rankImagePreview = null;
    render();
    return;
  }
  if (action === 'close-rank-rules') {
    rankRulesOpen = false;
    rankImagePreview = null;
    render();
    return;
  }
  if (action === 'task') {
    const taskId = button.dataset.task || '';
    if (taskBlockedByActiveTask(taskId)) {
      toast(tr('finishActiveTask'));
      return;
    }
    pendingTaskId = taskId;
    render();
    return;
  }
  if (action === 'task-cancel') {
    pendingTaskId = '';
    render();
    return;
  }
  if (action === 'dismiss-install') {
    installBannerDismissed = true;
    render();
    return;
  }
  if (action === 'install-pwa') {
    if (!deferredInstallPrompt) {
      toast(tr('installationUnavailable'));
      return;
    }
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    canInstallPwa = false;
    render();
    toast(choice?.outcome === 'accepted' ? tr('installing') : tr('installCanceled'));
    return;
  }
  if (action === 'tap') {
    if (dashboard?.api_offline) {
      handleOfflineAction(action, button, event);
    } else {
      queueTap(button, event);
    }
    return;
  }
  if (busy) return;
  busy = true;
  try {
    if (dashboard?.api_offline) {
      handleOfflineAction(action === 'task-confirm' ? 'task' : action, button, event);
      return;
    }
    if (action === 'support-open') {
      supportSelectedTicketId = button.dataset.ticket || '';
      const data = await api('/api/foxpay/support/read', { player_id: playerId, ticket_id: supportSelectedTicketId });
      dashboard.support = data.support || dashboard.support;
      render();
      return;
    }
    if (action === 'support-rate') {
      await rateSupportTicket(button.dataset.ticket || '', button.dataset.rating || 0);
      return;
    }
    if (action === 'support-send' || action === 'support-reply' || action === 'support-blocked') {
      if (!deviceKey) deviceKey = await getDeviceKey();
      const isBlockedSupport = action === 'support-blocked';
      const messageNode = isBlockedSupport
        ? document.getElementById('blocked-support-message')
        : document.getElementById(action === 'support-reply' ? 'support-reply-message' : 'support-message');
      const imageNode = isBlockedSupport
        ? document.getElementById('blocked-support-image')
        : document.getElementById(action === 'support-reply' ? 'support-reply-image' : 'support-image');
      const message = messageNode?.value || '';
      const imageFile = imageNode?.files?.[0] || null;
      const imageUrl = imageFile ? await resizeSupportImageToWebp(imageFile) : '';
      const selectedTicket = (dashboard?.support?.tickets || []).find((ticket) => ticket.id === button.dataset.ticket);
      const category = isBlockedSupport
        ? 'blocked'
        : (action === 'support-reply' ? (selectedTicket?.category || 'other') : (document.getElementById('support-category')?.value || 'other'));
      const data = await api('/api/foxpay/support/ticket', {
        player_id: playerId,
        ticket_id: action === 'support-reply' ? (button.dataset.ticket || '') : '',
        category,
        message,
        image_url: imageUrl,
        device_key: deviceKey,
      });
      if (dashboard) dashboard.support = data.support || dashboard.support;
      if (data.ticket?.id) supportSelectedTicketId = data.ticket.id;
      if (isBlockedSupport && messageNode) messageNode.value = '';
      if (imageNode) imageNode.value = '';
      if (!isBlockedSupport) render();
      toast(tr('supportSent'));
      return;
    }
    if (action === 'task-confirm') {
      const task = taskList().find((item) => item.id === button.dataset.task);
      if (taskBlockedByActiveTask(task?.id || '')) {
        toast(tr('finishActiveTask'));
        return;
      }
      if (task?.type === 'referral' && !task.ready) {
        await shareReferralLink();
        const remaining = Math.max(0, Number(task.goal || 1) - Number(task.progress || 0));
        toast(tr('referralTaskNotReady', { count: fmt(remaining, 0) }));
        return;
      }
      pendingTaskId = '';
      render();
      if (task?.type === 'youtube') {
        await handleVideoTask(task);
        return;
      }
      if (task?.type === 'social') {
        await claimSocialTask(task);
        return;
      }
      if (task?.type === 'partner') {
        if (!task.url) {
          toast(tr('socialMissing'));
          return;
        }
        openExternalTaskUrl(task.url);
        toast(tr('partnerPendingToast'));
        return;
      }
      const data = await api('/api/foxpay/tasks/claim', { player_id: playerId, task_id: button.dataset.task, language: appLang });
      updateDashboard(data);
      taskRewardToast(data, task);
    }
    if (action === 'roulette-spin') {
      const spinRewards = [...(dashboard.roulette_rewards || [])];
      button.disabled = true;
      document.querySelectorAll('[data-action="roulette-spin"]').forEach((node) => {
        node.disabled = true;
      });
      const data = await api('/api/foxpay/roulette/spin', { player_id: playerId });
      await animateRouletteSpin(data.spin, spinRewards);
      updateDashboard(data, { skipRender: true });
      roulettePrizeReward = data.spin || null;
      render();
    }
    if (action === 'open-skins') {
      skinsTab = 'inventory';
      activeView = 'skins';
      render();
      return;
    }
    if (action === 'claim-skin-taps') {
      const data = await api('/api/foxpay/skins/claim', { player_id: playerId });
      updateDashboard(data);
      toast(tr('skinClaimedToast', { count: fmt(data.credited_tokens || 0, 0) }));
    }
    if (action === 'toggle-skin') {
      const selected = [...(dashboard.player?.selected_skins || [])];
      const skinId = button.dataset.skin;
      if (selected.includes(skinId)) {
        selected.splice(selected.indexOf(skinId), 1);
      } else {
        if (selected.length >= 2) selected.shift();
        selected.push(skinId);
      }
      updateDashboard(await api('/api/foxpay/skins/select', { player_id: playerId, skin_ids: selected }));
    }
    if (action === 'skin-pay-usdt') {
      const data = await api('/api/foxpay/skin/pay', { player_id: playerId, skin_id: button.dataset.skin, network: paymentNetwork });
      updateDashboard(data);
      if (data.payment) {
        startPaymentWatcher(data.payment);
        toast(tr('paymentQr'));
      } else {
        toast(tr('skinPurchased'));
      }
    }
    if (action === 'skin-pay-fox') {
      const skin = (dashboard.skins || []).find((item) => item.id === button.dataset.skin);
      if (!skin) return;
      skinFoxError = '';
      pendingSkinFoxPurchase = { skinId: skin.id };
      render();
      return;
    }
    if (action === 'package-fox-open') {
      const pack = (dashboard.packages || []).find((item) => item.id === button.dataset.package);
      if (!pack) return;
      pendingPackageFoxPurchase = {
        packageId: pack.id,
        foxTokens: normalizePackageFoxTokens(pack, button.dataset.foxTokens || packageFoxPaymentLimits(pack).maxTokens),
      };
      render();
      return;
    }
    if (action === 'pack-info-open') {
      const pack = (dashboard.packages || []).find((item) => item.id === button.dataset.package);
      if (!pack) return;
      packInfoId = pack.id;
      render();
      return;
    }
    if (action === 'pack-info-close') {
      packInfoId = '';
      render();
      return;
    }
    if (action === 'package-fox-cancel') {
      pendingPackageFoxPurchase = null;
      render();
      return;
    }
    if (action === 'package-fox-confirm') {
      if (packageFoxPaymentInFlight) return;
      const packageId = button.dataset.package || pendingPackageFoxPurchase?.packageId || '';
      const pack = (dashboard.packages || []).find((item) => item.id === packageId);
      if (!pack) return;
      const foxTokens = normalizePackageFoxTokens(pack, button.dataset.foxTokens || pendingPackageFoxPurchase?.foxTokens || 0);
      packageFoxPaymentInFlight = true;
      button.disabled = true;
      const originalHtml = button.innerHTML;
      button.innerHTML = `${icon('ph:spinner-gap-bold')} ${tr('generatingPayment')}`;
      try {
        const data = await api('/api/foxpay/purchase', {
          player_id: playerId,
          package_id: pack.id,
          network: paymentNetwork,
          fox_tokens: foxTokens,
        });
        pendingPackageFoxPurchase = null;
        updateDashboard(data);
        if (data.payment) {
          startPaymentWatcher(data.payment);
          toast(foxTokens > 0 ? tr('foxApplied') : tr('paymentQr'));
        } else {
          toast(tr('freePackActivated'));
        }
      } finally {
        packageFoxPaymentInFlight = false;
        if (document.body.contains(button)) {
          button.disabled = false;
          button.innerHTML = originalHtml;
        }
      }
    }
    if (action === 'skin-fox-confirm') {
      const skinId = button.dataset.skin || pendingSkinFoxPurchase?.skinId || '';
      const skin = (dashboard.skins || []).find((item) => item.id === skinId);
      if (!skin) return;
      skinFoxError = '';
      console.log('FoxPay skin FOX purchase submit', {
        player_id: playerId,
        skin_id: skin.id,
        wallet_before: walletTokens(),
      });
      const data = await api('/api/foxpay/skin/buy-fox', { player_id: playerId, skin_id: skin.id });
      console.log('FoxPay skin FOX purchase response', {
        skin_id: skin.id,
        spent_tokens: data.spent_tokens || 0,
        wallet_after: data.dashboard?.player?.token_balance,
        owned_skins: data.dashboard?.player?.owned_skins || [],
        selected_skins: data.dashboard?.player?.selected_skins || [],
        already_owned: Boolean(data.already_owned),
      });
      pendingSkinFoxPurchase = null;
      skinsTab = 'inventory';
      activeView = 'skins';
      updateDashboard(data);
      toast(tr('skinPurchasedInventory'));
    }
    if (action === 'buy') {
      const foxTokens = Math.max(0, Math.floor(Number(button.dataset.foxTokens || 0)));
      const data = await api('/api/foxpay/purchase', {
        player_id: playerId,
        package_id: button.dataset.package,
        network: paymentNetwork,
        fox_tokens: foxTokens,
      });
      updateDashboard(data);
      if (data.payment) {
        startPaymentWatcher(data.payment);
        toast(foxTokens > 0 ? tr('foxApplied') : tr('paymentQr'));
      } else {
        toast(tr('freePackActivated'));
      }
    }
    if (action === 'withdraw') {
      const request = currentWithdrawalRequest();
      const error = document.getElementById('withdraw-wallet-error');
      if (!validWithdrawalAddress(request.wallet, request.network)) {
        if (error) error.textContent = tr('invalidWallet');
        return;
      }
      if (error) error.textContent = '';
      if (request.walletChanged) {
        pendingWithdrawalChange = request;
        render();
        return;
      }
      const data = await submitWithdrawalRequest(request);
      storeAccountTokenFromResponse(data);
      updateDashboard(data);
      withdrawHistoryPage = 1;
      pendingWithdrawalNotice = true;
      render();
    }
    if (action === 'withdraw-pending-close') {
      pendingWithdrawalNotice = false;
      render();
      return;
    }
    if (action === 'withdraw-change-confirm') {
      const password = document.getElementById('withdraw-change-password')?.value || '';
      const passwordError = document.getElementById('withdraw-change-password-error');
      if (password.length < 6) {
        if (passwordError) passwordError.textContent = tr('wallet_change_password_required');
        return;
      }
      if (passwordError) passwordError.textContent = '';
      const data = await submitWithdrawalRequest(pendingWithdrawalChange || currentWithdrawalRequest(), password);
      pendingWithdrawalChange = null;
      storeAccountTokenFromResponse(data);
      updateDashboard(data);
      withdrawHistoryPage = 1;
      pendingWithdrawalNotice = true;
      render();
    }
    if (action === 'withdraw-page') {
      const items = dashboard?.withdrawals || [];
      const totalPages = Math.max(1, Math.ceil(items.length / 2));
      withdrawHistoryPage = Math.max(1, Math.min(totalPages, Number(button.dataset.page || 1)));
      render();
      return;
    }
    if (action === 'miner-tab') {
      activeMinerTab = button.dataset.tab;
      render();
      return;
    }
    if (action === 'packs-tab') {
      packsTab = button.dataset.tab;
      render();
      return;
    }
    if (action === 'claim-passive') {
      const data = await api('/api/foxpay/passive/claim', { player_id: playerId, account_token: accountToken });
      updateDashboard(data);
      if (data.earned > 0) {
        toast(`+${fmt(data.earned)} GFOX reclamados!`);
      }
      return;
    }
    if (action === 'upgrade-card') {
      const cardId = button.dataset.card;
      const data = await api('/api/foxpay/passive/upgrade', { player_id: playerId, card_id: cardId, account_token: accountToken });
      updateDashboard(data);
      toast(`¡Carta mejorada con éxito!`);
      return;
    }
    if (action === 'avatar') {
      updateDashboard(await api('/api/foxpay/avatar/select', { player_id: playerId, avatar_id: button.dataset.avatar }));
      toast(tr('avatarUpdated'));
    }
    if (action === 'avatar-pay') {
      const data = await api('/api/foxpay/avatar/pay', { player_id: playerId, avatar_id: button.dataset.avatar, network: paymentNetwork });
      updateDashboard(data);
      if (data.payment) {
        startPaymentWatcher(data.payment);
        toast(tr('paymentQr'));
      }
    }
    if (action === 'avatar-buy-fox') {
      const data = await api('/api/foxpay/avatar/buy-fox', { player_id: playerId, avatar_id: button.dataset.avatar });
      updateDashboard(data);
      toast(tr('avatarPurchased'));
    }
    if (action === 'resume-payment') {
      await resumeStoredPayment(button.dataset.payment || '');
      return;
    }
    if (action === 'cancel-payment') {
      const data = await api('/api/foxpay/payment/cancel', {
        player_id: playerId,
        id: button.dataset.payment || '',
      });
      updateDashboard(data);
      toast(tr('paymentCancelled'));
      return;
    }
    if (action === 'payment-close') {
      stopPaymentWatcher();
      currentPayment = null;
      render();
      return;
    }
    if (action === 'register') {
      const username = document.getElementById('register-username')?.value || '';
      const email = document.getElementById('register-email')?.value || '';
      const password = document.getElementById('register-password')?.value || '';
      if (!registerTermsAccepted) {
        toast(tr('termsRequired'));
        return;
      }
      if (!registerCaptcha.selected) {
        toast(tr('completeCaptcha'));
        return;
      }
      const data = await api('/api/foxpay/register', {
        player_id: playerId,
        username,
        email,
        password,
        device_key: deviceKey,
        device_label: deviceLabel,
        user_agent: navigator.userAgent || '',
        captcha_token: dashboard?.register_captcha?.token || '',
        captcha_choice: registerCaptcha.selected,
      });
      storeAccountTokenFromResponse(data);
      registerTermsAccepted = false;
      updateDashboard(data);
      toast(tr('accountCreated'));
    }
    if (action === 'save-email') {
      const email = document.getElementById('profile-email')?.value || '';
      const data = await api('/api/foxpay/email', {
        player_id: playerId,
        email,
        account_token: accountToken,
        device_key: deviceKey,
        device_label: deviceLabel,
        user_agent: navigator.userAgent || '',
      });
      storeAccountTokenFromResponse(data);
      updateDashboard(data);
      toast(tr('emailSaved'));
    }
    if (action === 'login') {
      const username = document.getElementById('login-username')?.value || '';
      const password = document.getElementById('login-password')?.value || '';
      const data = await api('/api/foxpay/login', {
        username,
        password,
        device_key: deviceKey,
        device_label: deviceLabel,
        user_agent: navigator.userAgent || '',
      });
      if (data.player_id) {
        playerId = data.player_id;
        localStorage.setItem(playerKey, playerId);
      }
      storeAccountTokenFromResponse(data);
      updateDashboard(data);
      toast(tr('loggedIn'));
    }
    if (action === 'copy-ref') {
      await navigator.clipboard.writeText(dashboard.player.referral_link);
      toast(tr('referralCopied'));
    }
  } catch (error) {
    if (action === 'support-send' && error.code === 'support_rating_required') {
      if (error.data?.support) dashboard.support = error.data.support;
      render();
      toast(tr('support_rating_required'));
      return;
    }
    if (action === 'withdraw' && error.code === 'wallet_change_password_required') {
      pendingWithdrawalChange = currentWithdrawalRequest();
      render();
      window.setTimeout(() => {
        const passwordInput = document.getElementById('withdraw-change-password');
        const passwordError = document.getElementById('withdraw-change-password-error');
        if (passwordError) passwordError.textContent = tr('wallet_change_password_required');
        passwordInput?.focus();
      }, 50);
      return;
    }
    if (action === 'withdraw-change-confirm' && ['wallet_change_password_required', 'invalid_wallet_password', 'account_login_required'].includes(error.code)) {
      const passwordError = document.getElementById('withdraw-change-password-error');
      if (passwordError) passwordError.textContent = error.code === 'account_login_required'
        ? localizedError({ error: 'account_login_required' })
        : tr(error.code);
      return;
    }
    if (action === 'skin-fox-confirm') {
      console.warn('FoxPay skin FOX purchase error', {
        code: error.code || '',
        message: error.message,
        data: error.data || null,
        player_id: playerId,
        skin_id: button.dataset.skin || pendingSkinFoxPurchase?.skinId || '',
        wallet_before: walletTokens(),
      });
      skinFoxError = error.message;
      render();
      return;
    }
    toast(error.message);
  } finally {
    busy = false;
  }
}

function handleOfflineAction(action, button, event) {
  if (action === 'task') {
    if (packageCapReached()) {
      toast(tr('capToast'));
      return;
    }
    const taskId = button.dataset.task;
    updateLocalDashboard((state) => {
      state.player.daily_tasks = { ...(state.player.daily_tasks || {}), [taskId]: true };
      const isFree = state.player.active_package_id === 'free';
      const requiredVideos = Number(state.player.required_video_count || 1);
      const videosReady = Array.from({ length: requiredVideos }).every((_, index) => state.player.daily_tasks[`youtube_${index + 1}`]);
      state.player.can_tap = isFree ? state.player.energy > 0 : Boolean(state.player.daily_tasks.daily_check && videosReady && state.player.energy > 0);
    });
    toast(tr('localTaskMarked'));
    return;
  }

  if (action === 'tap') {
    if (packageCapReached()) {
      toast(tr('capToast'));
      return;
    }
    if (!dashboard.player.can_tap) {
      toast(tr('completeTasksFirst'));
      return;
    }
    const reward = Number(dashboard.player.package?.tap_reward_tokens || 1);
    updateLocalDashboard((state) => {
      state.player.energy = Math.max(0, Number(state.player.energy || 0) - 1);
      state.player.token_balance = Number(state.player.token_balance || 0) + reward;
      state.player.total_earned_usd = tokenUsd(state.player.token_balance);
      state.player.task_progress = {
        ...(state.player.task_progress || {}),
        taps: Number(state.player.task_progress?.taps || 0) + 1,
      };
      state.player.can_tap = state.player.energy > 0;
    });
    showPop(event.clientX || window.innerWidth / 2, event.clientY || window.innerHeight / 2, `+${fmt(reward)}`);
    return;
  }

  if (action === 'copy-ref') {
    navigator.clipboard?.writeText(dashboard.player.referral_link);
    toast(tr('referralCopied'));
    return;
  }

  toast(tr('backendOffline'));
}

function updateFoxUpgradeModal(input) {
  const pack = (dashboard?.packages || []).find((item) => item.id === input.dataset.package);
  if (!pack || !pendingPackageFoxPurchase) return;
  const tokens = normalizePackageFoxTokens(pack, input.value);
  pendingPackageFoxPurchase.foxTokens = tokens;
  const limits = packageFoxPaymentLimits(pack);
  const tokenUsdt = roundUsdtCents(Math.min(limits.price, tokens * limits.tokenPrice));
  const usdtDue = tokens >= limits.fullTokens ? 0 : ceilUsdtCents(Math.max(0, limits.price - tokenUsdt));
  app.querySelectorAll('[data-fox-upgrade-range], [data-fox-upgrade-input]').forEach((node) => {
    if (node !== input) node.value = String(tokens);
  });
  const tokenNode = app.querySelector('[data-fox-upgrade-tokens]');
  const usdtNode = app.querySelector('[data-fox-upgrade-usdt]');
  const confirm = app.querySelector('[data-action="package-fox-confirm"]');
  if (tokenNode) tokenNode.textContent = fmt(tokens);
  if (usdtNode) usdtNode.textContent = fmt(usdtDue, 2);
  if (confirm) confirm.dataset.foxTokens = String(tokens);
}

function updateWithdrawalWalletChangeUi() {
  const walletInput = document.getElementById('withdraw-wallet');
  const networkInput = document.getElementById('withdraw-network');
  if (!walletInput || !networkInput) return;
  const network = networkInput.value || 'bep20';
  walletInput.placeholder = withdrawalPlaceholder(network);
}

function currentWithdrawalRequest() {
  const walletInput = document.getElementById('withdraw-wallet');
  const wallet = walletInput?.value.trim() || '';
  const network = document.getElementById('withdraw-network')?.value || 'bep20';
  const usdt = Number(document.getElementById('withdraw-usdt')?.value || 0);
  const tokens = Math.ceil(usdt / Number(dashboard?.settings?.token_price_usd || 0.0001));
  const savedWallet = walletInput?.dataset.savedWallet || '';
  const savedNetwork = walletInput?.dataset.savedNetwork || '';
  return {
    wallet,
    network,
    tokens,
    savedWallet,
    savedNetwork,
    walletChanged: Boolean(savedWallet && savedNetwork && (wallet !== savedWallet || network !== savedNetwork)),
  };
}

async function submitWithdrawalRequest(request, password = '') {
  return api('/api/foxpay/withdraw', {
    player_id: playerId,
    account_token: accountToken,
    wallet: request.wallet,
    network: request.network,
    tokens: request.tokens,
    password,
    device_key: deviceKey,
    device_label: deviceLabel,
    user_agent: navigator.userAgent || '',
  });
}

app.addEventListener('input', (event) => {
  const input = event.target.closest?.('[data-fox-upgrade-range], [data-fox-upgrade-input]');
  if (input) {
    updateFoxUpgradeModal(input);
    return;
  }
  if (event.target.closest?.('#withdraw-wallet')) {
    updateWithdrawalWalletChangeUi();
  }
});

app.addEventListener('change', (event) => {
  const input = event.target.closest?.('[data-action="terms-accept"]');
  if (!input) return;
  registerTermsAccepted = Boolean(input.checked);
  const registerButton = app.querySelector('[data-action="register"]');
  if (registerButton) registerButton.disabled = !registerTermsAccepted;
});

app.addEventListener('click', (event) => {
  // Close cap-note tooltip if clicking outside of it and the toggle button
  if (showCapInfo && !event.target.closest('.status-pill-button') && !event.target.closest('.cap-note')) {
    showCapInfo = false;
    render();
  }
  if (event.target.closest('[data-video-close]')) {
    return;
  }
  if (event.target.closest('[data-video-claim]')) {
    return;
  }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.captchaChoice !== undefined) {
    registerCaptcha.selected = button.dataset.captchaChoice;
    app.querySelectorAll('[data-captcha-choice]').forEach((item) => item.classList.toggle('is-selected', item === button));
    const feedback = document.getElementById('register-captcha-feedback');
    if (feedback) feedback.textContent = tr('tokenSelected');
    return;
  }
  if (button.dataset.passwordToggle) {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    const label = showing ? tr('showPassword') : tr('hidePassword');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = icon(showing ? 'ph:eye-bold' : 'ph:eye-slash-bold');
    input.focus();
    return;
  }
  if (button.dataset.networkOption) {
    document.getElementById('withdraw-network').value = button.dataset.networkOption;
    document.querySelectorAll('[data-network-option]').forEach((item) => item.classList.toggle('active', item === button));
    updateWithdrawalWalletChangeUi();
    return;
  }
  if (button.dataset.payNetwork) {
    paymentNetwork = button.dataset.payNetwork;
    render();
    return;
  }
  if (button.dataset.walletFilter) {
    walletHistoryFilter = button.dataset.walletFilter;
    render();
    return;
  }
  if (button.dataset.copyValue !== undefined) {
    navigator.clipboard?.writeText(button.dataset.copyValue || '');
    toast(tr('copied'));
    return;
  }
  if (button.dataset.leaderMode) {
    leaderboardMode = button.dataset.leaderMode;
    render();
    return;
  }
  if (button.dataset.networkZoom) {
    networkZoom = button.dataset.networkZoom === 'in'
      ? Math.min(1.65, Number((networkZoom + 0.15).toFixed(2)))
      : Math.max(0.65, Number((networkZoom - 0.15).toFixed(2)));
    render();
    return;
  }
  if (button.dataset.view) {
    if (button.dataset.view === 'skins') skinsTab = 'shop';
    if (button.dataset.view === 'packs') {
      packsTab = button.dataset.packsTab || (dashboard.player?.active_package_id === 'free' ? 'miner' : 'shop');
    }
    activeView = button.dataset.view;
    render();
    return;
  }
  if (button.dataset.action) {
    void doAction(button.dataset.action, button, event);
  }
});

app.addEventListener('touchstart', (event) => {
  if (!event.target.closest('.network-canvas') || event.touches.length !== 2) return;
  pinchStartDistance = touchDistance(event.touches);
  pinchStartZoom = networkZoom;
}, { passive: true });

app.addEventListener('touchstart', (event) => {
  if (!canStartPullRefresh(event)) return;
  const touch = event.touches[0];
  pullRefreshStartY = touch.clientY;
  pullRefreshStartX = touch.clientX;
  pullRefreshDistance = 0;
  pullRefreshTracking = true;
  pullRefreshActive = false;
}, { passive: true });

app.addEventListener('touchmove', (event) => {
  if (!event.target.closest('.network-canvas') || event.touches.length !== 2 || !pinchStartDistance) return;
  event.preventDefault();
  const nextZoom = pinchStartZoom * (touchDistance(event.touches) / pinchStartDistance);
  networkZoom = Math.max(0.65, Math.min(1.75, Number(nextZoom.toFixed(2))));
  const scale = document.querySelector('.network-scale');
  const label = document.querySelector('[data-network-zoom-label]');
  if (scale) scale.style.setProperty('--network-scale', networkZoom);
  if (label) label.textContent = `${Math.round(networkZoom * 100)}%`;
}, { passive: false });

app.addEventListener('touchmove', (event) => {
  if (!pullRefreshTracking || pullRefreshRefreshing || event.touches.length !== 1) return;
  const touch = event.touches[0];
  const deltaY = touch.clientY - pullRefreshStartY;
  const deltaX = Math.abs(touch.clientX - pullRefreshStartX);
  if (deltaY < 0 || deltaX > Math.max(28, deltaY * 0.75)) {
    resetPullRefreshIndicator();
    return;
  }
  if (deltaY < 8) return;
  pullRefreshActive = true;
  event.preventDefault();
  pullRefreshDistance = Math.min(118, deltaY * 0.58);
  updatePullRefreshIndicator(
    pullRefreshDistance,
    pullRefreshDistance >= 86 ? 'release' : 'pull',
  );
}, { passive: false });

app.addEventListener('touchend', () => {
  pinchStartDistance = 0;
}, { passive: true });

app.addEventListener('touchend', () => {
  if (!pullRefreshTracking) return;
  if (pullRefreshActive && pullRefreshDistance >= 86) {
    void runPullRefresh();
    return;
  }
  resetPullRefreshIndicator();
}, { passive: true });

window.addEventListener('beforeinstallprompt', (event) => {
  if (!isAndroidDevice || isStandalonePwa) return;
  event.preventDefault();
  deferredInstallPrompt = event;
  canInstallPwa = true;
  if (dashboard) render();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  canInstallPwa = false;
  toast(tr('installed'));
  if (dashboard) render();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void resumeVideoTaskFromReturn().catch((error) => toast(error.message));
});

window.addEventListener('focus', () => {
  void resumeVideoTaskFromReturn().catch((error) => toast(error.message));
});

window.addEventListener('pageshow', () => {
  void resumeVideoTaskFromReturn().catch((error) => toast(error.message));
});

window.addEventListener('hashchange', () => {
  const nextView = viewFromHash();
  if (nextView === activeView) return;
  activeView = nextView;
  if (dashboard) render();
});

if ('serviceWorker' in navigator) {
  let swReloaded = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return;
    if (swApplyingUpdate) {
      swReloaded = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        watchServiceWorkerUpdate(registration);
        return registration.update().catch(() => {});
      })
      .catch(() => {});
  });

  window.addEventListener('focus', refreshInstalledServiceWorker);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshInstalledServiceWorker();
  });
}

startLoading();
void loadDashboard();
startDashboardRefreshTimer();
