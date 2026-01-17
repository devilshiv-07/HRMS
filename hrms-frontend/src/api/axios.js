import axios from "axios";

// Ensure baseURL always ends with /api
const getBaseURL = () => {
  const envURL = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const cleanURL = envURL.replace(/\/$/, "");
  return cleanURL.endsWith("/api") ? cleanURL : `${cleanURL}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  // withCredentials REMOVED (Option A)
});

// ------------------------------------------
// REQUEST INTERCEPTOR → Attach Access Token
// ------------------------------------------
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hrms_access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

// ------------------------------------------
// RESPONSE INTERCEPTOR → Auto Token Refresh
// ------------------------------------------
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      isRefreshing = true;

      try {
        // ✅ Refresh token from localStorage (Option A)
        const refreshToken = localStorage.getItem("hrms_refresh");

        const response = await axios.post(
          `${getBaseURL()}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken } = response.data;

        // Save new access token
        localStorage.setItem("hrms_access", accessToken);

        // Update axios default auth header
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        isRefreshing = false;

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (error) {
        processQueue(error, null);
        isRefreshing = false;

        localStorage.removeItem("hrms_access");
        localStorage.removeItem("hrms_refresh");

        window.location.href = "/login";
        throw error;
      }
    }

    throw err;
  }
);

export default api;
