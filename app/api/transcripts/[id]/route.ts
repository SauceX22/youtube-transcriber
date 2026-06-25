import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

function cleanMetadata(value: unknown, maxLen: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLen)
    : null;
}

function isSpotifyUrl(value: string): boolean {
  try {
    return new URL(value).hostname.replace(/^www\./, "") === "open.spotify.com";
  } catch {
    return false;
  }
}

function isGenericSpotifyTitle(value: string): boolean {
  return /^spotify\s*[-–]\s*web player$/i.test(value.trim());
}

function cleanTitle(value: unknown, maxLen: number, sourceUrl: string): string | null {
  const cleaned = cleanMetadata(value, maxLen);
  if (cleaned && isSpotifyUrl(sourceUrl) && isGenericSpotifyTitle(cleaned)) {
    return null;
  }
  return cleaned;
}

function cleanHttpUrl(value: unknown, maxLen: number): string | null {
  const cleaned = cleanMetadata(value, maxLen);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    return url.protocol === "http:" || url.protocol === "https:" ? cleaned : null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  let body: {
    title?: unknown;
    author?: unknown;
    channelUrl?: unknown;
    videoUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = {
    title: cleanTitle(body.title, 512, video.videoUrl) || video.title,
    author: cleanMetadata(body.author, 256) || video.author,
    channelUrl: cleanHttpUrl(body.channelUrl, 1024) || video.channelUrl,
    videoUrl: cleanHttpUrl(body.videoUrl, 2048) || video.videoUrl,
  };

  const updated = await prisma.video.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  await prisma.video.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
