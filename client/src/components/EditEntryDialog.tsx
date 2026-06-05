// ============================================================
// 절약 수익 리포트 — 항목 수정 다이얼로그
// ============================================================

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const DEFAULT_CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화/여가", "기타"];
type Category = string;

interface EntryLike {
  id: number;
  date: string;
  title: string;
  description?: string | null;
  category: string;
  originalAmount: number;
  actualAmount: number;
}

interface Props {
  entry: EntryLike;
  onUpdate: (data: unknown) => void;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EditEntryDialog({ entry, onUpdate, defaultOpen = false, onOpenChange }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    date: entry.date,
    title: entry.title,
    description: entry.description ?? "",
    category: entry.category as Category,
    originalAmount: String(entry.originalAmount),
    actualAmount: String(entry.actualAmount),
  });

  const { data: categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: open });
  const availableCategories = categories.length > 0 ? categories.map(c => c.name) : DEFAULT_CATEGORIES;

  const utils = trpc.useUtils();
  const updateEntry = trpc.savings.update.useMutation({
    onSuccess: () => {
      utils.savings.list.invalidate();
      onUpdate({});
      setDone(true);
      setTimeout(() => { setDone(false); setOpen(false); }, 800);
    },
    onError: () => toast.error("수정에 실패했습니다"),
  });

  const profit = form.originalAmount && form.actualAmount
    ? Number(form.originalAmount) - Number(form.actualAmount) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.originalAmount || !form.actualAmount) return;
    updateEntry.mutate({
      id: entry.id,
      date: form.date,
      title: form.title,
      description: form.description || undefined,
      category: form.category,
      originalAmount: Number(form.originalAmount),
      actualAmount: Number(form.actualAmount),
    });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
    if (v) {
      setForm({
        date: entry.date,
        title: entry.title,
        description: entry.description ?? "",
        category: entry.category as Category,
        originalAmount: String(entry.originalAmount),
        actualAmount: String(entry.actualAmount),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
        >
          <Pencil size={13} />
        </Button>
      </DialogTrigger>
      <DialogContent className="font-mono max-w-sm rounded-md" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <DialogHeader>
          <DialogTitle className="text-[11px] tracking-[0.15em] uppercase font-mono font-bold">
            항목 수정
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground">수정할 내용을 변경하고 저장하세요</p>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="font-mono text-[10px] text-emerald-600 tracking-widest uppercase">수정 완료</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-mono">날짜</Label>
                <Input type="date" value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className="font-mono text-xs rounded h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-mono">카테고리</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v as Category }))}>
                  <SelectTrigger className="font-mono text-xs rounded h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c: string) => <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-mono">항목명</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="font-mono text-xs rounded h-8" />
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-mono">
                메모 <span className="text-muted-foreground/50 normal-case tracking-normal">(선택)</span>
              </Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="font-mono text-xs rounded h-8" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-mono">기준가</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">₩</span>
                  <Input type="number" value={form.originalAmount}
                    onChange={(e) => setForm(f => ({ ...f, originalAmount: e.target.value }))}
                    className="font-mono text-xs pl-6 rounded h-8" min={0} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-mono">실제 지출</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">₩</span>
                  <Input type="number" value={form.actualAmount}
                    onChange={(e) => setForm(f => ({ ...f, actualAmount: e.target.value }))}
                    className="font-mono text-xs pl-6 rounded h-8" min={0} />
                </div>
              </div>
            </div>

            {profit !== null && (
              <div className={`rounded border p-2.5 flex items-center justify-between ${
                profit > 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
              }`}>
                <span className={`font-mono text-[9px] uppercase tracking-wider ${profit > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  절약 수익
                </span>
                <span className={`font-mono text-sm font-bold ${profit > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {profit > 0 ? "▲" : "▼"} ₩{Math.abs(profit).toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 font-mono text-[10px] rounded h-9"
                onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" className="flex-1 font-mono text-[10px] rounded h-9"
                disabled={!form.title || !form.originalAmount || !form.actualAmount || updateEntry.isPending}>
                {updateEntry.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
