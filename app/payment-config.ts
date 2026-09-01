export const UPI_ID = "Q698500876@ybl";
export const UPI_PAYEE_NAME = "Chai N Pani";

export const UPI_APPS = [
  {
    id: "gpay",
    name: "Google Pay",
    logo: "/payment/google-pay-mark.svg",
    packageName: "com.google.android.apps.nbu.paisa.user",
    // tez:// is the scheme Google documents for India; gpay:// is the newer alias.
    iosScheme: "tez://upi/pay",
  },
  {
    id: "phonepe",
    name: "PhonePe",
    logo: "/payment/phonepe-logo.svg",
    packageName: "com.phonepe.app",
    iosScheme: "phonepe://pay",
  },
  {
    id: "paytm",
    name: "Paytm",
    logo: "/payment/paytm-logo.png",
    packageName: "net.one97.paytm",
    iosScheme: "paytmmp://pay",
  },
] as const;

export type UpiApp = (typeof UPI_APPS)[number];

export const findUpiApp = (id: string | null | undefined): UpiApp =>
  UPI_APPS.find((app) => app.id === id) || UPI_APPS[0];

/**
 * Percent-encoding, not URLSearchParams. URLSearchParams emits `+` for spaces;
 * UPI needs `%20`. A stray unencoded space or `&` silently truncates every
 * parameter after it, and the apps report that as a misleading "limit exceeded"
 * dialog rather than a parse error.
 */
const encodeUpiParams = (params: Record<string, string>) =>
  Object.entries(params)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

/**
 * `attempt` keeps `tr` unique per launch. Reusing a transaction reference across
 * retries causes reconciliation failures and duplicate-payment handling in the
 * PSP. The human-readable order id stays in `tn` so the kitchen can still match it.
 */
export const createUpiQuery = (amount: string, orderId: string, attempt = 1) =>
  encodeUpiParams({
    pa: UPI_ID,
    pn: UPI_PAYEE_NAME,
    // Two decimals: some bank apps reject a bare integer amount.
    am: Number(amount).toFixed(2),
    cu: "INR",
    tn: `Chai N Pani order ${orderId}`,
    tr: attempt > 1 ? `${orderId}R${attempt}` : orderId,
  });

export const createUpiUrl = (query: string) => `upi://pay?${query}`;

/** iOS has no intent://; the app's own scheme is the only route. */
export const createIosUpiUrl = (app: UpiApp, query: string) => `${app.iosScheme}?${query}`;

/**
 * Android intent, pinned to one app.
 *
 * Deliberately omits `action=` and `category=`. Chrome supplies VIEW and adds
 * BROWSABLE to the resolution query itself; specifying them by hand narrows the
 * match and can make resolution fail against an app that would otherwise match.
 * An earlier version of this file set both, which is part of why nothing opened.
 *
 * `S.browser_fallback_url` is mandatory. Without it, a pinned `package=` that
 * fails to resolve sends the user to that package's Play Store listing — which
 * is exactly the "download the app I already have" bug. Chrome strips this extra
 * before handing the intent to the app, so the app never sees it.
 */
export const createAndroidUpiIntentUrl = (app: UpiApp, query: string, fallbackUrl: string) =>
  `intent://pay?${query}#Intent;scheme=upi;package=${app.packageName};` +
  `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

/** Unpinned: Android offers whichever UPI apps are installed. */
export const createUpiChooserIntentUrl = (query: string, fallbackUrl: string) =>
  `intent://pay?${query}#Intent;scheme=upi;` +
  `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
