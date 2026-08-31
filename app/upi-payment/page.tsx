"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { UPI_APPS, UPI_ID, UPI_PAYEE_NAME } from "../payment-config";

type PaymentFallbackDetails = {
  appId: string;
  amount: string;
  orderId: string;
};

function UpiPaymentContent() {
  const query = useSearchParams();
  const details = useMemo<PaymentFallbackDetails>(() => {
    const amountNumber = Number(query.get("amount"));
    const orderId = (query.get("order") || "CHAI-N-PANI").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 50);
    return {
      appId: query.get("app") || "gpay",
      amount: Number.isFinite(amountNumber) && amountNumber > 0 ? amountNumber.toFixed(2) : "0.00",
      orderId: orderId || "CHAI-N-PANI",
    };
  }, [query]);

  const selectedApp = UPI_APPS.find((app) => app.id === details.appId) || UPI_APPS[0];
  const upiUrl = useMemo(() => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: UPI_PAYEE_NAME,
      am: details.amount,
      cu: "INR",
      tn: `Chai N Pani order ${details.orderId}`,
      tr: details.orderId,
    });
    return `upi://pay?${params.toString()}`;
  }, [details]);

  return (
    <main className="upi-fallback-page">
      <section className="upi-fallback-card">
        <p className="eyebrow">Chai N Pani · UPI payment</p>
        <div className="upi-fallback-logo"><img src={selectedApp.logo} alt={`${selectedApp.name} logo`} /></div>
        <h1>Open your payment app</h1>
        <p className="upi-fallback-copy">Your browser could not open {selectedApp.name} directly. Tap below, then choose {selectedApp.name} or any installed UPI app on your phone.</p>

        <div className="upi-fallback-summary">
          <span>Amount</span><strong>₹ {details?.amount || "—"}</strong>
          <span>Payee</span><strong>{UPI_PAYEE_NAME}</strong>
          <span>UPI ID</span><strong>{UPI_ID}</strong>
          <span>Order</span><strong>{details?.orderId || "—"}</strong>
        </div>

        <a className="upi-fallback-primary" href={upiUrl}>Choose an installed UPI app</a>
        <button className="upi-fallback-back" type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/")}>Back to my order</button>
        <p className="upi-fallback-note">The amount and payee are prefilled. Verify both before entering your UPI PIN. Return to the order after payment to send the UTR and screenshot on WhatsApp.</p>
      </section>
    </main>
  );
}

export default function UpiPaymentFallback() {
  return (
    <Suspense fallback={<main className="upi-fallback-page"><section className="upi-fallback-card"><p className="eyebrow">Preparing secure UPI payment…</p></section></main>}>
      <UpiPaymentContent />
    </Suspense>
  );
}
