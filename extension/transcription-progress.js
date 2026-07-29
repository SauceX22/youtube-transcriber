(function initTranscriptionProgress(globalScope) {
  "use strict";

  function normalizeProgressEvent(value) {
    if (!value || typeof value !== "object" || value.stage === "connected") {
      return null;
    }
    const statusText =
      typeof value.statusText === "string" ? value.statusText.trim().slice(0, 240) : "";
    if (!statusText) return null;
    const rawProgress = Number(value.progress);
    const progress = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, rawProgress))
      : 0;
    return {
      stage: typeof value.stage === "string" ? value.stage.slice(0, 64) : "",
      progress,
      statusText,
    };
  }

  function createSseParser(onEvent) {
    let buffer = "";

    function consumeBlock(block) {
      const payload = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!payload) return;
      try {
        const event = normalizeProgressEvent(JSON.parse(payload));
        if (event) onEvent(event);
      } catch {
        // Ignore malformed or incomplete events; the next complete event can
        // still advance the UI.
      }
    }

    return {
      push(chunk) {
        buffer += typeof chunk === "string" ? chunk : "";
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          consumeBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      },
      finish() {
        if (buffer.trim()) consumeBlock(buffer);
        buffer = "";
      },
    };
  }

  const api = { normalizeProgressEvent, createSseParser };
  globalScope.TranscriberProgress = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
