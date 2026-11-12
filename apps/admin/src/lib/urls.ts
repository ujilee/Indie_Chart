/** 사용자 서비스 주소. 배포 시 NEXT_PUBLIC_WEB_URL 환경 변수로 지정 */
export const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
