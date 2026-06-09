// 카카오 소셜 로그인 (선택 기능)
// 게스트(익명) 계정을 카카오 계정에 '연결'한다 → 다른 기기에서도 같은 데이터.
// 이미 그 카카오로 만든 계정이 있으면 그 계정으로 전환한다.
import type { Express, Request } from "express";
import * as db from "./db";
import { readUid, setSessionCookie } from "./context";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";

// redirect_uri는 요청 호스트 기준으로 구성(prod/local 자동 대응).
// 필요하면 APP_BASE_URL 환경변수로 직접 지정 가능.
function getRedirectUri(req: Request): string {
  const base =
    process.env.APP_BASE_URL ||
    `${req.protocol}://${req.get("x-forwarded-host") || req.get("host")}`;
  return `${base}/api/auth/kakao/callback`;
}

// 카카오 닉네임 → 기본 표시 이름. 성씨 한 글자 + "회장님" (예: 박상욱 → 박회장님).
// 닉네임이 비어 있으면 그냥 "회장님".
function toPresidentName(nickname: string | undefined | null): string {
  const surname = Array.from((nickname ?? "").trim())[0];
  return surname ? surname + "회장님" : "회장님";
}

export function registerKakaoAuth(app: Express): void {
  // 1) 로그인 시작 → 카카오 인가 화면으로
  app.get("/api/auth/kakao", (req, res) => {
    if (!KAKAO_REST_API_KEY) {
      res.status(500).send("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
      return;
    }
    const url = new URL("https://kauth.kakao.com/oauth/authorize");
    url.searchParams.set("client_id", KAKAO_REST_API_KEY);
    url.searchParams.set("redirect_uri", getRedirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "profile_nickname");
    res.redirect(url.toString());
  });

  // 2) 콜백 → 토큰 교환 → 프로필 → 계정 연결 → 쿠키 → 홈
  app.get("/api/auth/kakao/callback", async (req, res) => {
    try {
      const code = String(req.query.code || "");
      if (!code) {
        res.redirect("/?login=fail");
        return;
      }
      const redirectUri = getRedirectUri(req);

      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_REST_API_KEY,
          redirect_uri: redirectUri,
          code,
        }),
      });
      if (!tokenRes.ok) {
        throw new Error("토큰 교환 실패: " + (await tokenRes.text()));
      }
      const token = (await tokenRes.json()) as { access_token: string };

      const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!meRes.ok) {
        throw new Error("프로필 조회 실패: " + (await meRes.text()));
      }
      const me = (await meRes.json()) as {
        id: number;
        kakao_account?: { profile?: { nickname?: string } };
        properties?: { nickname?: string };
      };

      const openId = "kakao_" + me.id;
      const rawNickname =
        me.kakao_account?.profile?.nickname || me.properties?.nickname || "";
      const displayName = toPresidentName(rawNickname);

      // 계정 find-or-link
      let uid: number;
      const existing = await db.getUserByOpenId(openId);
      if (existing) {
        // 이미 이 카카오 계정이 있음 → 지금 게스트로 쓰던 기록이 날아가지 않게 그 계정으로 합친다.
        const currentUid = await readUid(req.headers.cookie);
        if (currentUid && currentUid !== existing.id) {
          const guest = await db.getUserById(currentUid);
          if (guest && guest.openId.startsWith("anon_")) {
            await db.mergeUserData(guest.id, existing.id);
          }
        }
        uid = existing.id;
      } else {
        const currentUid = await readUid(req.headers.cookie);
        const currentUser = currentUid
          ? await db.getUserById(currentUid)
          : undefined;
        if (currentUser && currentUser.openId.startsWith("anon_")) {
          // 지금 쓰던 게스트 계정을 카카오로 연결(기존 데이터 유지)
          await db.updateUserIdentity(currentUser.id, {
            openId,
            name: displayName,
            loginMethod: "kakao",
          });
          uid = currentUser.id;
        } else {
          uid = await db.createUser({ openId, name: displayName, loginMethod: "kakao" });
        }
      }

      await setSessionCookie(res, uid);
      res.redirect("/");
    } catch (e) {
      console.error("[kakao] 콜백 실패:", e);
      res.redirect("/?login=fail");
    }
  });
}
