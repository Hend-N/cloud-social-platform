const TOKEN_KEY = "token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export const saveToken = setToken;

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const clearToken = removeToken;
export const logout = removeToken; 

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}