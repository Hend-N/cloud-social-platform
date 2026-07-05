export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function isLoggedIn() {
  return Boolean(getAccessToken());
}

export function logout() {
  localStorage.removeItem("access_token");
}
