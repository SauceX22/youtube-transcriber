// Shared SPA page-reporter runtime for platform content scripts.
//
// Every platform script (Spotify, Substack, Twitter/X, LinkedIn) needs the
// same lifecycle plumbing: staggered initial reports while the SPA hydrates,
// a MutationObserver that notices in-app navigation, popstate handling, a
// PING_TRANSCRIBER liveness reply (background pings before re-injecting on
// extension update — a missing/incorrect reply causes duplicate injection),
// and try/catch around sendMessage so a torn-down service worker context
// detaches the observer instead of throwing forever.
//
// This file is registered ahead of each content-*.js in background.js
// CONTENT_SCRIPTS, so scripts call TranscriberPageReporter.start({...}) and
// keep only their platform-specific detection logic.

const TranscriberPageReporter = (() => {
  "use strict";

  /**
   * opts:
   *   report            required () => void — detect + send PAGE_INFO.
   *   resetState        optional () => void — clear memo keys on navigation.
   *   getPageInfo       optional () => object|null — reply for GET_PAGE_INFO
   *                     (popup's live query); null replies { ok: false }.
   *   onSameUrlMutation optional (schedule) => void — DOM mutated without a
   *                     URL change; default schedules a report immediately.
   *   initialDelays     default [400, 1500, 3500]
   *   urlChangeDelay    default 600
   *   popstateDelay     default 300
   */
  function start(opts) {
    const {
      report,
      resetState,
      getPageInfo,
      onSameUrlMutation,
      initialDelays = [400, 1500, 3500],
      urlChangeDelay = 600,
      popstateDelay = 300,
    } = opts;

    let pendingTimer = null;
    // First-wins coalescing: under LinkedIn/X-grade mutation storms a
    // clear-and-rearm timer never fires; an armed timer that always runs
    // guarantees steady progress.
    function schedule(delayMs = 250) {
      if (pendingTimer !== null) return;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        report();
      }, delayMs);
    }

    function handleNavigation(delayMs) {
      if (resetState) resetState();
      schedule(delayMs);
    }

    initialDelays.forEach((delay) => setTimeout(() => schedule(0), delay));

    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleNavigation(urlChangeDelay);
        return;
      }
      if (onSameUrlMutation) {
        onSameUrlMutation(schedule);
      } else {
        schedule(0);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("popstate", () => handleNavigation(popstateDelay));

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      // Liveness probe — must respond synchronously so the background's
      // callback sees { ok: true } rather than chrome.runtime.lastError.
      if (msg?.type === "PING_TRANSCRIBER") {
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "GET_PAGE_INFO" && getPageInfo) {
        sendResponse(getPageInfo() || { ok: false });
        return false;
      }
      return undefined;
    });

    return {
      schedule,
      // sendMessage wrapper: a dead extension context (update/reload) makes
      // sendMessage throw; stop observing instead of erroring on every
      // mutation for the lifetime of the tab.
      send(message) {
        try {
          chrome.runtime.sendMessage(message);
        } catch {
          observer.disconnect();
        }
      },
    };
  }

  return { start };
})();
