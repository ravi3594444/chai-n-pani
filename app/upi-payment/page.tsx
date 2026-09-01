"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UPI_ID,
  UPI_PAYEE_NAME,
  createUpiQuery,
  createUpiUrl,
} from "../payment-config";
import { buildUpiLaunchSteps, launchUpiSequence } from "../upi-launch";

function UpiPaymentContent() {
  const query = useSearchParams();
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const details = useMemo(() => {
    const amountNumber = Number(query.get("amount"));
    const orderId = (query.get("order") || "CHAI-N-PANI").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 50);
    return {
      appId: query.get("app") || "gpay",
      amount: Number.isFinite(amountNumber) && amountNumber > 0 ? amountNumber.toFixed(2) : "0.00",
      orderId: orderId || "CHAI-N-PANI",
    };
  }, [query]);

  const upiQuery = useMemo(
    () => createUpiQuery(details.amount, details.orderId),
    [details.amount, details.orderId],
  );
  // A plain upi:// href, not an intent - a real tap here must never reach the Play Store.
  const chooserUrl = createUpiUrl(upiQuery);

  useEffect(() => () => cancelRef.current?.(), []);

  const retrySelectedApp = useCallback(() => {
    cancelRef.current?.();
    setStatus("Opening your UPI app…");
    cancelRef.current = launchUpiSequence(buildUpiLaunchSteps(upiQuery, window.location.href), {
      onStep: (label) => setStatus(label),
      onExhausted: () => {
        cancelRef.current = null;
        setStatus(`No UPI app responded. Scan the QR on the order page, or pay ${UPI_ID} by hand from inside your app.`);
      },
    });
  }, [upiQuery]);

  const copyUpiId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setStatus(`Copy failed. The UPI ID is ${UPI_ID}.`);
    }
  }, []);

  return (
    <main className="upi-fallback-page">
      <section className="upi-fallback-card">
        <p className="eyebrow">Chai N Pani · UPI payment</p>
        <h1>Open your payment app</h1>
        <p className="upi-fallback-copy">
          Your browser could not hand this payment to a UPI app. Nothing has been charged. Retry below, or just pay the
          UPI ID by hand — the amount and payee are the same either way.
        </p>

        <div className="upi-fallback-summary">
          <span>Amount</span><strong>₹ {details.amount}</strong>
          <span>Payee</span><strong>{UPI_PAYEE_NAME}</strong>
          <span>UPI ID</span><strong>{UPI_ID}</strong>
          <span>Order</span><strong>{details.orderId}</strong>
        </div>

        <button className="upi-fallback-primary" type="button" onClick={retrySelectedApp}>
          Try again · ₹ {details.amount}
        </button>
        <a className="upi-fallback-any" href={chooserUrl}>Open any UPI app</a>
        <button className="upi-fallback-back" type="button" onClick={copyUpiId}>
          {copied ? "UPI ID copied ✓" : "Copy UPI ID instead"}
        </button>
        <button
          className="upi-fallback-back"
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}
        >
          Back to my order
        </button>

        {status && <p className="upi-launch-status" aria-live="polite">{status}</p>}

        <p className="upi-fallback-note">
          Still stuck? Open Chrome directly (in-app browsers inside WhatsApp or Instagram cannot launch UPI apps), or
          scan the QR on the order page from another phone. Return to the order afterwards to send the UTR and
          screenshot on WhatsApp.
        </p>
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
