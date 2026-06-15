// 집무실 IP 무대 — 저녁 절약사무소
import type { ReactNode } from "react";
import SsalCalc from "@/components/SsalCalc";
import JarureuShelf from "@/components/JarureuShelf";
import DeskReceiptTap from "@/components/DeskReceiptTap";
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
  onRecord?: () => void;
  calcCaption: ReactNode;
  score: number;
  highlightKey?: string | null;
};

export default function OfficeStage({
  tagline,
  calcSize = 112,
  level,
  analyzing,
  glow,
  display,
  onTapCalc,
  onRecord,
  calcCaption,
  score,
  highlightKey,
}: Props) {
  const propCount = unlockedItems(score).length;

  return (
    <div className="geo-room">
      <p className="geo-room__tag">{tagline || officeTagline(propCount)}</p>

      <div className="geo-desk">
        <div className="geo-desk__scene">
          {onRecord && <DeskReceiptTap onTap={onRecord} busy={analyzing} />}
          <div className="geo-calc" onClick={onTapCalc}>
            <SsalCalc level={level} size={calcSize} analyzing={analyzing} glow={glow} display={display} />
            {calcCaption && <div className="geo-calc__caption">{calcCaption}</div>}
          </div>
        </div>
        <JarureuShelf score={score} highlightKey={highlightKey} rail={false} showLocked />
      </div>

      <p className="geo-cast-line">
        {OFFICE_CAST.map((c, i) => (
          <span key={c.speaker}>
            {i > 0 && " · "}
            <strong>{c.name}</strong>
          </span>
        ))}
      </p>
    </div>
  );
}
