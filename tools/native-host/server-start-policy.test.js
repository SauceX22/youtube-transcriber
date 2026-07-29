const test = require("node:test");
const assert = require("node:assert/strict");

const { chooseStartAction } = require("./server-start-policy.js");

test("restarts a tracked Transcriber process when its health route is broken", () => {
  assert.equal(
    chooseStartAction({ probeStatus: "foreign", trackedProcessAlive: true }),
    "restart_tracked"
  );
});

test("does not replace an unrelated process using the Transcriber port", () => {
  assert.equal(
    chooseStartAction({ probeStatus: "foreign", trackedProcessAlive: false }),
    "port_conflict"
  );
});

test("keeps an already healthy server and starts an unused port", () => {
  assert.equal(
    chooseStartAction({ probeStatus: "ready", trackedProcessAlive: true }),
    "already_running"
  );
  assert.equal(
    chooseStartAction({ probeStatus: "down", trackedProcessAlive: false }),
    "start"
  );
});
