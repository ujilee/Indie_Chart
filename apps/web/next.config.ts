import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * 환경 변수는 저장소 루트의 .env.local 하나에 모아 둔다.
 * 이미 정해진 값(시스템 환경 변수, Vercel 설정, 앱 폴더의 .env.local)이 있으면 그 값이 우선이다.
 */
function loadRootEnv() {
  const root = path.resolve(process.cwd(), "../..");
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || process.env[m[1]]) continue;
      const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
      if (value) process.env[m[1]] = value;
    }
  }
}
loadRootEnv();

const nextConfig: NextConfig = {
  // 공통 패키지(@indie/core)는 TypeScript 소스 그대로 가져와 앱에서 컴파일
  transpilePackages: ["@indie/core"],
};

export default nextConfig;
