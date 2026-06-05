export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// 개인/로컬용: Manus 로그인을 제거했습니다.
// 항상 단일 사용자(나)로 로그인된 상태이므로 별도 로그인 페이지가 필요 없습니다.
// 나중에 공개 배포로 전환할 때, 여기서 실제 로그인 URL(예: Google 로그인)을
// 반환하도록 교체하면 됩니다.
export const getLoginUrl = () => "/";
