import { Suspense } from "react";
import { DriveImportStatus } from "./drive-import-status";

export default function DriveImportPage() {
  return (
    <Suspense fallback={null}>
      <DriveImportStatus />
    </Suspense>
  );
}
