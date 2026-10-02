// src/common/utils/device.util.ts
export function detectDevice(ua: string | undefined): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg/i.test(ua) ? "Edge" :
    /Chrome/i.test(ua) ? "Chrome" :
    /Safari/i.test(ua) ? "Safari" :
    /Firefox/i.test(ua) ? "Firefox" : "Browser";
  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Mac OS/i.test(ua) ? "macOS" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad/i.test(ua) ? "iOS" :
    /Linux/i.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}