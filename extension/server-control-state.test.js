const test = require("node:test");
const assert = require("node:assert/strict");

const { getServerControlView } = require("./server-control-state.js");

test("server start exposes an in-progress button and status", () => {
  assert.deepEqual(getServerControlView("starting"), {
    statusText: "Starting server…",
    startHidden: false,
    stopHidden: true,
    startDisabled: true,
    startLabel: "Starting…",
    spinnerHidden: false,
  });
});

test("successful startup replaces Start with the running state", () => {
  assert.deepEqual(getServerControlView("running"), {
    statusText: "Server running",
    startHidden: true,
    stopHidden: false,
    startDisabled: false,
    startLabel: "Start",
    spinnerHidden: true,
  });
});
