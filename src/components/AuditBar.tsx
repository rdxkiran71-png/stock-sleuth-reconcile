import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cloud, CloudOff, FolderOpen, FolderPlus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAudit,
  deleteAudit,
  listAudits,
  renameAudit,
  type AuditFolder,
} from "@/lib/audits";
import { actions, useAppState } from "@/lib/store";

/** Audit folder picker shown in the app header: open, create, rename, delete online audits. */
export function AuditBar() {
  const { auditId, auditName, meta, syncError } = useAppState();
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<AuditFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<AuditFolder | null>(null);
  const [renameTo, setRenameTo] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      setFolders(await listAudits());
    } catch {
      toast.error("Audit folders load nahi ho sake. Internet check karein.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const folder = await createAudit(name, meta);
      actions.setAudit(folder.id, folder.name);
      await actions.saveToCloud();
      toast.success(`"${name}" audit ban gayi aur entries online save ho gayi hain`);
      setNewName("");
      void refresh();
    } catch {
      toast.error("Audit folder nahi ban saka. Dobara koshish karein.");
    }
  };

  const onOpen = (f: AuditFolder) => {
    if (f.id === auditId) {
      setOpen(false);
      return;
    }
    if (!confirm(`"${f.name}" kholein? Abhi ki entries is audit ki entries se badal jayengi.`)) return;
    actions.openAudit(f.id);
    setOpen(false);
  };

  const onRename = async () => {
    if (!renaming) return;
    const name = renameTo.trim();
    if (!name) return;
    try {
      await renameAudit(renaming.id, name);
      if (renaming.id === auditId) actions.setAudit(renaming.id, name);
      toast.success("Naam badal gaya");
      setRenaming(null);
      void refresh();
    } catch {
      toast.error("Naam nahi badal saka.");
    }
  };

  const onDelete = async (f: AuditFolder) => {
    if (!confirm(`"${f.name}" audit delete karein? Is ki tamam entries aur sales bhi delete ho jayengi.`)) return;
    if (!confirm("Pakka sure hain? Delete ke baad yeh audit wapas nahi aa sakti.")) return;
    try {
      await deleteAudit(f.id);
      if (f.id === auditId) actions.setAudit(null, null);
      toast.success("Audit delete ho gayi");
      void refresh();
    } catch {
      toast.error("Audit delete nahi ho saki.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-ink-foreground/25 px-2.5 py-1 text-xs transition hover:bg-ink-foreground/10"
        title="Online audit folders"
      >
        {syncError ? <CloudOff className="size-3.5 text-short" /> : <Cloud className="size-3.5" />}
        <span className="max-w-36 truncate font-medium">{auditName ?? "Koi audit nahi"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Online audit folders</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Har audit website par save hoti hai. Link share karein to doosre bhi yahi entries dekh aur edit kar
            sakte hain.
          </p>

          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nayi audit ka naam, e.g. 6 Nov counting"
              onKeyDown={(e) => e.key === "Enter" && void onCreate()}
            />
            <Button size="sm" onClick={() => void onCreate()} disabled={!newName.trim()}>
              <FolderPlus /> Banayein
            </Button>
          </div>

          <div className="max-h-72 overflow-auto rounded-md border border-border">
            {loading && <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>}
            {!loading && folders.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Abhi koi audit nahi. Upar naam likh kar pehli audit banayein.
              </p>
            )}
            {folders.map((f) => (
              <div
                key={f.id}
                className={`flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-0 ${
                  f.id === auditId ? "bg-secondary" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(f)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <FolderOpen className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {f.name}
                      {f.id === auditId && <span className="ml-1 text-xs text-primary">(khuli hui)</span>}
                    </span>
                    <span className="num block text-xs text-muted-foreground">
                      {new Date(f.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  title="Rename"
                  onClick={() => {
                    setRenaming(f);
                    setRenameTo(f.name);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => void onDelete(f)}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw /> Refresh
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Audit ka naam badlein</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onRename()}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void onRename()} disabled={!renameTo.trim()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
