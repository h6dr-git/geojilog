// 설치 안내 시트 (#40) — iOS는 설치 API가 없어 단계 안내로. 앱 톤 유지(김집사 한 줄).
import { X, Share, SquarePlus, MoreVertical } from "lucide-react";
import { isIOS } from "@/lib/install";

export default function InstallGuideSheet({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  const steps = ios
    ? [
        { icon: <Share size={16} />, text: "사파리 하단의 공유 버튼을 누르세요" },
        { icon: <SquarePlus size={16} />, text: "'홈 화면에 추가'를 선택하세요" },
        { icon: null, text: "오른쪽 위 '추가' — 끝입니다" },
      ]
    : [
        { icon: <MoreVertical size={16} />, text: "브라우저 메뉴(⋮)를 여세요" },
        { icon: <SquarePlus size={16} />, text: "'앱 설치' 또는 '홈 화면에 추가'를 선택하세요" },
        { icon: null, text: "확인을 누르면 끝입니다" },
      ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      style={{ animation: "igFade .2s ease" }}
      onClick={onClose}
    >
      <style>{`@keyframes igUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes igFade{from{opacity:0}to{opacity:1}}`}</style>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-9"
        style={{ animation: "igUp .28s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">홈 화면에 추가</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>

        <p className="text-caption text-ink-soft text-center mb-5">
          홈 화면에 두면 앱처럼 열리고, 김집사의 저녁 보고(알림)도 받을 수 있습니다.
        </p>

        <div className="space-y-2.5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 bg-cream rounded-card px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-micro font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-body text-ink flex items-center gap-1.5">{s.icon}{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
