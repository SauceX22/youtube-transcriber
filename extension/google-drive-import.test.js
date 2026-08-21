const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "google-drive-import.js"), "utf8");

function loadModule() {
  const context = vm.createContext({ URL, console, setTimeout, globalThis: null });
  context.globalThis = context;
  vm.runInContext(source, context);
  return context.TranscriberGoogleDriveImport;
}

test("recognizes only capability-bearing Drive jobs as resumable", () => {
  const lifecycle = loadModule().createLifecycle({ fetchImpl: async () => {} });
  assert.equal(
    lifecycle.isResumableState({
      status: "transcribing",
      videoId: "drive:file-id",
      jobId: "job-id",
      drivePollToken: "token",
    }),
    true
  );
  assert.equal(
    lifecycle.isResumableState({
      status: "transcribing",
      videoId: "youtube-id",
      jobId: "job-id",
      drivePollToken: "token",
    }),
    false
  );
});

test("cached Drive completion advances the transcription queue", async () => {
  let storedState = null;
  let queueAdvances = 0;
  const cached = { id: "record-id", videoId: "drive:file-id", title: "Private file" };
  const lifecycle = loadModule().createLifecycle({
    localBase: "http://localhost:19720",
    getMode: async () => "local",
    getState: async () => storedState,
    setState: async (state) => { storedState = state; },
    setBadge: () => {},
    advanceQueue: async () => { queueAdvances += 1; },
    openAuthorization: async () => {},
    fetchImpl: async () => ({ ok: true, json: async () => cached }),
  });

  const result = await lifecycle.start({
    url: "https://drive.google.com/file/d/file-id/view",
    title: "Private file",
    videoId: "drive:file-id",
    status: "transcribing",
  });

  assert.equal(result.id, "record-id");
  assert.equal(storedState.status, "done");
  assert.equal(queueAdvances, 1);
});

test("terminal Drive failure advances the transcription queue once", async () => {
  let storedState = null;
  let queueAdvances = 0;
  let finishAdvance;
  const advanced = new Promise((resolve) => { finishAdvance = resolve; });
  let requestCount = 0;
  const lifecycle = loadModule().createLifecycle({
    localBase: "http://localhost:19720",
    getMode: async () => "local",
    getState: async () => storedState,
    setState: async (state) => { storedState = state; },
    setBadge: () => {},
    advanceQueue: async () => {
      queueAdvances += 1;
      finishAdvance();
    },
    openAuthorization: async () => {},
    wait: async () => {},
    warn: () => {},
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: true,
          json: async () => ({
            status: "processing",
            id: "job-id",
            pollToken: "x".repeat(32),
            authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "failed", error: "Authorization denied" }),
      };
    },
  });

  await lifecycle.start({
    url: "https://drive.google.com/file/d/file-id/view",
    title: "Private file",
    videoId: "drive:file-id",
    status: "transcribing",
  });
  await advanced;

  assert.equal(storedState.status, "error");
  assert.equal(queueAdvances, 1);
});
