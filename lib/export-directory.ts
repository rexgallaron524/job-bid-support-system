// Browser-only folder preferences. Job data remains in PostgreSQL.
type WritableHandle = {
  write: (text: string) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};
export type ExportDirectory = {
  name: string;
  queryPermission: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<ExportDirectory>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<{ createWritable: () => Promise<WritableHandle> }>;
};

// FileSystemDirectoryHandle is structured-cloneable in IndexedDB, unlike localStorage.
function folderPreference(account: string, directory?: ExportDirectory): Promise<ExportDirectory | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("job-support-local", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("export-folders"); };
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("Browser folder storage is unavailable."));
    open.onsuccess = () => {
      const db = open.result;
      try {
        const transaction = db.transaction("export-folders", directory ? "readwrite" : "readonly");
        const store = transaction.objectStore("export-folders");
        const request = directory ? store.put(directory, account) : store.get(account);
        transaction.oncomplete = () => { db.close(); resolve(directory ?? request.result); };
        transaction.onabort = () => { db.close(); reject(transaction.error ?? request.error); };
      } catch (error) { db.close(); reject(error); }
    };
  });
}

export function loadExportDirectory(account: string) { return folderPreference(account); }
export async function rememberExportDirectory(account: string, directory: ExportDirectory) {
  await folderPreference(account, directory);
}
