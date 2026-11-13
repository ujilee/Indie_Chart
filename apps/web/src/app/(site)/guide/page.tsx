import { permanentRedirect } from "next/navigation";

/** 예전 주소(/guide)는 순위 산정 기준 페이지로 보낸다 */
export default function GuideRedirect() {
  permanentRedirect("/ranking");
}
