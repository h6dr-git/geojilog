// 앱 톤에 맞는 확인 다이얼로그 — window.confirm() 대체 (삭제 등 파괴적 액션 확인)
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
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-8"
      style={{ animation: "cdFade .15s ease" }}
      onClick={onCancel}
    >
      <style>{`@keyframes cdFade{from{opacity:0}to{opacity:1}}@keyframes cdPop{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>
      <div
        className="w-full max-w-xs bg-white rounded-card p-5 shadow-xl"
        style={{ animation: "cdPop .18s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title font-semibold text-ink">{title}</p>
        {description && <p className="text-caption text-ink-soft mt-1.5 leading-relaxed">{description}</p>}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-body text-ink-soft border border-line rounded-xl active:bg-cream transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-body font-medium text-white rounded-xl active:scale-[0.98] transition-transform ${
              danger ? "bg-red-500" : "bg-emerald-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
