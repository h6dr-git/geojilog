// 앱 톤에 맞는 확인 다이얼로그 — window.confirm() 대체 (삭제 등 파괴적 액션 확인)
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "삭제",
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // 호출부에서 toast 처리 — 다이얼로그는 열어둬 재시도 가능
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-8"
      style={{ animation: "cdFade .15s ease" }}
      onClick={busy ? undefined : onCancel}
    >
      <style>{`@keyframes cdFade{from{opacity:0}to{opacity:1}}@keyframes cdPop{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>
      <div
        className="w-full max-w-xs surface-elevated p-5"
        style={{ animation: "cdPop .18s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title font-semibold text-ink">{title}</p>
        {description && <p className="text-caption text-ink-soft mt-1.5 leading-relaxed">{description}</p>}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 text-body text-ink-soft border border-line rounded-xl active:bg-cream transition-colors disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={
              danger
                ? "flex-1 py-2.5 text-body font-medium text-white rounded-xl bg-red-500 active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-1.5"
                : "flex-1 btn-primary py-2.5 text-body disabled:opacity-60 flex items-center justify-center gap-1.5"
            }
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
