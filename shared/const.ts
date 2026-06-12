// 세션 쿠키 이름 — 발급(context)·삭제(auth.logout·kakao logout)가 전부 이 한 곳을 본다.
// ⚠️ 과거 버그(#57): context가 자체 상수 "gjr_session"으로 발급하고 로그아웃은 여기의 "app_session_id"를
// 지워서 로그아웃이 안 됐다. 실사용 쿠키 이름인 gjr_session으로 통일.
export const COOKIE_NAME = "gjr_session";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
