// 캡처 뷰 — '이미지로 저장(파일 생성)' 대신, UI를 전부 숨긴 전체화면을 띄워
// 사용자가 폰 스크린샷으로 직접 캡처한다. (SSOT §2: 인앱 보관 + 캡처 기반 공유)
// 힌트 문구는 2.2초 뒤 사라져서 스크린샷에 찍히지 않는다. 탭하면 닫힘.
import { useEffect, useState, type ReactNode } from "react";

export default function CaptureView({
  bg,
  onClose,
  children,
}: {
  bg: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 2400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-6"
      style={{ background: bg, animation: "cvFade .2s ease" }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-label="캡처 화면"
    >
      <style>{`
        @keyframes cvFade{from{opacity:0}to{opacity:1}}
        @keyframes cvHint{0%{opacity:0}12%{opacity:1}78%{opacity:1}100%{opacity:0}}
      `}</style>
      <div className="w-full flex justify-center">{children}</div>
      {hint && (
        <p
          className="fixed bottom-8 left-0 right-0 text-center text-caption pointer-events-none"
          style={{ color: "rgba(255,255,255,0.55)", animation: "cvHint 2.4s ease forwards" }}
        >
          스크린샷으로 캡처하세요 · 탭하면 닫기
        </p>
      )}
    </div>
  );
}
