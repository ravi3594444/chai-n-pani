export const UPI_ID = "Q698500876@ybl";
export const UPI_PAYEE_NAME = "Chai N Pani";

/** Logos only. These are NOT launch targets - see createUpiChooserIntentUrl. */
export const UPI_APPS = [
  {
    id: "gpay",
    name: "Google Pay",
    logo: "/payment/google-pay-mark.svg",
  },
  {
    id: "phonepe",
    name: "PhonePe",
    logo: "/payment/phonepe-logo.svg",
  },
  {
    id: "paytm",
    name: "Paytm",
    logo: "/payment/paytm-logo.png",
  },
] as const;

export type UpiApp = (typeof UPI_APPS)[number];

export const findUpiApp = (id: string | null | undefined): UpiApp =>
  UPI_APPS.find((app) => app.id === id) || UPI_APPS[0];

/**
 * UPI deep links must be percent-encoded (%20 for spaces).
 * URLSearchParams.toString() emits `+` for spaces, which PhonePe and several
 * bank apps parse literally — the app then opens with a mangled payee/note, or
 * rejects the intent outright and hands control straight back to the browser.
 */
const encodeUpiParams = (params: Record<string, string>) =>
  Object.entries(params)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

export const createUpiQuery = (amount: string, orderId: string) =>
  encodeUpiParams({
    pa: UPI_ID,
    pn: UPI_PAYEE_NAME,
    am: amount,
    cu: "INR",
    tn: `Chai N Pani order ${orderId}`,
    tr: orderId,
  });

export const createUpiUrl = (query: string) => `upi://pay?${query}`;

const buildIntentUrl = (query: string, extras: string) =>
  `intent://pay?${query}#Intent;scheme=upi;action=android.intent.action.VIEW;` +
  `category=android.intent.category.BROWSABLE;${extras}end`;

/**
 * Unpinned intent plus a mandatory browser fallback.
 *
 * Two hard rules learned the painful way:
 *
 * 1. NEVER emit `package=` from a web page. Chrome cannot resolve a UPI app's
 *    payment activity, because those activities are registered for app-to-app
 *    invocation with category DEFAULT only - they do not declare BROWSABLE, and
 *    Chrome force-adds BROWSABLE to every intent:// it launches. Resolution
 *    fails even when the app is installed.
 * 2. ALWAYS pass fallbackUrl. When `package=` is set and resolution fails with
 *    no fallback, Chrome's documented behaviour is to open the Play Store
 *    listing for that package. That combination is exactly how an installed
 *    Google Pay ended up showing its own Play Store page.
 *
 * Leaving the package off means Android picks from the apps actually installed,
 * and the fallback means a miss lands on our own retry page, never the store.
 */
export const createUpiChooserIntentUrl = (query: string, fallbackUrl: string) =>
  buildIntentUrl(query, `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};`);
