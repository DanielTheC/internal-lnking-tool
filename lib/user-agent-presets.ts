/**
 * Preset User-Agent strings for crawls. Empty `userAgent` = omit header (server uses its default).
 */
export type UserAgentPreset = {
  id: string;
  label: string;
  /** Empty: do not send (API/crawler default). */
  userAgent: string;
};

export const USER_AGENT_PRESET_CUSTOM = "custom";

export const USER_AGENT_PRESETS: UserAgentPreset[] = [
  {
    id: "default",
    label: "Default (crawler built‑in)",
    userAgent: ""
  },
  {
    id: "chrome-win",
    label: "Chrome · Windows",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  },
  {
    id: "chrome-mac",
    label: "Chrome · macOS",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  },
  {
    id: "safari-mac",
    label: "Safari · macOS",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15"
  },
  {
    id: "firefox-win",
    label: "Firefox · Windows",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; rv:133.0) Gecko/20100101 Firefox/133.0"
  },
  {
    id: "edge-win",
    label: "Edge · Windows",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
  },
  {
    id: "chrome-android",
    label: "Chrome · Android",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
  },
  {
    id: "safari-ios",
    label: "Safari · iPhone",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
  },
  {
    id: "googlebot",
    label: "Googlebot (search)",
    userAgent:
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
  },
  {
    id: "bingbot",
    label: "Bingbot",
    userAgent:
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
  },
  {
    id: USER_AGENT_PRESET_CUSTOM,
    label: "Custom…",
    userAgent: ""
  }
];

export function resolveUserAgentForPreset(
  presetId: string,
  customUserAgent: string
): string | undefined {
  if (presetId === USER_AGENT_PRESET_CUSTOM) {
    const t = customUserAgent.trim();
    return t.length > 0 ? t : undefined;
  }
  const preset = USER_AGENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return undefined;
  const ua = preset.userAgent.trim();
  return ua.length > 0 ? ua : undefined;
}
