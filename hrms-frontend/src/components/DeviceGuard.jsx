import React, { useEffect, useState } from "react";

const isMobileOrTablet = () => {
  const ua = navigator.userAgent || "";

  // 1️⃣ Mobile / Tablet UA detect
  const isUADevice =
    /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);

  // 2️⃣ Touch-capable devices (desktop mode bhi catch)
  const isTouchDevice =
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

  // 3️⃣ Screen size fallback
  const isSmallScreen = window.innerWidth < 1024;

  return isUADevice || isTouchDevice || isSmallScreen;
};

export default function DeviceGuard({ children }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setBlocked(isMobileOrTablet());
    };

    checkDevice();

    window.addEventListener("resize", checkDevice);
    window.addEventListener("orientationchange", checkDevice);

    return () => {
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("orientationchange", checkDevice);
    };
  }, []);

  if (blocked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600">
            Desktop Access Only
          </h1>
          <p className="mt-3 text-gray-600">
            AgilityAI HRMS can only be accessed on Laptop or Desktop.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
