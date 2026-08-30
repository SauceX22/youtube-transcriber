/** Convert yt-dlp failures into actionable messages safe to show in the UI. */
export function classifyYtdlpError(raw: string): string {
  const lines = raw.split("\n");
  const errorLine = lines.find((line) => /^ERROR:/i.test(line.trim()));
  const primary = errorLine || raw;

  if (/requested format is not available/i.test(primary)) {
    return "YouTube did not provide a downloadable audio format. Update yt-dlp and try again.";
  }
  if (/unable to download webpage|urlopen error|timed out|network is unreachable|name or service not known|temporary failure in name resolution/i.test(primary)) {
    return "Network error downloading audio. Check your internet connection and try again.";
  }
  if (/video unavailable|private video|removed/i.test(primary)) {
    return "This video is unavailable, private, or has been removed.";
  }
  if (/sign in to confirm|age-restricted/i.test(primary)) {
    return "This video is age-restricted and requires authentication.";
  }
  if (/copyright|blocked/i.test(primary)) {
    return "This video is blocked or restricted due to copyright.";
  }
  if (/n challenge solving failed|n function possibilities/i.test(raw)) {
    return "Captions unavailable and audio download failed. Update yt-dlp and try again.";
  }
  if (/forcing SABR streaming|SABR-only streaming/i.test(raw) && !errorLine) {
    return "YouTube did not provide a downloadable audio format. Update yt-dlp and try again.";
  }

  const meaningful = lines
    .find((line) => line.trim() && !/^WARNING:|^Command failed:/i.test(line.trim()));

  return (errorLine || meaningful || "Audio download failed. Update yt-dlp and try again.")
    .trim()
    .slice(0, 200);
}
