import axios from "axios";

const isNativeApp =
  typeof window !== "undefined" &&
  (window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "file:" ||
    (window.location.hostname === "localhost" && !window.location.port));

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isNativeApp ? "https://renopay-original.vercel.app/api" : "/api");

export const http = axios.create({ baseURL: BASE_URL });

function getTokens() {
  return {
    access: localStorage.getItem("renopay_access_token"),
    refresh: localStorage.getItem("renopay_refresh_token"),
  };
}

export function setTokens({ access_token, refresh_token }) {
  localStorage.setItem("renopay_access_token", access_token);
  localStorage.setItem("renopay_refresh_token", refresh_token);
}

export function clearTokens() {
  localStorage.removeItem("renopay_access_token");
  localStorage.removeItem("renopay_refresh_token");
}

http.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// On a 401, try exactly once to refresh the access token using the
// refresh token, then replay the original request. If the refresh
// itself fails, clear tokens and let the app's route guard redirect
// to login — no infinite retry loops.
let refreshPromise = null;

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      const { refresh } = getTokens();
      if (!refresh) {
        clearTokens();
        return Promise.reject(error);
      }
      try {
        refreshPromise ??= axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
        const { data } = await refreshPromise;
        refreshPromise = null;
        setTokens(data);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return http(original);
      } catch (refreshError) {
        refreshPromise = null;
        clearTokens();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
