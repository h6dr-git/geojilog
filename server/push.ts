// 웹 푸시 — 회시생의 저녁 보고 (하루 1회, KST 20시대). (#41 v3)
// 원칙: 푸시는 잠금화면에 노출되므로 **민감정보(금액·기록 내용) 절대 금지** — 안전 로비 원칙의 연장.
// VAPID 키가 없으면 전체 기능이 조용히 꺼진다(클라 토글도 숨김).
import webpush from "web-push";
import { getAllPushSubscriptions, deletePushSubscription } from "./db";

const PUB = process.env.VAPID_PUBLIC_KEY || "";
const PRIV = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:you@example.com";

export const pushEnabled = !!(PUB && PRIV);
export const vapidPublicKey = PUB;

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUB, PRIV);
}

// 저녁 보고 카피 — 회시생 보고체(무자격의 확신·데드팬), 금액 없음 (로테이션)
const EVENING_LINES = [
  "사장님, 금일 결산 마감 전입니다. 계상할 건이 있으신지요.",
  "사장님, 회시생입니다. 오늘의 거래내역을 기다리고 있습니다.",
  "장부를 펼쳐 두었습니다. 오늘 계상할 거래가 있다면 한 줄 남겨 주시지요.",
];

type PushPayload = { title: string; body: string };

export async function sendToAll(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!pushEnabled) return { sent: 0, removed: 0 };
  const subs = await getAllPushSubscriptions();
  let sent = 0, removed = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          // 만료/해지된 구독 — 정리
          await deletePushSubscription(s.endpoint);
          removed += 1;
        }
      }
    })
  );
  return { sent, removed };
}

// KST 기준 시각
function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

let lastSentDate = ""; // 서버 생존 중 하루 1회 가드 (재시작 시 드물게 중복 가능 — 허용)

export function startPushScheduler() {
  if (!pushEnabled) {
    console.log("[push] VAPID 키 없음 — 푸시 비활성");
    return;
  }
  // 10분 간격 체크, KST 20시대에 하루 1번
  setInterval(async () => {
    const now = kstNow();
    const dateStr = now.toISOString().slice(0, 10);
    if (now.getUTCHours() === 20 && lastSentDate !== dateStr) {
      lastSentDate = dateStr;
      const body = EVENING_LINES[now.getUTCDate() % EVENING_LINES.length];
      const r = await sendToAll({ title: "회시생", body });
      console.log(`[push] 저녁 보고 발송: ${r.sent}건 (정리 ${r.removed})`);
    }
  }, 10 * 60 * 1000);
  console.log("[push] 저녁 보고 스케줄러 시작 (KST 20시대, 일 1회)");
}
