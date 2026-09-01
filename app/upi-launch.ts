"use client";

import {
  createAndroidUpiIntentUrl,
  createUpiAppSchemeUrls,
  createUpiChooserIntentUrl,
  createUpiUrl,
  type UpiApp,
} from "./payment-config";

export type LaunchStep = { url: string; waitMs: number; label: string };

type NavigatorWithUaData = Navigator & {
  userAgentData?: { platform?: string; mobile?: boolean };
};

/**
 * Desktop-site mode and several in-app WebViews strip "Android" from the UA
 * string, so a plain userAgent test used to send real Android users straight to
 * the retry page. Check the UA client hint first and never hard-gate on this —
 * a wrong answer only changes the order of attempts, not whether we try.
 */
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
 * Ordered attempts, cheapest-to-fail first. Each one is independent: if the
 * pinned package will not resolve we move on instead of surrendering.
 */
export const buildUpiLaunchSteps = (app: UpiApp, query: string): LaunchStep[] => {
  const android = isAndroid();
  const steps: LaunchStep[] = [];

  if (android) {
    steps.push({
      url: createAndroidUpiIntentUrl(app, query),
      waitMs: 1300,
      label: `Opening ${app.name}…`,
    });
  }

  for (const url of createUpiAppSchemeUrls(app, query)) {
    steps.push({ url, waitMs: 900, label: `Opening ${app.name}…` });
  }

  steps.push({
    url: android ? createUpiChooserIntentUrl(query) : createUpiUrl(query),
    waitMs: 1600,
    label: "Opening your UPI app…",
  });

  return steps;
};

export type LaunchHandlers = {
  onStep?: (label: string, index: number, total: number) => void;
  onExhausted: () => void;
};

/**
 * Runs the steps until the page is backgrounded (which means an app took over)
 * or the list runs out. Returns a cancel function.
 */
export const launchUpiSequence = (
  steps: LaunchStep[],
  handlers: LaunchHandlers,
): (() => void) => {
  let index = 0;
  let opened = false;
  let cancelled = false;
  let timer: number | undefined;

  const markOpened = () => {
    opened = true;
  };
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
    if (opened || document.visibilityState === "hidden") {
      cleanup();
      return;
    }
    if (index >= steps.length) {
      cleanup();
      handlers.onExhausted();
      return;
    }
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
