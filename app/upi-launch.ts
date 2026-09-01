"use client";

import {
  createAndroidUpiIntentUrl,
  createUpiChooserIntentUrl,
  createUpiSchemeUrl,
  createUpiUrl,
  type UpiApp,
} from "./payment-config";

type NavigatorWithUaData = Navigator & { userAgentData?: { platform?: string } };

export const isAndroid = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as NavigatorWithUaData).userAgentData;
  if (uaData?.platform && /android/i.test(uaData.platform)) return true;
  return /android/i.test(navigator.userAgent);
};

export const isIos = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

/** In-app browsers cannot launch UPI apps at all — worth telling the user plainly. */
export const isInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|Twitter/i.test(navigator.userAgent);
};

/** Scheme-first on every platform; the intent URL is kept as a manual-retry link. */
export const buildUpiAppUrl = (app: UpiApp, query: string): string =>
  createUpiSchemeUrl(app, query);

export const buildUpiAppIntentUrl = (app: UpiApp, query: string, fallbackUrl: string): string =>
  isAndroid() ? createAndroidUpiIntentUrl(app, query, fallbackUrl) : createUpiSchemeUrl(app, query);

export const buildUpiChooserUrl = (query: string, fallbackUrl: string): string =>
  isAndroid() ? createUpiChooserIntentUrl(query, fallbackUrl) : createUpiUrl(query);

/**
 * Fires the deep link and reports back only if the app appears not to have opened.
 *
 * Two rules this encodes, both learned the hard way:
 *
 * 1. The navigation MUST happen synchronously inside the tap handler. Chrome
 *    consumes the user activation on the first navigation, so a second deep link
 *    fired later from a setTimeout is blocked outright. An earlier version tried
 *    a timed cascade of three URLs; only the first one could ever have run.
 * 2. The timer therefore never navigates anywhere. It only reveals fallback UI.
 *    Chrome's own S.browser_fallback_url handles the app-not-installed case.
 */
export const launchUpi = (url: string, onProbablyFailed: () => void): (() => void) => {
  let settled = false;

  const settle = () => { settled = true; };
  const settleIfHidden = () => {
    if (document.visibilityState === "hidden" || document.hidden) settled = true;
  };

  document.addEventListener("visibilitychange", settleIfHidden);
  window.addEventListener("pagehide", settle);
  window.addEventListener("blur", settle);

  const cleanup = () => {
    document.removeEventListener("visibilitychange", settleIfHidden);
    window.removeEventListener("pagehide", settle);
    window.removeEventListener("blur", settle);
    window.clearTimeout(timer);
  };

  // Synchronous, in-gesture navigation.
  window.location.href = url;

  const timer = window.setTimeout(() => {
    cleanup();
    if (!settled && document.visibilityState === "visible") onProbablyFailed();
  }, 2500);

  return cleanup;
};
