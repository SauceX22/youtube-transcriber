"use strict";

var TranscriberGoogleDriveImport = globalThis.TranscriberGoogleDriveImport || (() => {
  function isContentId(videoId) {
    return typeof videoId === "string" && videoId.startsWith("drive:");
  }

  function isAuthorizationUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname === "accounts.google.com";
    } catch {
      return false;
    }
  }

  function isResumableState(state) {
    return !!(
      state?.status === "transcribing" &&
      isContentId(state.videoId) &&
      typeof state.jobId === "string" &&
      typeof state.drivePollToken === "string"
    );
  }

  function createLifecycle(options) {
    const {
      localBase,
      getMode,
      getState,
      setState,
      setBadge,
      advanceQueue,
      schedulePoll,
      openAuthorization,
      fetchImpl = fetch,
      warn = console.warn,
    } = options;
    let activeMonitorJobId = null;

    async function monitor(jobId, pollToken) {
      try {
        let response;
        try {
          response = await fetchImpl(
            `${localBase}/api/drive/import/${encodeURIComponent(jobId)}`,
            { headers: { Authorization: `Bearer ${pollToken}` } }
          );
        } catch {
          schedulePoll(jobId);
          return;
        }
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error("The local Drive import expired or the server restarted. Please try again.");
        }
        if (!response.ok) {
          schedulePoll(jobId);
          return;
        }
        if (data.status === "failed") {
          throw new Error(data.error || "Google Drive import failed.");
        }
        if (data.status !== "done" || !data.id) {
          const current = await getState();
          if (current?.status !== "transcribing" || current.jobId !== jobId) return;
          if (data.progressText) await setState({ ...current, progressText: data.progressText });
          schedulePoll(jobId);
          return;
        }
        const current = await getState();
        if (current?.status !== "transcribing" || current.jobId !== jobId) return;
        const { drivePollToken: _completedToken, ...completedState } = current;
        await setState({ ...completedState, status: "done", result: data, progressText: null });
        setBadge("✓", "#22c55e");
        setTimeout(() => {
          getState().then((next) => {
            if (next?.status === "done" || !next) setBadge("");
          });
        }, 5000);
        await advanceQueue();
      } catch (error) {
        const current = await getState();
        if (current?.status !== "transcribing" || current.jobId !== jobId) return;
        const { drivePollToken: _failedToken, ...failedState } = current;
        await setState({
          ...failedState,
          status: "error",
          error: error?.message || "Google Drive import failed.",
          progressText: null,
        });
        setBadge("!", "#ef4444");
        warn("[ytt-bg] private Drive import failed", { jobId, category: "drive_import" });
        await advanceQueue();
      }
    }

    function startMonitor(jobId, pollToken) {
      if (activeMonitorJobId === jobId) return;
      activeMonitorJobId = jobId;
      void monitor(jobId, pollToken).finally(() => {
        if (activeMonitorJobId === jobId) activeMonitorJobId = null;
      });
    }

    async function start(state) {
      if ((await getMode()) !== "local") {
        throw new Error("Private Google Drive transcription is available in self-hosted mode only.");
      }
      const response = await fetchImpl(`${localBase}/api/drive/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: state.url, title: state.title }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start Google Drive import.");
      if (data.id && data.videoId) {
        state.status = "done";
        state.result = data;
        await setState(state);
        setBadge("✓", "#22c55e");
        await advanceQueue();
        return data;
      }
      if (
        data?.status !== "processing" ||
        typeof data.id !== "string" ||
        !isAuthorizationUrl(data.authorizeUrl) ||
        typeof data.pollToken !== "string" ||
        data.pollToken.length < 32
      ) {
        throw new Error("The local server returned an invalid Google Drive authorization response.");
      }

      state.jobId = data.id;
      state.drivePollToken = data.pollToken;
      state.progressText = data.progress || "Waiting for per-file Google Drive permission...";
      await setState(state);
      await openAuthorization(data.authorizeUrl);
      startMonitor(data.id, data.pollToken);
      return { status: "processing", id: data.id, progress: state.progressText };
    }

    async function resumeIfNeeded() {
      const snapshot = await getState();
      if (!isResumableState(snapshot)) return;
      const current = await getState();
      if (
        !isResumableState(current) ||
        current.jobId !== snapshot.jobId ||
        current.drivePollToken !== snapshot.drivePollToken
      ) {
        return;
      }
      setBadge("...", "#a58959");
      startMonitor(snapshot.jobId, snapshot.drivePollToken);
    }

    return { isContentId, isResumableState, start, resumeIfNeeded };
  }

  return { createLifecycle };
})();

globalThis.TranscriberGoogleDriveImport = TranscriberGoogleDriveImport;
