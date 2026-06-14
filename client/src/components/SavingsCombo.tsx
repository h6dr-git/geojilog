// #50 — 발라트로식 연쇄 절약 연출 (강화판): 시중 기준가에서 수익원 할인이 카드로 순차 발동하며 '번 돈'이 쌓인다.
// 표시 전용. 단계는 상위(QuickRecord)에서 reconcile된 SavingsStep[]을 받는다. 연출은 마운트 1회.
import { useEffect, useRef, useState } from "react";
import { won } from "@/lib/format";
import type { SavingsStep } from "@shared/incomeSources";
import { Coins, UtensilsCrossed, Home, HandHeart, Gift, Tag, Users, Ban, Sparkles } from "lucide-react";

const STEP_ICONS: Record<string, typeof Coins> = {
  "천원아침": Coins,
  "학식/구내": UtensilsCrossed,
  "집밥/해먹음": Home,
  "얻어먹음": HandHeart,
  "공짜/이벤트": Gift,
  "할인/쿠폰": Tag,
  "엔빵/공구": Users,
  "참음/대체": Ban,
};

type Props = {
  originalAmount: number;
  steps: SavingsStep[];
  animate?: boolean;
};

export default function SavingsCombo({ originalAmount, steps, animate = true }: Props) {
  const total = steps.reduce((s, x) => s + (x.amount > 0 ? x.amount : 0), 0);
  const [firedCount, setFiredCount] = useState(animate ? 0 : steps.length);
  const [profit, setProfit] = useState(animate ? 0 : total);
  const [punch, setPunch] = useState(false);
  const didPlay = useRef(false);
  const animatingRef = useRef(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!animate || steps.length === 0 || didPlay.current) {
      setFiredCount(steps.length);
      setProfit(total);
      return;
    }
    didPlay.current = true;
    animatingRef.current = true;
    setFiredCount(0);
    setProfit(0);
    let acc = 0;
    const timers: number[] = [];
    steps.forEach((st, i) => {
      timers.push(
        window.setTimeout(() => {
          setFiredCount(i + 1);
          setPunch(true);
          window.setTimeout(() => setPunch(false), 180);
          const from = acc;
          const to = acc + Math.max(0, st.amount);
          acc = to;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / 520);
            const e = 1 - Math.pow(1 - p, 3);
            setProfit(Math.round(from + (to - from) * e));
            if (p < 1) raf.current = requestAnimationFrame(tick);
            else if (i === steps.length - 1) animatingRef.current = false;
          };
          raf.current = requestAnimationFrame(tick);
        }, 360 + i * 680)
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!animatingRef.current) {
      setFiredCount(steps.length);
      setProfit(total);
    }
  }, [steps.length, total]);

  const hasSteps = steps.length > 0 && total > 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-1.5 mb-2.5">
        <span className="text-micro text-ink-soft">시중 기준가</span>
        <span className="font-mono text-caption text-ink tabular-nums">{won(originalAmount)}</span>
      </div>

      {hasSteps ? (
        <div className="flex flex-col gap-2 mb-3.5">
          {steps.map((st, i) => {
            const Icon = STEP_ICONS[st.source] ?? Sparkles;
            const fired = i < firedCount;
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 rounded-card border px-3 py-2.5 transition-all duration-300 ${
                  fired
                    ? "border-emerald-200 bg-emerald-50 translate-y-0 opacity-100 scale-100"
                    : "border-line bg-cream translate-y-2 opacity-0 scale-95"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors ${
                    fired ? "bg-emerald-100 text-emerald-600" : "bg-line text-ink-soft"
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-caption font-medium text-ink truncate">{st.label || st.source}</p>
                  {st.reason ? <p className="text-micro text-ink-faint truncate">{st.reason}</p> : null}
                </div>
                <span className="font-mono text-caption font-bold text-emerald-600 tabular-nums shrink-0">
                  −{won(st.amount)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-card border border-dashed border-line bg-cream px-3 py-3 mb-3.5">
          <p className="text-caption text-ink-soft">아직 잡힌 수익 단계가 없어요</p>
          <p className="text-micro text-ink-faint">수익원을 고르면 단계별로 쌓여요</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-micro text-ink-soft mb-0.5">이번 거래 수익</p>
        <p
          className={`profit-hero tabular-nums transition-transform duration-150 ${
            punch ? "scale-110" : "scale-100"
          }`}
        >
          +{won(hasSteps ? profit : total)}
        </p>
        {hasSteps ? (
          <p className="text-micro text-ink-faint mt-0.5">
            남은 실지출 <span className="font-mono tabular-nums">{won(originalAmount - total)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
