// 리빌 연출 — 저장 성공 순간의 도파민. (바이블 §2: 핵심 루프의 도파민 = "+₩ 지켜냄" 리프레임)
// 다크그린 무대 + 자르르 + 카운트업 +₩ + 김집사 보고 한 줄. 탭하거나 2.6초 뒤 자동으로 사라진다.
import { useEffect, useMemo, useRef, useState } from "react";
import Jarureu from "@/components/Jarureu";
import { onCelebrate, type RevealDetail } from "@/lib/celebrate";
import { butlerSaveLine } from "@/lib/voice";

const AUTO_CLOSE_MS = 2600;

export default function SaveReveal() {
  const [detail, setDetail] = useState<RevealDetail | null>(null);
  const [n, setN] = useState(0);
  const closeTimer = useRef<number | undefined>(undefined);

  // 저장 이벤트 구독
  useEffect(() => onCelebrate((d) => setDetail(d)), []);

  // 자동 닫기
  useEffect(() => {
    if (!detail) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDetail(null), AUTO_CLOSE_MS);
    return () => window.clearTimeout(closeTimer.current);
  }, [detail]);

  // +₩ 카운트업 (ease-out)
  useEffect(() => {
    if (!detail) return;
    setN(0);
    const dur = 900;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(detail.profit * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [detail]);

  const butlerLine = useMemo(() => (detail ? butlerSaveLine(detail.profit) : ""), [detail]);

  if (!detail) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "rgba(22,32,26,0.96)", animation: "rvFade .22s ease" }}
      onClick={() => setDetail(null)}
      role="status"
    >
      <style>{`
        @keyframes rvFade{from{opacity:0}to{opacity:1}}
        @keyframes rvPop{0%{opacity:0;transform:scale(.8)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
        @keyframes rvRise{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes rvWon{0%{opacity:0;transform:translateY(10px) scale(.6) rotate(var(--rot))}25%{opacity:.85}100%{opacity:0;transform:translateY(-72px) scale(1.05) rotate(var(--rot))}}
        @keyframes rvBar{from{width:100%}to{width:0%}}
        .rv-won{position:absolute;font-family:'JetBrains Mono',ui-monospace,monospace;color:#f2c94c;animation:rvWon 1.6s ease-out forwards;pointer-events:none}
      `}</style>

      {/* 금빛 ₩ 입자 — 자르르에게 쏟아진다 */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {[
          { l: "32%", t: "52%", d: "0s", s: "15px", r: "-12deg" },
          { l: "62%", t: "48%", d: ".15s", s: "13px", r: "10deg" },
          { l: "45%", t: "58%", d: ".3s", s: "18px", r: "-6deg" },
          { l: "70%", t: "56%", d: ".45s", s: "12px", r: "14deg" },
          { l: "28%", t: "44%", d: ".55s", s: "12px", r: "8deg" },
          { l: "54%", t: "42%", d: ".7s", s: "15px", r: "-10deg" },
        ].map((p, i) => (
          <span
            key={i}
            className="rv-won"
            style={{ left: p.l, top: p.t, fontSize: p.s, animationDelay: p.d, ["--rot" as string]: p.r }}
          >
            ₩
          </span>
        ))}
      </div>

      <div style={{ animation: "rvPop .4s cubic-bezier(.2,.8,.2,1) both" }}>
        <Jarureu level={0.86} size={104} />
      </div>

      <p className="mt-5 text-micro tracking-[0.3em] font-mono" style={{ color: "#7E8C82", animation: "rvRise .35s ease .1s both" }}>
        PROFIT RECOGNIZED
      </p>

      <p
        className="mt-2 font-mono font-extrabold tabular-nums leading-none"
        style={{ fontSize: "44px", color: "#34d399", animation: "rvRise .35s ease .16s both" }}
      >
        +₩{n.toLocaleString("ko-KR")}
      </p>

      {detail.title && (
        <p className="mt-4 text-caption" style={{ color: "#9aa89e", animation: "rvRise .35s ease .28s both" }}>
          {detail.title}
        </p>
      )}

      {/* #37 — 평소(단골 사전 평소가)보다 더 아낀 날 */}
      {detail.bonus != null && detail.bonus > 0 && (
        <p className="mt-1.5 text-caption font-medium" style={{ color: "#E0A92E", animation: "rvRise .35s ease .31s both" }}>
          ✨ 평소보다 ₩{detail.bonus.toLocaleString("ko-KR")} 더 아꼈어요
        </p>
      )}

      <p className="mt-1.5 text-body leading-relaxed max-w-[17rem]" style={{ color: "#d8cfae", animation: "rvRise .35s ease .34s both" }}>
        {butlerLine}
      </p>

      <p className="absolute bottom-8 text-micro" style={{ color: "#5E6A60" }}>탭해서 닫기</p>

      {/* #39 — 자동으로 닫히기까지 남은 시간 표시 */}
      <span
        key={detail.title ?? String(detail.profit)}
        className="absolute bottom-0 left-0 h-0.5"
        style={{ background: "rgba(52,211,153,0.7)", animation: `rvBar ${AUTO_CLOSE_MS}ms linear forwards` }}
        aria-hidden="true"
      />
    </div>
  );
}
