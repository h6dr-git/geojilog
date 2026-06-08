// 통화/숫자 표시 공용 헬퍼
export const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
export const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
