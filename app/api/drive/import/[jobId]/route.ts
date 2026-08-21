import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleDriveImport,
} from "@/lib/google-drive";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const authorization = request.headers.get("authorization") || "";
  const headerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const pollToken =
    headerToken || request.cookies.get(`drive_poll_${jobId}`)?.value || "";
  const job = getGoogleDriveImport(jobId, pollToken);
  if (!job) return NextResponse.json({ error: "Google Drive import not found." }, { status: 404 });

  if (job.status === "done") {
    return NextResponse.json({
      status: "done",
      progress: 100,
      progressText: job.progressText,
      ...job.result,
    });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error || "Google Drive import failed." });
  }
  return NextResponse.json({
    status: "processing",
    progress: job.progress,
    progressText: job.progressText,
  });
}
