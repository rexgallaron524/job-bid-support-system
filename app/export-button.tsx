"use client";
import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import type { Job } from "@/lib/domain";
import { exportFolder, exportText } from "@/lib/export";
type WritableHandle = { write: (text: string) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> };
type Directory = { name: string; getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<Directory>; getFileHandle: (name: string, options: { create: boolean }) => Promise<{ createWritable: () => Promise<WritableHandle> }> };
export default function ExportButton({ job }: { job: Job }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setMessage("");
    const picker = (window as unknown as { showDirectoryPicker?: (options: { id: string; mode: string }) => Promise<Directory> }).showDirectoryPicker;
    if (!picker) { setMessage("Open this app in Edge or Chrome over HTTPS (or localhost) to export directly to D:\\jobbid."); return; }
    try {
      const root = await picker.call(window, { id: "job-support-export", mode: "readwrite" });
      setBusy(true);
      const folder = exportFolder(job);
      const directory = await root.getDirectoryHandle(folder, { create: true });
      const file = await directory.getFileHandle("jd.txt", { create: true });
      const stream = await file.createWritable();
      try { await stream.write(exportText(job)); await stream.close(); }
      catch (error) { await stream.abort().catch(() => {}); throw error; }
      setMessage("Saved in " + root.name + "\\" + folder + "\\jd.txt");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage((e as Error).message || "Could not write the export. Check folder permissions.");
    } finally { setBusy(false); }
  }
  return <div className="export-control"><button className="btn" disabled={busy} onClick={save}><ArrowDownToLine size={15} />{busy ? "Exporting…" : "Export JD to folder"}</button><small>Select D:\\jobbid. Re-exporting this job replaces its jd.txt.</small>{message && <p role="status" className="export-message">{message}</p>}</div>;
}

