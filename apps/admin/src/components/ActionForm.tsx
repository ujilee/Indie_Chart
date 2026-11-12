"use client";

import type { ComponentProps } from "react";
import { useDemoMode } from "@indie/core/data-mode-context";

/** 서버 액션 폼. 데모 모드에서는 안의 입력과 버튼을 모두 비활성화한다. */
export function ActionForm({ children, ...props }: ComponentProps<"form">) {
  const demo = useDemoMode();
  return (
    <form {...props}>
      <fieldset disabled={demo} className="contents" title={demo ? "데모 모드에서는 변경할 수 없어요" : undefined}>
        {children}
      </fieldset>
    </form>
  );
}
