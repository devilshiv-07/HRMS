import { create } from "zustand";
import { jwtDecode } from "jwt-decode";

const useAuthStore = create((set) => ({
  user: null,
  accessToken: localStorage.getItem("hrms_access") || null,
  loading: true,

  /* ---------------------------------------------------
     SET AUTH (LOGIN SUCCESS) — FINAL (ACCESS + REFRESH)
  ---------------------------------------------------- */
  setAuth: (user, accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem("hrms_access", accessToken);
    if (refreshToken) localStorage.setItem("hrms_refresh", refreshToken);

    set({
      user,
      accessToken,
      loading: false,
    });
  },

  /* ---------------------------------------------------
     FINISH INITIAL LOADING
  ---------------------------------------------------- */
  finishLoading: () => set({ loading: false }),

  /* ---------------------------------------------------
     AUTO LOAD USER FROM ACCESS TOKEN
     (supports sub OR id)
  ---------------------------------------------------- */
  loadUserFromToken: () => {
    const token = localStorage.getItem("hrms_access");
    if (!token) return set({ loading: false });

    try {
      const decoded = jwtDecode(token);

      set({
        user: {
          id: decoded.sub || decoded.id, // ✅ IMPORTANT FIX
          role: decoded.role,
        },
        accessToken: token,
        loading: false,
      });
    } catch (err) {
      console.error("Token decode failed:", err);
      localStorage.removeItem("hrms_access");
      localStorage.removeItem("hrms_refresh");
      set({ loading: false });
    }
  },

  /* ---------------------------------------------------
     LOGOUT — CLEAR BOTH TOKENS
  ---------------------------------------------------- */
  logout: () => {
    localStorage.removeItem("hrms_access");
    localStorage.removeItem("hrms_refresh");

    set({
      user: null,
      accessToken: null,
      loading: false,
    });

    window.location.href = "/login";
  },
}));

export default useAuthStore;
