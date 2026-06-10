// 주간 결산 Wrapped — 김집사의 주간 보고를 스토리 형식(4스텝)으로. (바이블 §6 '주간 결산: Wrapped식')
// +수익 → 최고의 한 수 → 김집사 평 → 도사 한 줄 + 공유 카드(이미지 저장).
// 좌/우 탭으로 이동, 상단 프로그레스 바. 사적 화면이라 숫자 노출 OK.
import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronRight, Download, Loader2 } from "lucide-react";
import Jarureu from "@/components/Jarureu";
import { SavingsEntry, fmt } from "@/lib/ledger";
import { butlerWeeklyComment, dosaLineOfDay } from "@/lib/voice";

const STEPS = 4;

function weekRange(): { start: string; end: string } {
  const e = new Date();
  e.setHours(0, 0, 0, 0);
  const s = new Date(e);
  s.setDate(s.getDate() - 6);
  const f = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: f(s), end: f(e) };
}
const mmdd = (iso: string) => iso.slice(5).replace("-", ".");

export default function WeeklyWrapped({
  entries,
  onClose,
  onGoDetail,
}: {
  entries: SavingsEntry[];
  onClose: () => void;
  onGoDetail: () => void;
}) {
  const [step, setStep] = useState(0);
  const [n, setN] = useState(0);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { start, end } = useMemo(weekRange, []);
  const week = useMemo(
    () => entries.filter((e) => e.date >= start && e.date <= end),
    [entries, start, end]
  );
  const profit = useMemo(() => week.reduce((s, e) => s + e.profit, 0), [week]);
  const best = useMemo(
    () => (week.length ? week.reduce((a, b) => (b.profit > a.profit ? b : a)) : null),
    [week]
  );
  const topCat = useMemo(() => {
    const m: Record<string, number> = {};
    week.forEach((e) => { m[e.category] = (m[e.category] ?? 0) + e.profit; });
    const arr = Object.entries(m).sort((a, b) => b[1] - a[1]);
    return arr[0]?.[0] ?? null;
  }, [week]);
  const butler = useMemo(() => butlerWeeklyComment(week.length, profit), [week.length, profit]);
  const dosa = useMemo(dosaLineOfDay, []);

  // 스텝 0 진입 시 +₩ 카운트업
  useEffect(() => {
    if (step !== 0) return;
    setN(0);
    const dur = 1000;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e2 = 1 - Math.pow(1 - p, 3);
      setN(Math.round(profit * e2));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, profit]);

  const next = () => setStep((v) => Math.min(STEPS - 1, v + 1));
  const prev = () => setStep((v) => Math.max(0, v - 1));

  const handleSaveCard = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      try {
        if (document.fonts) {
          await document.fonts.ready;
          await document.fonts.load("700 20px Pretendard").catch(() => {});
        }
      } catch { /* 폰트 API 미지원 시 무시 */ }
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#16201A", logging: false,
      });
      const a = document.createElement("a");
      a.download = `geojilog_week_${start}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch { /* 캡처 실패 시 조용히 무시 */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "#16201A", animation: "wwFade .25s ease" }}>
      <style>{`
        @keyframes wwFade{from{opacity:0}to{opacity:1}}
        @keyframes wwRise{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* 프로그레스 바 + 닫기 */}
      <div className="flex items-center gap-1.5 px-4 pt-4 max-w-lg w-full mx-auto">
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.14)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ background: "#E0A92E", width: i < step ? "100%" : i === step ? "100%" : "0%", opacity: i === step ? 1 : i < step ? 0.55 : 0 }}
            />
          </div>
        ))}
        <button onClick={onClose} aria-label="닫기" className="ml-2 w-8 h-8 flex items-center justify-center" style={{ color: "#7E8C82" }}>
          <X size={18} />
        </button>
      </div>

      {/* 좌/우 탭 존 */}
      <div className="absolute inset-y-16 left-0 w-1/3" onClick={prev} aria-hidden="true" />
      <div className="absolute inset-y-16 right-0 w-2/3" onClick={step < STEPS - 1 ? next : undefined} aria-hidden="true" />

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-lg w-full mx-auto pointer-events-none">
        {step === 0 && (
          <div key={0} style={{ animation: "wwRise .4s ease both" }}>
            <p className="text-micro tracking-[0.3em] font-mono mb-2" style={{ color: "#7E8C82" }}>WEEKLY REPORT</p>
            <p className="text-body" style={{ color: "#d8cfae" }}>김집사의 주간 결산</p>
            <p className="text-caption mt-1 font-mono" style={{ color: "#5E6A60" }}>{mmdd(start)} – {mmdd(end)}</p>
            <p className="mt-8 text-micro" style={{ color: "#7E8C82" }}>이번 주 지켜낸 돈</p>
            <p className="font-mono font-extrabold tabular-nums leading-none mt-2" style={{ fontSize: "52px", color: "#34d399" }}>
              +₩{n.toLocaleString("ko-KR")}
            </p>
            <p className="mt-5 text-caption" style={{ color: "#9aa89e" }}>{week.length}끼를 지켜냈습니다</p>
          </div>
        )}

        {step === 1 && (
          <div key={1} style={{ animation: "wwRise .4s ease both" }}>
            <p className="text-micro tracking-[0.3em] font-mono mb-6" style={{ color: "#7E8C82" }}>BEST MOVE</p>
            <p className="text-body mb-5" style={{ color: "#d8cfae" }}>이번 주 최고의 한 수</p>
            {best ? (
              <>
                {best.imageUrl ? (
                  <img src={best.imageUrl} alt="" className="w-44 h-44 rounded-2xl object-cover mx-auto" style={{ border: "2px solid rgba(224,169,46,0.4)" }} />
                ) : (
                  <div className="w-44 h-44 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Jarureu level={0.8} size={96} />
                  </div>
                )}
                <p className="mt-4 text-title font-semibold" style={{ color: "#F4EFE3" }}>{best.title}</p>
                <p className="mt-1 font-mono font-bold text-hero tabular-nums" style={{ color: "#34d399" }}>+₩{fmt(best.profit)}</p>
                <p className="mt-1 text-caption font-mono" style={{ color: "#5E6A60" }}>{mmdd(best.date)}</p>
              </>
            ) : (
              <p className="text-body" style={{ color: "#9aa89e" }}>이번 주 기록이 없어요</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div key={2} style={{ animation: "wwRise .4s ease both" }}>
            <p className="text-micro tracking-[0.3em] font-mono mb-6" style={{ color: "#7E8C82" }}>BUTLER'S NOTE</p>
            <span className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-body font-medium mb-5" style={{ background: "#eadfc6", color: "#a9863f" }}>집</span>
            <p className="text-title leading-relaxed max-w-[19rem]" style={{ color: "#F4EFE3" }}>{butler}</p>
            <div className="mt-8 space-y-1.5">
              <p className="text-caption" style={{ color: "#9aa89e" }}>기록 {week.length}건</p>
              {topCat && <p className="text-caption" style={{ color: "#9aa89e" }}>가장 많이 지킨 곳 — {topCat}</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div key={3} className="w-full pointer-events-auto" style={{ animation: "wwRise .4s ease both" }}>
            {/* 공유 카드 (캡처 대상) */}
            <div ref={cardRef} className="mx-auto" style={{ maxWidth: "320px", backgroundColor: "#16201A", padding: "22px 20px", borderRadius: "16px", border: "1px solid rgba(224,169,46,0.25)" }}>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#7E8C82", textTransform: "uppercase", marginBottom: "4px", textAlign: "left" }}>거지로그 주간 결산</div>
              <div style={{ fontSize: "11px", color: "#5E6A60", textAlign: "left", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{mmdd(start)} – {mmdd(end)}</div>
              <div style={{ fontSize: "34px", fontWeight: 800, color: "#10B981", fontFamily: "'JetBrains Mono', ui-monospace, monospace", textAlign: "left", marginTop: "10px" }}>+₩{fmt(profit)}</div>
              <div style={{ fontSize: "11px", color: "#9aa89e", textAlign: "left", marginTop: "2px" }}>{week.length}끼 지켜냄{best ? ` · 최고의 한 수 ${best.title}` : ""}</div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "14px 0" }} />
              <div style={{ fontSize: "12px", color: "#d8cfae", textAlign: "left", lineHeight: 1.6 }}>{butler}</div>
              <div style={{ fontSize: "11px", color: "#8C7B5A", textAlign: "left", marginTop: "10px", fontStyle: "italic", lineHeight: 1.6 }}>“{dosa}” — 무일푼 도사</div>
              <div style={{ textAlign: "center", fontSize: "8px", color: "#5E6A60", letterSpacing: "2px", marginTop: "14px" }}>GEOJILOG</div>
            </div>

            <div className="flex gap-2 mt-5 max-w-[320px] mx-auto">
              <button
                onClick={handleSaveCard}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-body font-medium active:scale-[0.98] transition-transform"
                style={{ background: "#E0A92E", color: "#16201A" }}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                이미지로 저장
              </button>
              <button
                onClick={onGoDetail}
                className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-caption active:scale-[0.98] transition-transform"
                style={{ background: "rgba(255,255,255,0.08)", color: "#d8cfae" }}
              >
                장부에서 보기 <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="pb-6 text-center text-micro" style={{ color: "#5E6A60" }}>
        {step < STEPS - 1 ? "탭해서 다음" : " "}
      </p>
    </div>
  );
}
