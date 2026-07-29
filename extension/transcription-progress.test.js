const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSseParser,
  normalizeProgressEvent,
} = require("./transcription-progress.js");

test("normalizes real transcription progress without inventing a stage", () => {
  assert.deepEqual(
    normalizeProgressEvent({
      stage: "transcribing",
      progress: 40,
      statusText: "Transcribing with Whisper...",
    }),
    {
      stage: "transcribing",
      progress: 40,
      statusText: "Transcribing with Whisper...",
    }
  );
  assert.equal(
    normalizeProgressEvent({
      stage: "connected",
      progress: 0,
      statusText: "Waiting for transcription...",
    }),
    null
  );
});

test("parses progress events split across streamed chunks", () => {
  const events = [];
  const parser = createSseParser((event) => events.push(event));

  parser.push(
    'data: {"stage":"downloading","progress":15,"statusText":"Downloading'
  );
  parser.push(
    ' audio..."}\n\ndata: {"stage":"transcribing","progress":40,"statusText":"Transcribing with Whisper..."}\n\n'
  );
  parser.finish();

  assert.deepEqual(events, [
    {
      stage: "downloading",
      progress: 15,
      statusText: "Downloading audio...",
    },
    {
      stage: "transcribing",
      progress: 40,
      statusText: "Transcribing with Whisper...",
    },
  ]);
});
