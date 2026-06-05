// ============================================================
// 카테고리 관리 다이얼로그
// ============================================================

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const COLOR_OPTIONS = [
  { name: "amber", label: "노랑", class: "bg-amber-400" },
  { name: "orange", label: "주황", class: "bg-orange-400" },
  { name: "blue", label: "파랑", class: "bg-blue-400" },
  { name: "purple", label: "보라", class: "bg-purple-400" },
  { name: "pink", label: "분홍", class: "bg-pink-400" },
  { name: "emerald", label: "초록", class: "bg-emerald-400" },
  { name: "red", label: "빨강", class: "bg-red-400" },
  { name: "gray", label: "회색", class: "bg-gray-400" },
];

export const COLOR_CLASS_MAP: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  gray: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function CategoryManager() {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: open });

  const createCat = trpc.categories.create.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setNewName(""); setNewColor("gray"); },
    onError: () => toast.error("추가 실패"),
  });
  const renameCat = trpc.categories.rename.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setEditingId(null); },
    onError: () => toast.error("수정 실패"),
  });
  const deleteCat = trpc.categories.delete.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
    onError: () => toast.error("삭제 실패"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors">
          <Settings2 size={10} /> 카테고리 관리
        </button>
      </DialogTrigger>
      <DialogContent className="font-mono max-w-sm rounded-md" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <DialogHeader>
          <DialogTitle className="text-[11px] tracking-[0.15em] uppercase font-mono font-bold">카테고리 관리</DialogTitle>
          <p className="text-[10px] text-muted-foreground">카테고리를 추가, 수정, 삭제할 수 있어요</p>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* 카테고리 목록 */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 p-2 rounded border border-border bg-card hover:bg-muted/30 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_OPTIONS.find(c => c.name === cat.color)?.class ?? "bg-gray-400"}`} />
                {editingId === cat.id ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input value={editingName} onChange={e => setEditingName(e.target.value)}
                      className="h-6 text-xs font-mono rounded flex-1" autoFocus
                      onKeyDown={e => { if (e.key === "Enter") renameCat.mutate({ id: cat.id, name: editingName }); }}
                    />
                    <button onClick={() => renameCat.mutate({ id: cat.id, name: editingName })}
                      className="text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <span className="font-mono text-xs flex-1">{cat.name}</span>
                    <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => deleteCat.mutate({ id: cat.id })}
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 새 카테고리 추가 */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">새 카테고리 추가</p>
            <div className="flex gap-2">
              <Input placeholder="카테고리 이름" value={newName} onChange={e => setNewName(e.target.value)}
                className="font-mono text-xs h-8 rounded flex-1"
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createCat.mutate({ name: newName.trim(), color: newColor }); }}
              />
              <Button size="sm" className="h-8 rounded gap-1 font-mono text-[10px]"
                disabled={!newName.trim() || createCat.isPending}
                onClick={() => createCat.mutate({ name: newName.trim(), color: newColor })}>
                <Plus size={12} /> 추가
              </Button>
            </div>
            {/* 색상 선택 */}
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button key={c.name} onClick={() => setNewColor(c.name)}
                  className={`w-5 h-5 rounded-full ${c.class} transition-transform ${newColor === c.name ? "ring-2 ring-offset-1 ring-foreground scale-110" : "hover:scale-105"}`}
                  title={c.label} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
