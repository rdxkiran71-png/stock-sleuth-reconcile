import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions } from "@/lib/store";
import type { StockItem } from "@/lib/stock";

export function ItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: StockItem | null;
}) {
  const [description, setDescription] = useState("");
  const [inHand, setInHand] = useState("");
  const [rate, setRate] = useState("");
  const [computer, setComputer] = useState("");

  useEffect(() => {
    if (open) {
      setDescription(item?.description ?? "");
      setInHand(item?.inHand != null ? String(item.inHand) : "");
      setRate(item ? String(item.rate) : "");
      setComputer(item ? String(item.computer) : "");
    }
  }, [open, item]);

  const save = () => {
    const d = description.trim().toUpperCase();
    const c = Number(computer);
    const r = Number(rate);
    if (!d) { toast.error("Please enter the item description."); return; }
    if (!Number.isFinite(c) || c < 0) { toast.error("Computer quantity must be 0 or more."); return; }
    if (!Number.isFinite(r) || r < 0) { toast.error("Rate must be 0 or more."); return; }
    const h = inHand.trim() === "" ? null : Number(inHand);
    if (h !== null && (!Number.isInteger(h) || h < 0))
      { toast.error("In-hand quantity must be 0 or more."); return; }
    if (item) {
      actions.updateItem(item.id, { description: d, computer: c, rate: r });
      toast.success("Item updated");
    } else {
      actions.addItem({ description: d, inHand: h, rate: r, computer: c });
      toast.success("Item added");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{item ? "Edit item" : "Add new item"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="comp">Computer qty</Label>
              <Input id="comp" type="number" min={0} value={computer} onChange={(e) => setComputer(e.target.value)} />
            </div>
            {!item && (
              <div className="grid gap-1.5">
                <Label htmlFor="inhand">In hand qty</Label>
                <Input id="inhand" type="number" min={0} value={inHand} onChange={(e) => setInHand(e.target.value)} placeholder="—" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="rate">Cost rate (Rs)</Label>
              <Input id="rate" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {item ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${item.description}" and its sales?`)) {
                    actions.deleteItem(item.id);
                    toast.success("Item deleted");
                    onOpenChange(false);
                  }
                }}
              >
                Delete item
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit">{item ? "Save changes" : "Add item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
