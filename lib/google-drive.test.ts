import assert from "node:assert/strict";
import { access, writeFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGoogleDriveAuthorizationUrl,
  extractGoogleDriveFileId,
  isTrustedGoogleDriveExtensionOrigin,
  requireExpectedPickedFile,
  withTemporaryDriveDirectory,
} from "./google-drive";

const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz_12345";

test("extractGoogleDriveFileId accepts file pages only", () => {
  assert.equal(
    extractGoogleDriveFileId(`https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`),
    FILE_ID
  );
  assert.equal(extractGoogleDriveFileId("https://drive.google.com/drive/my-drive"), null);
  assert.equal(
    extractGoogleDriveFileId(`https://drive.google.com.evil.example/file/d/${FILE_ID}/view`),
    null
  );
});

test("Drive import routes trust only configured extension origins", () => {
  const extensionId = "abcdefghijklmnopabcdefghijklmnop";
  assert.equal(
    isTrustedGoogleDriveExtensionOrigin(`chrome-extension://${extensionId}`, extensionId),
    true
  );
  assert.equal(
    isTrustedGoogleDriveExtensionOrigin(
      "chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba",
      extensionId
    ),
    false
  );
  assert.equal(
    isTrustedGoogleDriveExtensionOrigin(
      `chrome-extension://${extensionId}.evil.example`,
      extensionId
    ),
    false
  );
  assert.equal(
    isTrustedGoogleDriveExtensionOrigin(null, extensionId),
    false
  );
  assert.equal(
    isTrustedGoogleDriveExtensionOrigin("http://127.0.0.1:19720", extensionId),
    false
  );
  assert.equal(
    isTrustedGoogleDriveExtensionOrigin("https://attacker.example", extensionId),
    false
  );
});

test("authorization is per-file and uses only the drive.file scope", () => {
  const url = new URL(
    buildGoogleDriveAuthorizationUrl({
      clientId: "client-id.apps.googleusercontent.com",
      redirectUri: "http://127.0.0.1:19720/api/drive/oauth/callback",
      state: "opaque-state",
      fileId: FILE_ID,
    })
  );

  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file");
  assert.equal(url.searchParams.get("file_ids"), FILE_ID);
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("trigger_onepick"), "true");
  assert.equal(url.searchParams.get("allow_multiple"), "false");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "opaque-state");
  assert.doesNotMatch(url.toString(), /drive\.readonly|auth\/drive(?:&|%|$)/);
});

test("callback must select exactly the requested file", () => {
  assert.equal(requireExpectedPickedFile(FILE_ID, FILE_ID), FILE_ID);
  assert.throws(
    () => requireExpectedPickedFile("different-file-id", FILE_ID),
    /selected file did not match/i
  );
  assert.throws(
    () => requireExpectedPickedFile(`${FILE_ID},another-file-id`, FILE_ID),
    /exactly one .*file/i
  );
});

test("temporary Drive media is removed after a failed transcription", async () => {
  let temporaryPath = "";

  await assert.rejects(
    withTemporaryDriveDirectory(async (directory) => {
      temporaryPath = directory;
      await writeFile(`${directory}/private-video.bin`, "private content");
      throw new Error("transcription failed");
    }),
    /transcription failed/
  );

  await assert.rejects(access(temporaryPath));
});
