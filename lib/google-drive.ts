import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "./prisma";
import { transcribeMediaFile } from "./generic-video";
import { extractGoogleDriveFileId } from "./google-drive-url";
import { isWhisperEnabled } from "./providers";

export { extractGoogleDriveFileId } from "./google-drive-url";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:19720/api/drive/oauth/callback";
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024 * 1024;
const STATE_TTL_MS = 10 * 60 * 1000;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_DRIVE_JOBS = 1;
const MAX_RETAINED_DRIVE_JOBS = 64;
const DRIVE_API_TIMEOUT_MS = 30 * 1000;
const DRIVE_DOWNLOAD_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export type DriveImportStatus =
  | "awaiting_authorization"
  | "downloading"
  | "transcribing"
  | "done"
  | "failed";

export interface DriveImportJob {
  id: string;
  pollToken: string;
  fileId: string;
  sourceUrl: string;
  requestedTitle: string;
  status: DriveImportStatus;
  progress: number;
  progressText: string;
  createdAt: number;
  result?: DriveImportResult;
  error?: string;
}

export interface DriveImportResult {
  id: string;
  videoId: string;
  title: string;
  author: string;
  videoUrl: string;
  source: string;
  platform: string;
}

export interface DriveImportAccess {
  jobId: string;
  pollToken: string;
}

export function isTrustedGoogleDriveExtensionOrigin(
  origin: string | null,
  configuredExtensionIds = process.env.GOOGLE_DRIVE_EXTENSION_IDS || ""
): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "chrome-extension:") return false;
    const allowedIds = configuredExtensionIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return allowedIds.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function accessForJob(jobId: string): DriveImportAccess | null {
  const job = jobs.get(jobId);
  return job ? { jobId: job.id, pollToken: job.pollToken } : null;
}

async function withDriveRequestTimeout<T>(
  label: string,
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${label} timed out.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

interface DriveOAuthState {
  jobId: string;
  fileId: string;
  expiresAt: number;
}

interface DriveFileMetadata {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  capabilities?: { canDownload?: boolean };
  owners?: Array<{ displayName?: string }>;
}

interface DriveGlobals {
  driveImportJobs?: Map<string, DriveImportJob>;
  driveOAuthStates?: Map<string, DriveOAuthState>;
  driveJobExpiryTimers?: Map<string, ReturnType<typeof setTimeout>>;
  driveImportWorker?: Promise<void>;
}

const driveGlobals = globalThis as typeof globalThis & DriveGlobals;
const jobs = driveGlobals.driveImportJobs ?? new Map<string, DriveImportJob>();
const oauthStates = driveGlobals.driveOAuthStates ?? new Map<string, DriveOAuthState>();
const jobExpiryTimers =
  driveGlobals.driveJobExpiryTimers ?? new Map<string, ReturnType<typeof setTimeout>>();
driveGlobals.driveImportJobs = jobs;
driveGlobals.driveOAuthStates = oauthStates;
driveGlobals.driveJobExpiryTimers = jobExpiryTimers;

function toDriveImportResult(video: DriveImportResult): DriveImportResult {
  return {
    id: video.id,
    videoId: video.videoId,
    title: video.title,
    author: video.author,
    videoUrl: video.videoUrl,
    source: video.source,
    platform: video.platform,
  };
}

function deleteJob(jobId: string) {
  jobs.delete(jobId);
  const timer = jobExpiryTimers.get(jobId);
  if (timer) clearTimeout(timer);
  jobExpiryTimers.delete(jobId);
}

function scheduleJobExpiry(jobId: string) {
  const previous = jobExpiryTimers.get(jobId);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => deleteJob(jobId), JOB_TTL_MS);
  timer.unref?.();
  jobExpiryTimers.set(jobId, timer);
}

export function buildGoogleDriveAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  fileId: string;
}): string {
  // Google added the desktop/mobile Picker trigger directly to the OAuth URL.
  // Keep this flow aligned with the current contract documented at:
  // https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    access_type: "online",
    scope: DRIVE_SCOPE,
    prompt: "consent",
    trigger_onepick: "true",
    allow_multiple: "false",
    file_ids: input.fileId,
    state: input.state,
  }).toString();
  return url.toString();
}

export function requireExpectedPickedFile(pickedFileIds: string, expectedFileId: string): string {
  const picked = pickedFileIds.split(",").map((value) => value.trim()).filter(Boolean);
  if (picked.length !== 1) {
    throw new Error("Select exactly one Google Drive file.");
  }
  if (picked[0] !== expectedFileId) {
    throw new Error("The selected file did not match the requested Google Drive video.");
  }
  return picked[0];
}

export async function withTemporaryDriveDirectory<T>(
  work: (directory: string) => Promise<T>
): Promise<T> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "transcriber-drive-"));
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function getDriveConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Drive import is not configured. Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to .env, then restart the server."
    );
  }
  const parsedRedirect = new URL(redirectUri);
  const isLoopback =
    parsedRedirect.protocol === "http:" &&
    (parsedRedirect.hostname === "127.0.0.1" || parsedRedirect.hostname === "localhost") &&
    parsedRedirect.pathname === "/api/drive/oauth/callback";
  if (!isLoopback) {
    throw new Error(
      "GOOGLE_DRIVE_REDIRECT_URI must use the local /api/drive/oauth/callback endpoint."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function cleanupExpiredEntries(now = Date.now()) {
  for (const [state, entry] of oauthStates) {
    if (entry.expiresAt <= now) {
      oauthStates.delete(state);
      updateJob(entry.jobId, {
        status: "failed",
        progress: 100,
        progressText: "Authorization expired",
        error: "Google Drive authorization expired. Start the import again.",
      });
    }
  }
  for (const [jobId, job] of jobs) {
    if (job.createdAt + JOB_TTL_MS <= now) deleteJob(jobId);
  }
  if (jobs.size > MAX_RETAINED_DRIVE_JOBS) {
    const terminalJobs = [...jobs.values()]
      .filter((job) => job.status === "done" || job.status === "failed")
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const job of terminalJobs) {
      if (jobs.size <= MAX_RETAINED_DRIVE_JOBS) break;
      deleteJob(job.id);
    }
  }
}

function updateJob(jobId: string, update: Partial<DriveImportJob>) {
  const current = jobs.get(jobId);
  if (!current) return;
  jobs.set(jobId, { ...current, ...update });
}

export async function createGoogleDriveImport(input: { sourceUrl: string; title?: string }) {
  cleanupExpiredEntries();
  const fileId = extractGoogleDriveFileId(input.sourceUrl);
  if (!fileId) throw new Error("Open an individual Google Drive file before importing it.");
  if (!(await isWhisperEnabled())) {
    throw new Error(
      "Private Google Drive files require local Whisper. Enable local Whisper in Settings before retrying."
    );
  }
  const config = getDriveConfig();
  const existing = await prisma.video.findUnique({ where: { videoId: `drive:${fileId}` } });
  if (existing?.transcript && existing.transcript !== "[]") {
    return { status: "done" as const, result: toDriveImportResult(existing) };
  }
  const activeJobs = [...jobs.values()].filter(
    (job) => job.status !== "done" && job.status !== "failed"
  ).length;
  if (activeJobs >= MAX_ACTIVE_DRIVE_JOBS) {
    throw new Error("Too many Google Drive imports are pending. Finish or retry the current import first.");
  }

  const jobId = randomUUID();
  const pollToken = randomBytes(32).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const sourceUrl = `https://drive.google.com/file/d/${fileId}/view`;
  jobs.set(jobId, {
    id: jobId,
    pollToken,
    fileId,
    sourceUrl,
    requestedTitle: input.title?.trim().slice(0, 512) || "Google Drive video",
    status: "awaiting_authorization",
    progress: 5,
    progressText: "Waiting for per-file Google Drive permission...",
    createdAt: Date.now(),
  });
  scheduleJobExpiry(jobId);
  oauthStates.set(state, { jobId, fileId, expiresAt: Date.now() + STATE_TTL_MS });
  return {
    status: "processing" as const,
    id: jobId,
    pollToken,
    authorizeUrl: buildGoogleDriveAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      fileId,
    }),
    progress: "Waiting for per-file Google Drive permission...",
    disclosure: "The selected file is downloaded temporarily to this Mac and transcribed with local Whisper. The media file is deleted after processing.",
  };
}

export function getGoogleDriveImport(jobId: string, pollToken: string): DriveImportJob | null {
  cleanupExpiredEntries();
  const job = jobs.get(jobId);
  return job?.pollToken === pollToken ? job : null;
}

export function failGoogleDriveAuthorization(
  state: string,
  message: string
): DriveImportAccess | null {
  const entry = oauthStates.get(state);
  if (!entry) return null;
  oauthStates.delete(state);
  updateJob(entry.jobId, { status: "failed", progress: 100, progressText: "Import failed", error: message });
  return accessForJob(entry.jobId);
}

export async function authorizeGoogleDriveImport(input: {
  state: string;
  code: string;
  pickedFileIds: string;
}): Promise<DriveImportAccess> {
  cleanupExpiredEntries();
  const stateEntry = oauthStates.get(input.state);
  if (!stateEntry) throw new Error("This Google Drive authorization expired. Start the import again.");
  oauthStates.delete(input.state);
  try {
    requireExpectedPickedFile(input.pickedFileIds, stateEntry.fileId);
    const config = getDriveConfig();
    const { tokenResponse, tokenData } = await withDriveRequestTimeout(
      "Google Drive authorization",
      DRIVE_API_TIMEOUT_MS,
      async (signal) => {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: input.code,
            redirect_uri: config.redirectUri,
            grant_type: "authorization_code",
          }),
          signal,
        });
        const tokenData = (await tokenResponse.json().catch(() => ({}))) as {
          access_token?: string;
          error_description?: string;
        };
        return { tokenResponse, tokenData };
      }
    );
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Google Drive authorization failed.");
    }
    enqueueGoogleDriveImport(stateEntry.jobId, tokenData.access_token);
    return accessForJob(stateEntry.jobId)!;
  } catch (error) {
    updateJob(stateEntry.jobId, {
      status: "failed",
      progress: 100,
      progressText: "Import failed",
      error: error instanceof Error ? error.message : "Google Drive authorization failed.",
    });
    return accessForJob(stateEntry.jobId)!;
  }
}

function enqueueGoogleDriveImport(jobId: string, accessToken: string) {
  updateJob(jobId, {
    status: "transcribing",
    progress: 10,
    progressText: "Queued for local processing...",
  });
  const run = () => processGoogleDriveImport(jobId, accessToken);
  driveGlobals.driveImportWorker = (driveGlobals.driveImportWorker ?? Promise.resolve()).then(
    run,
    run
  );
}

async function fetchDriveMetadata(fileId: string, accessToken: string): Promise<DriveFileMetadata> {
  const fields = "id,name,mimeType,size,capabilities(canDownload),owners(displayName)";
  return withDriveRequestTimeout(
    "Google Drive metadata request",
    DRIVE_API_TIMEOUT_MS,
    async (signal) => {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal }
      );
      if (!response.ok) throw new Error("Google Drive could not provide metadata for this file.");
      return (await response.json()) as DriveFileMetadata;
    }
  );
}

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.replace(/[^a-zA-Z0-9]/g, "");
  return subtype ? `.${subtype === "quicktime" ? "mov" : subtype}` : ".media";
}

async function downloadDriveFile(input: {
  fileId: string;
  accessToken: string;
  outputPath: string;
  maxBytes: number;
}) {
  await withDriveRequestTimeout(
    "Google Drive download",
    DRIVE_DOWNLOAD_TIMEOUT_MS,
    async (signal) => {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${input.accessToken}` }, signal }
      );
      if (!response.ok || !response.body) {
        throw new Error("Google Drive could not download this file.");
      }
      const declaredSize = Number(response.headers.get("content-length") || "0");
      if (declaredSize > input.maxBytes) {
        throw new Error("This Google Drive file is larger than the configured import limit.");
      }
      const reader = response.body.getReader();
      const limitedBody = Readable.from((async function* () {
        let downloadedBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            downloadedBytes += value.byteLength;
            if (downloadedBytes > input.maxBytes) {
              throw new Error("This Google Drive file is larger than the configured import limit.");
            }
            yield value;
          }
        } finally {
          reader.releaseLock();
        }
      })());
      await pipeline(limitedBody, createWriteStream(input.outputPath));
      await stat(input.outputPath);
    }
  );
}

async function processGoogleDriveImport(jobId: string, accessToken: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  try {
    updateJob(jobId, { status: "downloading", progress: 15, progressText: "Checking the selected Drive file..." });
    const metadata = await fetchDriveMetadata(job.fileId, accessToken);
    if (metadata.id !== job.fileId) throw new Error("Google Drive returned an unexpected file.");
    if (!metadata.mimeType || (!metadata.mimeType.startsWith("video/") && !metadata.mimeType.startsWith("audio/"))) {
      throw new Error("Select a video or audio file from Google Drive.");
    }
    if (metadata.capabilities?.canDownload === false) {
      throw new Error("The owner has disabled downloading for this Google Drive file.");
    }
    const configuredMaxBytes = Number(process.env.GOOGLE_DRIVE_MAX_BYTES || DEFAULT_MAX_BYTES);
    const maxBytes = Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0
      ? configuredMaxBytes
      : DEFAULT_MAX_BYTES;
    const declaredSize = Number(metadata.size || "0");
    if (declaredSize > maxBytes) throw new Error("This Google Drive file is larger than the configured import limit.");

    const video = await withTemporaryDriveDirectory(async (directory) => {
      const mediaPath = path.join(directory, `source${extensionForMimeType(metadata.mimeType || "")}`);
      updateJob(jobId, { status: "downloading", progress: 25, progressText: "Downloading the selected file temporarily..." });
      await downloadDriveFile({ fileId: job.fileId, accessToken, outputPath: mediaPath, maxBytes });
      updateJob(jobId, { status: "transcribing", progress: 45, progressText: "Transcribing locally with Whisper..." });
      const { segments, source } = await transcribeMediaFile(mediaPath, `drive:${job.fileId}`, { localOnly: true });
      const data = {
        videoId: `drive:${job.fileId}`,
        title: metadata.name?.trim().slice(0, 512) || job.requestedTitle,
        author: metadata.owners?.[0]?.displayName?.trim().slice(0, 256) || "Google Drive",
        channelUrl: "",
        thumbnailUrl: "",
        videoUrl: job.sourceUrl,
        transcript: JSON.stringify(segments),
        source: `drive_${source}`,
        platform: "drive",
      };
      return prisma.video.upsert({ where: { videoId: data.videoId }, update: data, create: data });
    });
    updateJob(jobId, {
      status: "done",
      progress: 100,
      progressText: "Transcription complete",
      result: toDriveImportResult(video),
    });
  } catch (error) {
    updateJob(jobId, {
      status: "failed",
      progress: 100,
      progressText: "Import failed",
      error: error instanceof Error ? error.message : "Google Drive import failed.",
    });
  }
}
