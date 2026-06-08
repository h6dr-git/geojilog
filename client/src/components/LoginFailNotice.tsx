// 카카오 로그인 실패 안내 — 콜백이 /?login=fail 로 돌려보내면 뜨는 안내.
// 가장 흔한 원인: iCloud 비공개 릴레이/VPN(카카오 보안 차단). 게스트로 계속 쓰면 다 됨.
import { useEffect, useState } from "react";

export default function LoginFailNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "fail") {
      setShow(true);
      // 쿼리 제거 → 새로고침/뒤로가기 때 다시 안 뜨게
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">카카오 로그인이 안 됐어요</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          괜찮아요 — <b className="text-gray-800">게스트로 그대로 계속</b> 쓰면 모든 기능 다 써져요.
          로그인은 다른 기기에서 볼 때만 필요해요.
        </p>
        <div className="mt-4 rounded-xl bg-gray-50 p-3.5 text-[13px] leading-relaxed text-gray-600">
          <p className="mb-1 font-semibold text-gray-700">아이폰인데 로그인하고 싶다면</p>
          <b className="text-gray-800">iCloud 비공개 릴레이</b>나 VPN이 켜져 있으면 카카오가 막아요.
          <br />
          설정 → 맨 위 <b className="text-gray-800">[내 이름]</b> → iCloud → 비공개 릴레이 → 끄기 → 다시 로그인
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setShow(false)}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50"
          >
            게스트로 계속
          </button>
          <button
            onClick={() => {
              window.location.href = "/api/auth/kakao";
            }}
            className="flex-1 rounded-xl bg-[#FEE500] py-2.5 text-sm font-semibold text-[#191600] active:opacity-90"
          >
            다시 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
