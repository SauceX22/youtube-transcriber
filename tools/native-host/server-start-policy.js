"use strict";

function chooseStartAction({ probeStatus, trackedProcessAlive }) {
  if (probeStatus === "ready") return "already_running";
  if (
    (probeStatus === "foreign" || probeStatus === "unhealthy") &&
    trackedProcessAlive
  ) {
    return "restart_tracked";
  }
  if (probeStatus === "foreign" || probeStatus === "unhealthy") {
    return "port_conflict";
  }
  return "start";
}

module.exports = { chooseStartAction };
