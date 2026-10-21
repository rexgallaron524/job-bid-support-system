"use client";
import { useEffect, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import type { Job } from "@/lib/domain";
import { exportFolder, exportText } from "@/lib/export";
import { loadExportDirectory, rememberExportDirectory, type ExportDirectory } from "@/lib/export-directory";

export default function ExportButton({ job, accountKey }: { job: Job; accountKey: string }) {
  const [root, setRoot] = useState<ExportDirectory>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storageWarning, setStorageWarning] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRoot(undefined);
    void loadExportDirectory(accountKey).then(directory => {
      if (active) setRoot(directory);
    }).catch(() => {
      if (active) setStorageWarning("Your browser could not restore the export folder. Select D:\\jobbid again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountKey]);

  async function save(changeFolder = false) {
    setMessage("");
    const picker = (window as unknown as { showDirectoryPicker?: (options: { id: string; mode: "readwrite"; startIn?: ExportDirectory }) => Promise<ExportDirectory> }).showDirectoryPicker;
    if (!picker) { setMessage("Open this app in Edge or Chrome over HTTPS (or localhost) to export directly to D:\\jobbid."); return; }
    setBusy(true);
    try {
      let directoryRoot = root;
      if (!directoryRoot || changeFolder) {
        // Open the picker directly from the click; awaiting storage first loses user activation.
        directoryRoot = await picker.call(window, { id: "job-support-export", mode: "readwrite", ...(root ? { startIn: root } : {}) });
        setRoot(directoryRoot);
        try {
          await rememberExportDirectory(accountKey, directoryRoot);
          setStorageWarning("");
        } catch {
          setStorageWarning("This folder works now, but your browser could not remember it. You may need to select it again after closing these job details.");
        }
      } else {
        const options = { mode: "readwrite" } as const;
        if (await directoryRoot.queryPermission(options) !== "granted" && await directoryRoot.requestPermission(options) !== "granted") {
          setMessage("Folder access was not granted. Allow access on your next export, or choose Change export folder.");
          return;
        }
      }
      if (changeFolder) { setMessage("Export folder updated. Click Export JD to folder to save this job."); return; }
      const folder = exportFolder(job);
      const directory = await directoryRoot.getDirectoryHandle(folder, { create: true });
      const file = await directory.getFileHandle("jd.txt", { create: true });
      const stream = await file.createWritable();
      try { await stream.write(exportText(job)); await stream.close(); }
      catch (error) { await stream.abort().catch(() => {}); throw error; }
      setMessage("Saved in " + directoryRoot.name + "\\" + folder + "\\jd.txt");
    } catch (e) {
      if ((e as Error).name === "NotFoundError") setMessage("The export folder could not be found. Choose Change export folder to select D:\\jobbid again.");
      else if ((e as Error).name !== "AbortError") setMessage((e as Error).message || "Could not write the export. Check folder permissions.");
    } finally { setBusy(false); }
  }
  return <div className="export-control">
    <button className="btn" disabled={loading || busy} onClick={() => void save()}><ArrowDownToLine size={15} />{busy ? "Exporting…" : "Export JD to folder"}</button>
    {root && <><small>Export folder: {root.name}.</small><button className="btn" disabled={loading || busy} onClick={() => void save(true)}>Change export folder</button></>}
    <small>{root ? "Exports reuse this folder. Your browser may ask you to allow access again." : "Select D:\\jobbid once; future exports will reuse it in this browser."} Re-exporting this job replaces its jd.txt.</small>
    {storageWarning && <p role="status" className="export-message">{storageWarning}</p>}
    {message && <p role="status" className="export-message">{message}</p>}
  </div>;
}

