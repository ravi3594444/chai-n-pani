"use client";

/**
 * Temporary diagnostic page — /upi-test
 *
 * Every row is a plain <a href>, the most gesture-native launch possible: no
 * JavaScript navigation, no timers, nothing for the browser to block. Each row
 * tries a different known UPI link format for a ₹1 payment to our own VPA.
 * Whichever rows open an app tell us exactly what this phone accepts, and the
 * grey box reports what the browser claims to be. Delete this page once the
 * payment flow is confirmed working.
 */

import { useEffect, useState } from "react";
import { UPI_ID, UPI_PAYEE_NAME } from "../payment-config";

const AMOUNT = "1.00";

const q = (tr: string) =>
  Object.entries({
    pa: UPI_ID,
    pn: UPI_PAYEE_NAME,
    am: AMOUNT,
    cu: "INR",
    tn: `CNP link test ${tr}`,
    tr,
  })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

const FALLBACK = "https://example.com/upi-test-fallback";

const VARIANTS = [
  {
    id: "T1",
    name: "Pinned intent — Google Pay (current site code)",
    url: `intent://pay?${q("CNPT1")}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;S.browser_fallback_url=${encodeURIComponent(FALLBACK)};end`,
  },
  {
    id: "T2",
    name: "Pinned intent — PhonePe (current site code)",
    url: `intent://pay?${q("CNPT2")}#Intent;scheme=upi;package=com.phonepe.app;S.browser_fallback_url=${encodeURIComponent(FALLBACK)};end`,
  },
  {
    id: "T3",
    name: "Pinned intent — Paytm (current site code)",
    url: `intent://pay?${q("CNPT3")}#Intent;scheme=upi;package=net.one97.paytm;S.browser_fallback_url=${encodeURIComponent(FALLBACK)};end`,
  },
  {
    id: "T4",
    name: "Unpinned intent — Android UPI chooser",
    url: `intent://pay?${q("CNPT4")}#Intent;scheme=upi;S.browser_fallback_url=${encodeURIComponent(FALLBACK)};end`,
  },
  { id: "T5", name: "Plain upi:// link", url: `upi://pay?${q("CNPT5")}` },
  { id: "T6", name: "Google Pay scheme tez://", url: `tez://upi/pay?${q("CNPT6")}` },
  { id: "T7", name: "PhonePe scheme phonepe://", url: `phonepe://pay?${q("CNPT7")}` },
  { id: "T8", name: "Paytm scheme paytmmp://", url: `paytmmp://pay?${q("CNPT8")}` },
];

type Verdict = "waiting" | "opened" | "nothing";

export default function UpiTestPage() {
  const [env, setEnv] = useState("loading…");
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    setEnv(
      [
        `UA: ${navigator.userAgent}`,
        `uaData.platform: ${nav.userAgentData?.platform ?? "(none)"}`,
        `visible: ${document.visibilityState}`,
      ].join("\n"),
    );
  }, []);

  const watch = (id: string) => {
    setVerdicts((v) => ({ ...v, [id]: "waiting" }));
    let opened = false;
    const mark = () => { opened = true; };
    const markIfHidden = () => { if (document.hidden) opened = true; };
    document.addEventListener("visibilitychange", markIfHidden);
    window.addEventListener("pagehide", mark);
    window.addEventListener("blur", mark);
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", markIfHidden);
      window.removeEventListener("pagehide", mark);
      window.removeEventListener("blur", mark);
      setVerdicts((v) => ({ ...v, [id]: opened ? "opened" : "nothing" }));
    }, 2500);
  };

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>UPI link test</h1>
      <p style={{ fontSize: 13, color: "#555" }}>
        Tap each link. Every one tries to open a ₹{AMOUNT} payment to {UPI_ID}. You do not
        have to complete any payment — just note which links open an app. Each row records
        an <strong>opened ✓</strong> or <strong>nothing ✗</strong> verdict by itself.
      </p>
      <pre style={{ background: "#f2f2f2", padding: 10, fontSize: 10, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{env}</pre>
      <ol style={{ padding: 0, listStyle: "none" }}>
        {VARIANTS.map((v) => (
          <li key={v.id} style={{ margin: "10px 0", border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <a href={v.url} onClick={() => watch(v.id)} style={{ fontWeight: 700, fontSize: 14, color: "#b7492d", textDecoration: "none" }}>
              {v.id} · {v.name}
            </a>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {verdicts[v.id] === "waiting" && "⏳ watching…"}
              {verdicts[v.id] === "opened" && "✓ an app opened"}
              {verdicts[v.id] === "nothing" && "✗ nothing opened"}
            </div>
            <div style={{ fontSize: 9, color: "#999", marginTop: 6, overflowWrap: "anywhere" }}>{v.url}</div>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: 12, color: "#555" }}>
        Tell Claude: which T-numbers opened an app, which showed ✗ nothing, and what the grey
        box says. T1–T4 should land on example.com if the pinned app is missing — reaching
        example.com means the intent worked but that app is not installed.
      </p>
    </main>
  );
}
