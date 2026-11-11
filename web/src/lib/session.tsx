"use client";

/**
 * 목업 세션. 소셜 로그인 연동 전까지 로그인 상태는 localStorage에 보관하고,
 * 응원 기록은 서버 액션으로 저장한다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cheerArtist } from "@/app/actions";
import { TODAY } from "./constants";

export type Provider = "google" | "apple" | "kakao";

interface User {
  id: string;
  name: string;
  provider: Provider;
}

interface Stored {
  user: User | null;
  /** 오늘 응원한 아티스트 (하루 1회) */
  cheer: { userId: string; date: string; artistId: string } | null;
}

interface SessionValue {
  ready: boolean;
  user: User | null;
  login: (provider: Provider) => void;
  logout: () => void;
  todayCheer: string | null;
  /** 오늘 응원 가능 횟수 (비로그인은 null) */
  remainingCheers: number | null;
  cheer: (artistId: string) => Promise<"ok" | "login" | "used" | "readonly">;
}

const SessionContext = createContext<SessionValue | null>(null);
const KEY = "indiechart.session.v2";
const EMPTY: Stored = { user: null, cheer: null };

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {}
  return EMPTY;
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read());
    setReady(true);
  }, []);

  const update = useCallback((fn: (s: Stored) => Stored) => {
    setState((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const todayCheer =
    state.user && state.cheer?.userId === state.user.id && state.cheer.date === TODAY ? state.cheer.artistId : null;

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      user: state.user,
      login: (provider) =>
        update((s) => ({
          ...s,
          user: {
            id: `${provider}-${Math.random().toString(36).slice(2, 10)}`,
            name: { google: "구글 사용자", apple: "애플 사용자", kakao: "카카오 사용자" }[provider],
            provider,
          },
        })),
      logout: () => update((s) => ({ ...s, user: null })),
      todayCheer,
      remainingCheers: state.user ? (todayCheer ? 0 : 1) : null,
      cheer: async (artistId) => {
        const user = state.user;
        if (!user) return "login";
        if (todayCheer) return "used";
        const r = await cheerArtist(user.id, artistId);
        if (r === "ok") update((s) => ({ ...s, cheer: { userId: user.id, date: TODAY, artistId } }));
        return r === "ok" || r === "readonly" ? r : "used";
      },
    }),
    [ready, state, todayCheer, update],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
