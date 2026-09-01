"use client";

import { createUpiChooserIntentUrl, createUpiUrl } from "./payment-config";

export type LaunchStep = { url: string; waitMs: number; label: string };

type NavigatorWithUaData = Navigator & { userAgentData?: { platform?: string } };

export const isAndroid = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as NavigatorWithUaData).userAgentData;
  if (uaData?.platform && /android/i.test(uaData.platform)) return true;
  return /android/i.test(navigator.userAgent);
};

const openUrl = (url: string) => {
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch {
    window.location.href = url;
  }
};

/**
 * Android: one unpinned chooser intent, carrying a browser fallback so a miss
 * lands on our retry page rather than the Play Store.
 * Everywhere else (iOS, in-app WebViews, desktop): the bare upi:// scheme, which
 * is all those environments understand.
 */
export const buildUpiLaunchSteps = (query: string, fallbackUrl: string): LaunchStep[] => {
  const label = "Opening your UPI app…";
  if (isAndroid()) {
    return [
      { url: createUpiChooserIntentUrl(query, fallbackUrl), waitMs: 1800, label },
      { url: createUpiUrl(query), waitMs: 1500, label },
    ];
  }
  return [{ url: createUpiUrl(query), waitMs: 1800, label }];
};

export type LaunchHandlers = {
  onStep?: (label: string, index: number, total: number) => void;
  onExhausted: () => void;
};

export const launchUpiSequence = (
  steps: LaunchStep[],
  handlers: LaunchHandlers,
): (() => void) => {
  let index = 0;
  let opened = false;
  let cancelled = false;
  let timer: number | undefined;

  const markOpened = () => { opened = true; };
  const markOpenedIfHidden = () => {
    if (document.visibilityState === "hidden" || document.hidden) opened = true;
  };

  const cleanup = () => {
    cancelled = true;
    document.removeEventListener("visibilitychange", markOpenedIfHidden);
    window.removeEventListener("pagehide", markOpened);
    window.removeEventListener("blur", markOpened);
    if (timer !== undefined) window.clearTimeout(timer);
  };

  const runNext = () => {
    if (cancelled) return;
    if (opened || document.visibilityState === "hidden") { cleanup(); return; }
    if (index >= steps.length) { cleanup(); handlers.onExhausted(); return; }
    const step = steps[index];
    index += 1;
    handlers.onStep?.(step.label, index, steps.length);
    openUrl(step.url);
    timer = window.setTimeout(runNext, step.waitMs);
  };

  document.addEventListener("visibilitychange", markOpenedIfHidden);
  window.addEventListener("pagehide", markOpened);
  window.addEventListener("blur", markOpened);
  runNext();

  return cleanup;
};
