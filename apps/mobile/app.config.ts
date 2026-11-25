import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || "August",
  slug: config.slug || "august-ledger",
  plugins: [
    ...(config.plugins || []),
    "expo-web-browser",
    "expo-secure-store",
    ["expo-build-properties", { android: { usesCleartextTraffic: process.env.AUGUST_ALLOW_HTTP === "1" } }],
  ],
});
