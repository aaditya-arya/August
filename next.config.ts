import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import androidRelease from "./public/downloads/android-release.json";

const nextConfig: NextConfig = {
  transpilePackages: ["@august/shared"],
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap((entries) =>
    (entries || []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => entry.address)
  ),
  async headers() {
    return [{ source: androidRelease.path, headers: [
      { key: "Content-Type", value: "application/vnd.android.package-archive" },
      { key: "Content-Disposition", value: `attachment; filename="${androidRelease.filename}"` },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ] }];
  },
};

export default nextConfig;
