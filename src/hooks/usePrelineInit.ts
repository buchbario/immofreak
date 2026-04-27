import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "preline";

export function usePrelineInit() {
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.HSStaticMethods) {
        window.HSStaticMethods.autoInit();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);
}
