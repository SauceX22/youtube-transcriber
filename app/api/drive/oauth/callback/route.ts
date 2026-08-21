import { NextRequest, NextResponse } from "next/server";
import {
  authorizeGoogleDriveImport,
  type DriveImportAccess,
  failGoogleDriveAuthorization,
} from "@/lib/google-drive";

export const runtime = "nodejs";

function statusUrl(request: NextRequest, access: DriveImportAccess | null) {
  const url = new URL("/drive/import", request.url);
  if (access) url.searchParams.set("jobId", access.jobId);
  return url;
}

function redirectToStatus(request: NextRequest, access: DriveImportAccess | null) {
  const response = NextResponse.redirect(statusUrl(request, access));
  if (access) {
    response.cookies.set(`drive_poll_${access.jobId}`, access.pollToken, {
      httpOnly: true,
      sameSite: "strict",
      path: `/api/drive/import/${access.jobId}`,
      maxAge: 24 * 60 * 60,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const access = failGoogleDriveAuthorization(
      state,
      oauthError === "access_denied" ? "Google Drive access was cancelled." : "Google Drive authorization failed."
    );
    return redirectToStatus(request, access);
  }

  const code = request.nextUrl.searchParams.get("code") || "";
  const pickedFileIds = request.nextUrl.searchParams.get("picked_file_ids") || "";
  if (!state || !code || !pickedFileIds) {
    return redirectToStatus(
      request,
      failGoogleDriveAuthorization(state, "Google Drive did not return a selected file.")
    );
  }

  try {
    const access = await authorizeGoogleDriveImport({ state, code, pickedFileIds });
    return redirectToStatus(request, access);
  } catch {
    return redirectToStatus(request, null);
  }
}
