"use client";

import { createContext, useContext } from "react";

const DemoModeContext = createContext(false);

export function DemoModeProvider({ demo, children }: { demo: boolean; children: React.ReactNode }) {
  return <DemoModeContext.Provider value={demo}>{children}</DemoModeContext.Provider>;
}

/** 데모(읽기 전용) 모드 여부. 서버의 데이터 모드를 루트 레이아웃에서 내려받는다. */
export function useDemoMode() {
  return useContext(DemoModeContext);
}
