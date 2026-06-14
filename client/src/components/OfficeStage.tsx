// 집무실 IP 무대 — 쌀집이·비품 컬렉션·캐릭터 로스터. (유틸=장부 탭)
import type { ReactNode } from "react";
import SsalCalc from "@/components/SsalCalc";
import JarureuShelf from "@/components/JarureuShelf";
import SpeakerBadge from "@/components/SpeakerBadge";
import { OFFICE_CAST, officeTagline } from "@/lib/officeIp";
import { unlockedItems } from "@/components/JarureuShelf";

type Props = {
  tagline: string;
  calcSize?: number;
  level: number;
  analyzing: boolean;
  glow: boolean;
  display: string;
  onTapCalc: () => void;
  calcCaption: ReactNode;
  score: number;
  highlightKey?: string | null;
};

export default function OfficeStage({
  tagline,
  calcSize = 108,
  level,
  analyzing,
  glow,
  display,
  onTapCalc,
  calcCaption,
  score,
  highlightKey,
}: Props) {
  const propCount = unlockedItems(score).length;

  return (
    <div className="office-stage">
      <p className="office-tagline">{tagline || officeTagline(propCount)}</p>

      <div className="office-desk">
        <div className="office-calc-spot" onClick={onTapCalc}>
          <SsalCalc
            level={level}
            size={calcSize}
            analyzing={analyzing}
            glow={glow}
            display={display}
          />
          <div className="office-calc-caption">{calcCaption}</div>
        </div>

        <JarureuShelf score={score} highlightKey={highlightKey} rail={false} showLocked />
      </div>

      <div className="office-cast" aria-label="절약사무소 상주">
        {OFFICE_CAST.map((c) => (
          <div key={c.speaker} className="office-cast-member">
            <SpeakerBadge speaker={c.speaker} size={22} />
            <span className="office-cast-name">{c.name}</span>
            <span className="office-cast-role">{c.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
