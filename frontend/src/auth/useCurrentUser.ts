import { useEffect, useState } from "react";
import { getMe } from "../api/auth";
import { getToken } from "./token";

export interface CurrentUser {
  id: number;
  username?: string;
}

// One /auth/me request per token. A different token (new login) refetches.
let cache: { token: string; promise: Promise<CurrentUser> } | null = null;

export function loadCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return Promise.resolve(null);
  if (!cache || cache.token !== token) {
    const promise = getMe().then((d: any) => ({
      id: Number(d.id),
      username: d.username as string | undefined,
    }));
    cache = { token, promise };
    promise.catch(() => {
      if (cache?.promise === promise) cache = null;
    });
  }
  return cache.promise;
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}
