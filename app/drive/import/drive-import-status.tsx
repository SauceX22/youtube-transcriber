"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = { status: string; progressText?: string; error?: string; id?: string };

export function DriveImportStatus() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/drive/import/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as Status;
        if (stopped) return;
        if (!response.ok) {
          setStatus({ status: "failed", error: data.error || "The local Drive import expired." });
          return;
        }
        setStatus(data);
        if (data.status === "processing") timer = setTimeout(poll, 2000);
      } catch {
        if (!stopped) setStatus({ status: "failed", error: "Could not read the local import status." });
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const isDone = status?.status === "done";
  const isFailed = !jobId || status?.status === "failed";
  const heading = isDone ? "Transcript ready" : isFailed ? "Import stopped" : "Private Drive import";
  const detail = isDone
    ? "The temporary media file has been removed. You can close this tab and return to Transcriber."
    : isFailed
      ? status?.error || "Authorization expired or could not be completed. Return to the Drive file and try again."
      : status?.progressText || (jobId ? "Starting the local import..." : "This authorization link is incomplete. Return to the Drive file and try again.");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[680px] items-center px-4 py-12">
      <section className="w-full space-y-6 rounded-3xl bg-[hsl(var(--panel))] p-6 shadow-[var(--edge),var(--shadow)] sm:p-8">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${isFailed ? "bg-red-400" : isDone ? "bg-emerald-400" : "animate-pulse bg-[hsl(var(--accent))]"}`} />
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">Google Drive</p>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white/90">{heading}</h1>
          <p className="text-sm leading-6 text-white/50">{detail}</p>
        </div>
        {!isDone && !isFailed && (
          <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-xs leading-5 text-white/45 shadow-[var(--edge)]">
            The selected file is downloaded only to a temporary folder on this Mac and transcribed with local Whisper. It is not sent to a cloud transcription provider.
          </p>
        )}
      </section>
    </main>
  );
}
