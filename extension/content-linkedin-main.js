(function () {
  if (window.__transcriberLinkedInCaptureInstalled) return;
  window.__transcriberLinkedInCaptureInstalled = true;

  const MEDIA_URL_PATTERN =
    /media\.licdn\.com|licdn\.com\/dms\/|\.mp4(?:[?#]|$)|\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)|videoplayback|playback/i;

  function emit(url) {
    if (typeof url !== "string" || !MEDIA_URL_PATTERN.test(url)) return;
    window.postMessage(
      {
        source: "transcriber-linkedin-media",
        url,
        ts: Date.now(),
      },
      "*"
    );
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (...args) {
      try {
        const input = args[0];
        emit(typeof input === "string" ? input : input?.url);
      } catch {
        // ignore
      }
      return originalFetch.apply(this, args);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      emit(url);
    } catch {
      // ignore
    }
    return originalOpen.call(this, method, url, ...rest);
  };

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) emit(entry.name);
    });
    observer.observe({ entryTypes: ["resource"] });
  } catch {
    // ignore
  }

  try {
    for (const entry of performance.getEntriesByType("resource")) {
      emit(entry.name);
    }
  } catch {
    // ignore
  }
})();
