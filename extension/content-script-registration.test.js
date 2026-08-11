const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const extensionDir = __dirname;
const backgroundSource = fs.readFileSync(
  path.join(extensionDir, "background.js"),
  "utf8"
);
const urlUtilsSource = fs.readFileSync(
  path.join(extensionDir, "url-utils.js"),
  "utf8"
);
const contentSource = fs.readFileSync(
  path.join(extensionDir, "content.js"),
  "utf8"
);

test("content-script registration serializes lifecycle-triggered refreshes", () => {
  assert.match(
    backgroundSource,
    /contentScriptRegistrationChain\s*=\s*contentScriptRegistrationChain\s*\.then\(syncContentScripts,\s*syncContentScripts\)/
  );
});

test("YouTube recovery injection includes shared URL utilities", () => {
  assert.match(
    backgroundSource,
    /files:\s*\["url-utils\.js",\s*"content\.js"\]/
  );
});

test("YouTube scripts are idempotent when injected twice before body exists", () => {
  const listeners = [];
  const domReadyListeners = [];
  let listenerAddCount = 0;
  function createRuntime() {
    return {
      sendMessage() {},
      onMessage: {
        addListener(listener) {
          listenerAddCount++;
          listeners.push(listener);
        },
        removeListener(listener) {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
    };
  }
  const document = {
    body: null,
    title: "Example - YouTube",
    documentElement: { classList: { add() {}, remove() {} } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener(type, listener) {
      if (type === "DOMContentLoaded") domReadyListeners.push(listener);
    },
  };
  const context = vm.createContext({
    URL,
    console: { log() {} },
    document,
    globalThis: null,
    location: { href: "https://www.youtube.com/watch?v=abcdefghijk" },
    window: {
      location: { href: "https://www.youtube.com/watch?v=abcdefghijk" },
      addEventListener() {},
    },
    chrome: { runtime: createRuntime() },
    MutationObserver: class {
      observe(target) {
        assert.ok(target, "MutationObserver target must exist");
      }
      disconnect() {}
    },
    setTimeout() { return 1; },
    clearTimeout() {},
  });
  context.globalThis = context;

  vm.runInContext(urlUtilsSource, context);
  vm.runInContext(contentSource, context);
  vm.runInContext(urlUtilsSource, context);
  vm.runInContext(contentSource, context);

  assert.equal(listeners.length, 1, "only one message listener should attach");
  assert.equal(domReadyListeners.length, 1, "body readiness should be awaited once");

  context.chrome.runtime = createRuntime();
  vm.runInContext(contentSource, context);

  assert.equal(
    listeners.length,
    1,
    "a new extension lifecycle should replace the invalidated listener"
  );
  assert.equal(listenerAddCount, 2, "the replacement listener should be newly attached");
});
