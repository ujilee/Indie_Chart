"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useDemoMode } from "@/lib/data-mode-context";
import { useSession } from "@/lib/session";
import { useToast } from "./Toast";

export default function CheerButton({
  artistId,
  artistName,
  size = "md",
}: {
  artistId: string;
  artistName: string;
  size?: "sm" | "md" | "lg";
}) {
  const { cheer, todayCheer, user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const demo = useDemoMode();

  const done = todayCheer === artistId;
  const usedOther = !!user && !!todayCheer && !done;

  const sizes = {
    sm: "h-8 px-3.5 text-xs min-w-[76px]",
    md: "h-10 px-5 text-sm min-w-[96px]",
    lg: "h-12 px-8 text-base min-w-[128px]",
  }[size];

  const onClick = async () => {
    // 데모 모드: 응원은 저장되지 않으므로 서버에 요청하지 않고 안내만 한다
    if (demo) {
      toast("데모 모드에서는 응원이 저장되지 않아 이용할 수 없어요.");
      return;
    }
    setPending(true);
    const r = await cheer(artistId);
    setPending(false);
    if (r === "login") {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (r === "readonly") {
      toast("데모 모드에서는 응원이 저장되지 않아 이용할 수 없어요.");
    } else if (r === "used") {
      toast("오늘의 응원을 이미 사용했어요. 내일 다시 응원해 주세요!");
    } else {
      toast(`${artistName}${objectParticle(artistName)} 응원했어요!`);
      router.refresh();
    }
  };

  // 세션 로드 전에는 상태가 확정되지 않으므로 중립 스타일로 표시
  const style = !ready
    ? "bg-surface text-transparent"
    : demo
      ? "bg-surface text-subtle cursor-not-allowed"
      : done
      ? "bg-accent text-white cursor-default"
      : usedOther
        ? "bg-surface text-subtle cursor-not-allowed"
        : "bg-fg text-bg hover:bg-accent";

  return (
    <button
      onClick={onClick}
      disabled={!ready || (!demo && (done || usedOther)) || pending}
      title={demo ? "데모 모드에서는 응원할 수 없어요" : usedOther ? "오늘의 응원을 이미 사용했어요" : undefined}
      className={`${sizes} shrink-0 rounded-full font-bold transition-colors ${style}`}
    >
      {done ? "응원 완료" : usedOther ? "내일 다시" : pending ? "응원 중…" : "응원하기"}
    </button>
  );
}

/** 받침 유무에 따라 을/를 선택 */
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return "을(를)";
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}
