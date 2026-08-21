import { NextRequest, NextResponse } from "next/server";
import {
  createGoogleDriveImport,
  isTrustedGoogleDriveExtensionOrigin,
} from "@/lib/google-drive";

export const runtime = "nodejs";

function isTrustedLocalCaller(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) return false;
  return isTrustedGoogleDriveExtensionOrigin(request.headers.get("origin"));
}

export async function POST(request: NextRequest) {
  if (!isTrustedLocalCaller(request)) {
    return NextResponse.json({ error: "Drive imports must start from the local Transcriber extension." }, { status: 403 });
  }
  let body: { sourceUrl?: unknown; title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.sourceUrl !== "string") {
    return NextResponse.json({ error: "A Google Drive file URL is required." }, { status: 400 });
  }

  try {
    const result = await createGoogleDriveImport({
      sourceUrl: body.sourceUrl,
      title: typeof body.title === "string" ? body.title : undefined,
    });
    if (result.status === "done") return NextResponse.json(result.result);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Google Drive import.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Too many Google Drive imports") ? 429 : 400 }
    );
  }
}
