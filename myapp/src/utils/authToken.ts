const TOKEN_STORAGE_KEY = 'feature_map_access_token';

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getAccessToken = (): string | undefined => {
  if (!canUseStorage()) {
    return undefined;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || undefined;
};

export const setAccessToken = (token: string) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearAccessToken = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};
