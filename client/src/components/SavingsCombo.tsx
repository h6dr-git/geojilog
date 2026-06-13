// #50 — 발라트로식 연쇄 절약 연출: 시중 기준가에서 수익원 할인이 단계별로 발동하며 '번 돈'이 쌓인다.
// 표시 전용. 단계 데이터는 상위(QuickRecord 등)에서 reconcile된 SavingsStep[]을 넘겨받는다.
// 연출은 마운트 시 1회만. 이후 금액/단계 편집은 즉시 반영(재생 안 함).
import { useEffect, useRef, useState } from "react";
import { won } from "@/lib/format";
import type { SavingsStep } from "@shared/incomeSources";

type Props = {
  originalAmount: number;
  steps: SavingsStep[];
  animate?: boolean;
};

export default function SavingsCombo({ originalAmount, steps, animate = true }: Props) {
  const total = steps.reduce((s, x) => s + (x.amount > 0 ? x.amount : 0), 0);
  const [shown, setShown] = useState(steps.length);
  const [profit, setProfit] = useState(total);
  const animatingRef = useRef(false);
  const didPlay = useRef(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!animate || steps.length === 0 || didPlay.current) {
      setShown(steps.length);
      setProfit(total);
      return;
    }
    didPlay.current = true;
    animatingRef.current = true;
    setShown(0);
    setProfit(0);
    let acc = 0;
    const timers: number[] = [];
    steps.forEach((st, i) => {
      timers.push(
        window.setTimeout(() => {
          setShown(i + 1);
          const from = acc;
          const to = acc + Math.max(0, st.amount);
          acc = to;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / 480);
            const e = 1 - Math.pow(1 - p, 3);
            setProfit(Math.round(from + (to - from) * e));
            if (p < 1) {
              raf.current = requestAnimationFrame(tick);
            } else if (i === steps.length - 1) {
              animatingRef.current = false;
            }
          };
          raf.current = requestAnimationFrame(tick);
        }, 320 + i * 620)
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
      setShown(steps.length);
      setProfit(total);
    }
  }, [steps.length, total]);

  const hasSteps = steps.length > 0 && total > 0;

  return (
    <div className="mb-4">
      {hasSteps && (
        <>
          <p className="text-micro text-ink-soft text-center mb-1.5">
            시중 기준가 <span className="font-mono tabular-nums">{won(originalAmount)}</span>
          </p>
          <div className="flex flex-col gap-1.5 mb-3">
            {steps.map((st, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-card px-3 py-2 bg-cream transition-all duration-300 ${
                  i < shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                }`}
              >
                <span className="text-caption text-ink-soft truncate mr-2">{st.label || st.source}</span>
                <span className="font-mono text-caption text-emerald-600 tabular-nums shrink-0">−{won(st.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="text-center">
        <p className="text-micro text-ink-soft mb-0.5">이번에 번 돈</p>
        <p className="font-mono text-hero font-bold tabular-nums text-emerald-500">
          +{won(hasSteps ? profit : total)}
        </p>
      </div>
    </div>
  );
}
