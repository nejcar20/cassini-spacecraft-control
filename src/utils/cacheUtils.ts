export const getCachedData = (key: string): any | null => {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn("Failed to parse cached data:", e);
      return null;
    }
  }
  return null;
};

export const setCachedData = (
  key: string,
  data: any,
  ttlInMinutes: number
): void => {
  const expiry = new Date().getTime() + ttlInMinutes * 60 * 1000;
  const cacheData = { data, expiry };
  localStorage.setItem(key, JSON.stringify(cacheData));
};

export const isCacheValid = (key: string): boolean => {
  const cached = getCachedData(key);
  if (cached && cached.expiry > new Date().getTime()) {
    return true;
  }
  return false;
};
