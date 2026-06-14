// #58 — 업무 지시 시트. 세계관: 사장님(사용자)이 회시생에게 서면 지시를 내린다 = 베타 피드백 창구.
// 지시는 /ops 계기판 인박스로 흘러가고, 반영되면 회신한다(close the loop — 충성도의 핵).
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Send, Loader2 } from "lucide-react";

export default function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success("지시 접수 — 검토 후 보고드리겠습니다.");
      onClose();
    },
    onError: (e) => toast.error(e.message || "접수에 실패했습니다"),
  });
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg sheet-panel px-5 pt-3 pb-8"
        style={{ animation: "fbUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes fbUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div className="flex items-center justify-between mb-1">
          <div className="w-8" />
          <div className="text-center">
            <p className="text-body font-semibold text-ink">업무 지시</p>
            <p className="voice-label mt-0.5">회시생에게</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>
        <p className="text-micro text-ink-faint text-center mb-4">
          불편한 것, 바라는 것, 이상한 것 — 무엇이든 적어 내리십시오. 회시생이 접수합니다.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={5}
          placeholder="예) 사진 올릴 때 ○○가 불편합니다 / ○○ 기능이 있으면 좋겠습니다"
          className="w-full input-field resize-none py-3"
        />
        <div className="flex items-center justify-between mt-1 mb-3">
          <span className="text-micro text-ink-faint">{text.length}/500</span>
        </div>
        <button
          onClick={() => text.trim().length >= 2 && submit.mutate({ text })}
          disabled={submit.isPending || text.trim().length < 2}
          className="w-full btn-primary py-3.5 rounded-2xl disabled:opacity-50"
        >
          {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          지시 내리기
        </button>
      </div>
    </div>
  );
}
