import { useState, useEffect } from "react";

const LICENSE_KEY = "eagle_ai_license";

export type LicenseStatus = "not_deployed" | "active" | "expired" | "permanent";

export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus>("not_deployed");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const checkLicense = () => {
    const license = localStorage.getItem(LICENSE_KEY);
    if (!license) {
      setStatus("not_deployed");
      setDaysRemaining(null);
      setIsExpired(false);
      return;
    }

    try {
      const data = JSON.parse(license);
      if (data.mode === "permanent") {
        setStatus("permanent");
        setDaysRemaining(null);
        setIsExpired(false);
      } else if (data.mode === "active") {
        const durationMs = (data.durationDays || 185) * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - data.startDate;
        const remaining = Math.max(0, durationMs - elapsed);
        
        if (remaining <= 0) {
          setStatus("expired");
          setDaysRemaining(0);
          setIsExpired(true);
        } else {
          setStatus("active");
          setDaysRemaining(Math.floor(remaining / (1000 * 60 * 60 * 24)));
          setIsExpired(false);
        }
      }
    } catch {
      setStatus("not_deployed");
      setIsExpired(false);
    }
  };

  useEffect(() => {
    checkLicense();
    const timer = setInterval(checkLicense, 1000); // Real-time countdown
    return () => clearInterval(timer);
  }, []);

  const deploy = (days = 185) => {
    const data = { mode: "active", startDate: Date.now(), durationDays: days };
    localStorage.setItem(LICENSE_KEY, JSON.stringify(data));
    checkLicense();
  };

  const activate = (key: string) => {
    if (key.startsWith("EAGLE-") && key.length > 15) {
      const data = { mode: "permanent", key };
      localStorage.setItem(LICENSE_KEY, JSON.stringify(data));
      checkLicense();
      return true;
    }
    return false;
  };

  const resetLicense = () => {
    localStorage.removeItem(LICENSE_KEY);
    checkLicense();
  };

  return { status, daysRemaining, isExpired, deploy, activate, resetLicense };
}
