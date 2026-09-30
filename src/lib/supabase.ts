import { createClient } from "@supabase/supabase-js";

// In Node.js environments (Next.js API routes), handle ISP-level DNS blocking/sinkholing for supabase.co
if (typeof window === "undefined") {
  try {
    const dns = require("dns");
    if (dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }

    const originalLookup = dns.lookup;
    const KNOWN_SUPABASE_IPS = [
      "172.64.149.246",
      "104.18.38.10",
      "172.64.150.246",
      "104.18.39.10",
    ];

    dns.lookup = (hostname: string, options: any, callback: any) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }

      if (typeof hostname === "string" && hostname.endsWith(".supabase.co")) {
        // Immediately return known working Supabase Anycast IPs without waiting for blocked/slow OS DNS
        if (options && options.all) {
          return callback(
            null,
            KNOWN_SUPABASE_IPS.map((ip) => ({ address: ip, family: 4 }))
          );
        }
        return callback(null, KNOWN_SUPABASE_IPS[0], 4);
      }

      return originalLookup(hostname, options, callback);
    };
  } catch {
    // browser or non-node environment
  }
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

