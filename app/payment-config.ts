export const UPI_ID = "Q698500876@ybl";
export const UPI_PAYEE_NAME = "Chai N Pani";

export const UPI_APPS = [
  { id: "gpay", name: "Google Pay", logo: "/payment/google-pay-mark.svg", packageName: "com.google.android.apps.nbu.paisa.user" },
  { id: "phonepe", name: "PhonePe", logo: "/payment/phonepe-logo.svg", packageName: "com.phonepe.app" },
  { id: "paytm", name: "Paytm", logo: "/payment/paytm-logo.png", packageName: "net.one97.paytm" },
] as const;

export type UpiApp = (typeof UPI_APPS)[number];

export const createUpiQuery = (amount: string, orderId: string) => new URLSearchParams({
  pa: UPI_ID,
  pn: UPI_PAYEE_NAME,
  am: amount,
  cu: "INR",
  tn: `Chai N Pani order ${orderId}`,
  tr: orderId,
}).toString();

export const createUpiUrl = (query: string) => `upi://pay?${query}`;

export const createAndroidUpiIntentUrl = (
  app: UpiApp,
  query: string,
  fallbackUrl?: string,
) => {
  const fallback = fallbackUrl
    ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};`
    : "";

  return `intent://pay?${query}#Intent;scheme=upi;package=${app.packageName};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;${fallback}end`;
};
