// 통화/숫자 표시 SSOT — won(₩포함), fmt(숫자만)
export const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
export const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
export const fmtSigned = (n: number) => "+₩" + Math.round(n).toLocaleString("ko-KR");
