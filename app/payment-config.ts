export const UPI_ID = "Q698500876@ybl";
export const UPI_PAYEE_NAME = "Chai N Pani";

export const UPI_APPS = [
  {
    id: "gpay",
    name: "Google Pay",
    logo: "/payment/google-pay-mark.svg",
    packageName: "com.google.android.apps.nbu.paisa.user",
    // Google Pay still answers on the legacy Tez scheme; keep both.
    schemes: ["gpay://upi/pay", "tez://upi/pay"],
  },
  {
    id: "phonepe",
    name: "PhonePe",
    logo: "/payment/phonepe-logo.svg",
    packageName: "com.phonepe.app",
    schemes: ["phonepe://pay"],
  },
  {
    id: "paytm",
    name: "Paytm",
    logo: "/payment/paytm-logo.png",
    packageName: "net.one97.paytm",
    schemes: ["paytmmp://pay", "paytm://pay"],
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

/** Per-app private schemes. These survive in-app WebViews where intent:// does not. */
export const createUpiAppSchemeUrls = (app: UpiApp, query: string) =>
  app.schemes.map((scheme) => `${scheme}?${query}`);

const buildIntentUrl = (query: string, extras: string) =>
  `intent://pay?${query}#Intent;scheme=upi;action=android.intent.action.VIEW;` +
  `category=android.intent.category.BROWSABLE;${extras}end`;

/**
 * Package-scoped intent. `S.browser_fallback_url` is now OPT-IN and deliberately
 * unused by the launcher: Chrome fires the fallback the instant the pinned
 * package cannot be resolved, which is why an installed app still ended up on
 * the "try an installed app" page.
 */
export const createAndroidUpiIntentUrl = (
  app: UpiApp,
  query: string,
  fallbackUrl?: string,
) =>
  buildIntentUrl(
    query,
    `package=${app.packageName};` +
      (fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` : ""),
  );

/** Unpinned intent — Android shows its own UPI chooser. Most reliable path. */
export const createUpiChooserIntentUrl = (query: string, fallbackUrl?: string) =>
  buildIntentUrl(
    query,
    fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` : "",
  );
