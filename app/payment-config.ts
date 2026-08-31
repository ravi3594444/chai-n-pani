export const UPI_ID = "Q698500876@ybl";
export const UPI_PAYEE_NAME = "Chai N Pani";

export const UPI_APPS = [
  { id: "gpay", name: "Google Pay", logo: "/payment/google-pay-mark.svg", packageName: "com.google.android.apps.nbu.paisa.user" },
  { id: "phonepe", name: "PhonePe", logo: "/payment/phonepe-logo.svg", packageName: "com.phonepe.app" },
  { id: "paytm", name: "Paytm", logo: "/payment/paytm-logo.png", packageName: "net.one97.paytm" },
] as const;

export type UpiApp = (typeof UPI_APPS)[number];
