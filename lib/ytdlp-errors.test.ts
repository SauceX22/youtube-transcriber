import assert from "node:assert/strict";
import test from "node:test";
import { classifyYtdlpError } from "./ytdlp-errors";

test("classifies YouTube format extraction failures without exposing the command", () => {
  const raw = [
    "Command failed: yt-dlp -x --audio-format mp3 https://www.youtube.com/watch?v=example",
    "WARNING: [youtube] YouTube is forcing SABR streaming for this client.",
    "ERROR: [youtube] example: Requested format is not available.",
  ].join("\n");

  const message = classifyYtdlpError(raw);

  assert.match(message, /update yt-dlp/i);
  assert.doesNotMatch(message, /Command failed|https:\/\//i);
});

test("preserves actionable network and authentication errors", () => {
  assert.match(
    classifyYtdlpError("ERROR: unable to download webpage: timed out"),
    /network error/i
  );
  assert.match(
    classifyYtdlpError("ERROR: Sign in to confirm your age"),
    /age-restricted/i
  );
});

test("prefers the fatal error over an accompanying SABR warning", () => {
  const raw = [
    "WARNING: [youtube] YouTube is forcing SABR streaming for this client.",
    "ERROR: [youtube] Sign in to confirm your age",
  ].join("\n");

  assert.match(classifyYtdlpError(raw), /age-restricted/i);
});
