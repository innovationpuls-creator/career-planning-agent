const TOKEN_STORAGE_KEY = "feature_map_access_token";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
    ? window.sessionStorage
    : undefined;

export const getAccessToken = (): string | undefined => {
  if (!canUseStorage()) {
    return undefined;
  }

  return (
    window.localStorage.getItem(TOKEN_STORAGE_KEY) ||
    getSessionStorage()?.getItem(TOKEN_STORAGE_KEY) ||
    undefined
  );
};

export const setAccessToken = (token: string, remember = true) => {
  if (!canUseStorage()) {
    return;
  }

  const sessionStorage = getSessionStorage();
  const primaryStorage = remember
    ? window.localStorage
    : sessionStorage || window.localStorage;
  const secondaryStorage = remember ? sessionStorage : window.localStorage;
  secondaryStorage?.removeItem(TOKEN_STORAGE_KEY);
  primaryStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearAccessToken = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  getSessionStorage()?.removeItem(TOKEN_STORAGE_KEY);
};
