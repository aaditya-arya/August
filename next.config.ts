import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const nextConfig: NextConfig = {
  transpilePackages: ["@august/shared"],
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap((entries) =>
    (entries || []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => entry.address)
  ),
};

export default nextConfig;
