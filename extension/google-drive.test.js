const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "url-utils.js"), "utf8");

function loadUrlUtils() {
  const context = vm.createContext({ URL, globalThis: null });
  context.globalThis = context;
  vm.runInContext(source, context);
  return context.TranscriberUrlUtils;
}

test("extracts a stable private-safe identity from Google Drive file URLs", () => {
  const utils = loadUrlUtils();
  const fileId = "1AbCdEfGhIjKlMnOpQrStUvWxYz_12345";

  assert.equal(
    utils.extractGoogleDriveFileId(`https://drive.google.com/file/d/${fileId}/view?usp=sharing`),
    fileId
  );
  assert.equal(
    utils.extractContentId(`https://drive.google.com/file/d/${fileId}/view`),
    `drive:${fileId}`
  );
});

test("does not treat Drive folders, home pages, or lookalike hosts as files", () => {
  const utils = loadUrlUtils();

  assert.equal(utils.extractContentId("https://drive.google.com/drive/my-drive"), null);
  assert.equal(utils.extractContentId("https://drive.google.com/drive/folders/folder-id"), null);
  assert.equal(
    utils.extractContentId("https://drive.google.com.evil.example/file/d/1AbCdEfGhIjKlMnOp/view"),
    null
  );
});
