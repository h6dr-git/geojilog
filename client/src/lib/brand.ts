// 거지로그 브랜드 네이밍 — 화면에 보이는 이름은 전부 여기서 가져온다.
// 이름을 바꿀 일이 생기면 이 파일만 고치면 된다.
// (단, client/index.html 과 client/public/manifest.webmanifest 의 앱 이름은
//  정적 파일이라 import가 안 되므로 거기 두 곳은 따로 수정해야 한다.)

/** 앱 이름 */
export const APP_NAME = "거지로그";

/** 마스코트(쌀집 계산기) 이름 — #41 v3: 자르르(단지) → 쌀집군(계산기) */
export const CHARACTER_NAME = "쌀집군";
/** 계산기 몸체 모델명 (JS-40B 변형, 상표 회피) */
export const CALC_MODEL = "SJ-40B";
/** 보좌 캐릭터 — 김집사 → 회시생 (#41 v3) */
export const CPA_NAME = "회시생";
/** 사용자 호칭 — 회장님 → CEO님 (#41 v3 '예비 세계관') */
export const USER_TITLE = "CEO님";

/**
 * 한글 받침 유무에 따라 조사를 붙인다.
 * 마지막 글자에 받침이 있으면 withBatchim, 없으면 withoutBatchim 사용.
 *
 *   josa("자르르", "이", "가") -> "자르르가"
 *   josa("화수분", "이", "가") -> "화수분이"
 *   josa("자르르", "과", "와") -> "자르르와"
 */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const hasBatchim = isHangul && (code - 0xac00) % 28 !== 0;
  return word + (hasBatchim ? withBatchim : withoutBatchim);
}
