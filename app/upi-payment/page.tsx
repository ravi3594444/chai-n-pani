"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UPI_ID,
  UPI_PAYEE_NAME,
  createUpiChooserIntentUrl,
  createUpiQuery,
  createUpiUrl,
  findUpiApp,
} from "../payment-config";
import { buildUpiLaunchSteps, isAndroid, launchUpiSequence } from "../upi-launch";

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

  const selectedApp = findUpiApp(details.appId);
  const upiQuery = useMemo(
    () => createUpiQuery(details.amount, details.orderId),
    [details.amount, details.orderId],
  );
  const chooserUrl = isAndroid() ? createUpiChooserIntentUrl(upiQuery) : createUpiUrl(upiQuery);

  useEffect(() => () => cancelRef.current?.(), []);

  const retrySelectedApp = useCallback(() => {
    cancelRef.current?.();
    setStatus(`Opening ${selectedApp.name}…`);
    cancelRef.current = launchUpiSequence(buildUpiLaunchSteps(selectedApp, upiQuery), {
      onStep: (label) => setStatus(label),
      onExhausted: () => {
        cancelRef.current = null;
        setStatus(
          `${selectedApp.name} did not respond. Use the UPI chooser below, or pay ${UPI_ID} manually from inside the app.`,
        );
      },
    });
  }, [selectedApp, upiQuery]);

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
        <div className="upi-fallback-logo"><img src={selectedApp.logo} alt={`${selectedApp.name} logo`} /></div>
        <h1>Open your payment app</h1>
        <p className="upi-fallback-copy">
          Your browser blocked every automatic attempt to hand this payment to {selectedApp.name}. Nothing has been
          charged. Retry below, or open any UPI app — the amount and payee are prefilled either way.
        </p>

        <div className="upi-fallback-summary">
          <span>Amount</span><strong>₹ {details.amount}</strong>
          <span>Payee</span><strong>{UPI_PAYEE_NAME}</strong>
          <span>UPI ID</span><strong>{UPI_ID}</strong>
          <span>Order</span><strong>{details.orderId}</strong>
        </div>

        <button className="upi-fallback-primary" type="button" onClick={retrySelectedApp}>
          Try {selectedApp.name} again · ₹ {details.amount}
        </button>
        <a className="upi-fallback-any" href={chooserUrl}>Open my UPI app chooser</a>
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
