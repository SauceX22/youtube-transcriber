(function initServerControlState(globalScope) {
  "use strict";

  function getServerControlView(phase) {
    if (phase === "starting") {
      return {
        statusText: "Starting server…",
        startHidden: false,
        stopHidden: true,
        startDisabled: true,
        startLabel: "Starting…",
        spinnerHidden: false,
      };
    }
    if (phase === "running") {
      return {
        statusText: "Server running",
        startHidden: true,
        stopHidden: false,
        startDisabled: false,
        startLabel: "Start",
        spinnerHidden: true,
      };
    }
    return {
      statusText: "Server stopped",
      startHidden: false,
      stopHidden: true,
      startDisabled: false,
      startLabel: "Start",
      spinnerHidden: true,
    };
  }

  const api = { getServerControlView };
  globalScope.TranscriberServerControl = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
