// 설치 안내 시트 (#40 2차) — 브라우저별로 경로가 달라 차등 안내한다. 앱 톤 유지.
import { X, Share, SquarePlus, MoreVertical, Compass } from "lucide-react";
import { browserKind } from "@/lib/install";
import type { ReactNode } from "react";

type Step = { icon: ReactNode; text: string };

function stepsFor(): { label: string; steps: Step[]; note?: string } {
  switch (browserKind()) {
    case "ios-safari":
      return {
        label: "아이폰 · 사파리",
        steps: [
          { icon: <Share size={16} />, text: "하단 가운데 공유 버튼을 누르세요" },
          { icon: <SquarePlus size={16} />, text: "'홈 화면에 추가'를 선택하세요" },
          { icon: null, text: "오른쪽 위 '추가' — 끝입니다" },
        ],
      };
    case "ios-other":
      return {
        label: "아이폰 · 크롬 등",
        steps: [
          { icon: <Compass size={16} />, text: "아이폰은 사파리에서만 설치할 수 있어요" },
          { icon: <Share size={16} />, text: "이 주소를 사파리로 열어주세요" },
          { icon: <SquarePlus size={16} />, text: "사파리에서 공유 → '홈 화면에 추가'" },
        ],
        note: "주소를 길게 눌러 복사한 뒤 사파리에 붙여넣으면 빨라요",
      };
    case "android-samsung":
      return {
        label: "안드로이드 · 삼성 인터넷",
        steps: [
          { icon: <MoreVertical size={16} />, text: "하단 메뉴(≡)를 여세요" },
          { icon: <SquarePlus size={16} />, text: "'현재 페이지 추가' → '홈 화면'을 선택하세요" },
          { icon: null, text: "'추가'를 누르면 끝입니다" },
        ],
      };
    case "android-chrome":
    case "android-other":
      return {
        label: "안드로이드 · 크롬",
        steps: [
          { icon: <MoreVertical size={16} />, text: "오른쪽 위 메뉴(⋮)를 여세요" },
          { icon: <SquarePlus size={16} />, text: "'앱 설치' 또는 '홈 화면에 추가'를 선택하세요" },
          { icon: null, text: "확인을 누르면 끝입니다" },
        ],
      };
    default:
      return {
        label: "데스크톱",
        steps: [
          { icon: <SquarePlus size={16} />, text: "주소창 오른쪽의 설치 아이콘(⊕/모니터 모양)을 누르세요" },
          { icon: null, text: "'설치'를 누르면 앱처럼 열립니다" },
        ],
        note: "폰에서 쓰는 게 제일 편해요 — 폰 브라우저로 접속해 보세요",
      };
  }
}

export default function InstallGuideSheet({ onClose }: { onClose: () => void }) {
  const { label, steps, note } = stepsFor();

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
        <div className="flex items-center justify-between mb-1">
          <div className="w-8" />
          <span className="text-body font-medium text-ink">홈 화면에 추가</span>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center text-ink-soft">
            <X size={20} />
          </button>
        </div>
        <p className="text-micro text-gold text-center font-medium mb-1">{label} 기준 안내</p>
        <p className="text-caption text-ink-soft text-center mb-5">
          홈 화면에 두면 앱처럼 열리고, 회시생의 저녁 보고(알림)도 받을 수 있습니다.
        </p>

        <div className="space-y-2.5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 bg-cream rounded-card px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-micro font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-body text-ink flex items-center gap-1.5">{s.icon}{s.text}</span>
            </div>
          ))}
        </div>
        {note && <p className="text-micro text-ink-faint text-center mt-3">{note}</p>}
      </div>
    </div>
  );
}
