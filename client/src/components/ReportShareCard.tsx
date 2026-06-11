// 결산 공유 카드 (#23·#45) — 주간/월간 결산의 단일 카드 마크업. cardSkin 테마·스티커를 소비한다.
// Wrapped(이벤트 스토리)와 ShareCardSheet(서재 직행 동선)가 같은 카드를 쓴다 — 단일 출처.
// 캡처 안전: 인라인 hex/SVG만 (CSS 변수·외부 이미지 금지).
import { fmt } from "@/lib/ledger";
import {
  type CardTheme, type StickerId,
  CrownSticker, JarSticker, WonScatter, SealStamp,
} from "@/components/cardSkin";

export default function ReportShareCard({
  theme,
  stickers,
  label,
  period,
  amount,
  subline,
  topSource,
  comment,
  quote,
}: {
  theme: CardTheme;
  stickers: StickerId[];
  label: string;        // 예: "거지로그 주간 결산"
  period: string;       // 예: "06.08 – 06.11"
  amount: number;       // +수익 합계
  subline?: string;     // 예: "5끼 기록 · 최고의 한 수 학식"
  topSource?: { name: string; profit: number } | null;
  comment: string;      // 회시생 평
  quote?: string;       // 도사 어록 (없으면 생략)
}) {
  const has = (id: StickerId) => stickers.includes(id);
  return (
    <div className="mx-auto w-full" style={{ maxWidth: "320px", position: "relative", overflow: "hidden", backgroundColor: theme.bg, padding: "22px 20px", borderRadius: "16px", border: `1px solid ${theme.border}` }}>
      {has("won") && <WonScatter accent={theme.accent} />}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", position: "relative" }}>
        <div style={{ fontSize: "9px", letterSpacing: "3px", color: theme.label, textTransform: "uppercase", textAlign: "left" }}>{label}</div>
        {has("crown") && <div style={{ marginTop: "-3px" }}><CrownSticker /></div>}
      </div>
      <div style={{ fontSize: "11px", color: theme.sub, textAlign: "left", fontFamily: "'JetBrains Mono', ui-monospace, monospace", position: "relative" }}>{period}</div>
      {/* C1 — 숫자에 의미 라벨: 맥락 없는 제3자가 "무슨 돈인지" 즉시 알게 */}
      <div style={{ fontSize: "10px", color: theme.label, textAlign: "left", marginTop: "12px", letterSpacing: "1px", position: "relative" }}>아껴서 번 돈</div>
      <div style={{ fontSize: "34px", fontWeight: 800, color: theme.accent, fontFamily: "'JetBrains Mono', ui-monospace, monospace", textAlign: "left", marginTop: "2px", position: "relative" }}>+₩{fmt(amount)}</div>
      {subline && (
        <div style={{ fontSize: "11px", color: theme.sub, textAlign: "left", marginTop: "2px", position: "relative" }}>{subline}</div>
      )}
      {topSource && (
        <div style={{ fontSize: "11px", color: theme.sub, textAlign: "left", marginTop: "4px", position: "relative" }}>
          주력 수익원 <span style={{ color: theme.accent, fontWeight: 600 }}>{topSource.name}</span> <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>+₩{fmt(topSource.profit)}</span>
        </div>
      )}
      <div style={{ borderTop: `1px solid ${theme.divider}`, margin: "14px 0", position: "relative" }} />
      <div style={{ fontSize: "12px", color: theme.title, textAlign: "left", lineHeight: 1.6, position: "relative" }}>{comment}</div>
      {quote && (
        <div style={{ fontSize: "11px", color: theme.sub, textAlign: "left", marginTop: "10px", fontStyle: "italic", lineHeight: 1.6, position: "relative" }}>“{quote}” — 무일푼 도사</div>
      )}
      <div style={{ position: "relative", marginTop: "14px", minHeight: "16px" }}>
        <div style={{ textAlign: "center", paddingTop: "4px" }}>
          <span style={{ fontSize: "8px", color: theme.footer, letterSpacing: "2px" }}>GEOJILOG</span>
          <span style={{ fontSize: "9px", color: theme.footer, display: "block", marginTop: "2px" }}>거지로그 — 절약을 수익으로 적는 가계부</span>
        </div>
        {has("seal") && (
          <div style={{ position: "absolute", left: "0px", bottom: "-4px" }}>
            <SealStamp accent={theme.accent} />
          </div>
        )}
        {has("jar") && (
          <div style={{ position: "absolute", right: "0px", bottom: "-6px" }}>
            <JarSticker size={28} />
          </div>
        )}
      </div>
    </div>
  );
}
