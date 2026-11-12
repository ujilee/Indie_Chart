import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 공통 패키지(@indie/core)는 TypeScript 소스 그대로 가져와 앱에서 컴파일
  transpilePackages: ["@indie/core"],
};

export default nextConfig;
