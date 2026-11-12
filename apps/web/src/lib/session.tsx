"use client";

/**
 * 로그인 세션 (클라이언트). 로그인 상태와 오늘의 응원은 서버(쿠키 세션 + 저장소)에서 확인해
 * 루트 레이아웃이 내려 준다. 응원 직후에는 새로고침 전까지 화면에 먼저 반영한다.
 */
import { createContext, useContext, useMemo, useState } from "react";
import type { PublicUser } from "@indie/core/types";
import { cheerArtist } from "@/app/actions";

export type CheerResult = "ok" | "login" | "used" | "readonly" | "invalid";

interface SessionValue {
  /** 서버에서 받은 값이라 항상 확정 상태 (이전 API 호환용) */
  ready: true;
  user: PublicUser | null;
  /** 오늘 응원한 아티스트 ID */
  todayCheer: string | null;
  /** 오늘 응원 가능 횟수 (비로그인은 null) */
  remainingCheers: number | null;
  cheer: (artistId: string) => Promise<CheerResult>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  user,
  todayCheer: serverCheer,
  children,
}: {
  user: PublicUser | null;
  todayCheer: string | null;
  children: React.ReactNode;
}) {
  const [optimistic, setOptimistic] = useState<{ userId: string; artistId: string } | null>(null);
  const todayCheer = serverCheer ?? (user && optimistic?.userId === user.id ? optimistic.artistId : null);

  const value = useMemo<SessionValue>(
    () => ({
      ready: true,
      user,
      todayCheer,
      remainingCheers: user ? (todayCheer ? 0 : 1) : null,
      cheer: async (artistId) => {
        if (!user) return "login";
        if (todayCheer) return "used";
        const r = await cheerArtist(artistId);
        if (r === "ok") setOptimistic({ userId: user.id, artistId });
        return r;
      },
    }),
    [user, todayCheer],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
