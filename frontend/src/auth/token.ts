const KEY='token';
export const getToken=()=>localStorage.getItem(KEY);
export const setToken=(token:string)=>localStorage.setItem(KEY,token);
export const removeToken=()=>localStorage.removeItem(KEY);
export const clearToken=removeToken;
export const logout=removeToken;
export const isLoggedIn=()=>Boolean(getToken());
