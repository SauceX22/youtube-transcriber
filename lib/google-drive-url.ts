export function extractGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") !== "drive.google.com") return null;
    const match = parsed.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,128})(?:\/|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
