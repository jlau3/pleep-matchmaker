import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Basic hardening on every page: no framing by other sites (clickjacking),
  // no MIME sniffing, no full URLs leaked to other sites, and no camera, mic
  // or location access. Vercel already serves HTTPS with HSTS.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    // Keep pages you've visited (dynamic) and pages loaded ahead in the
    // background (static: NavLinks prefetches every tab) in the browser for 30
    // minutes, so switching tabs and coming back is instant instead of a new
    // server round trip. Your own changes (adding a friend, saving settings,
    // blocking) call revalidatePath, which clears this right away, and voting
    // refreshes when you leave My Votes (see VotesChangedRefresh). Other
    // players' new votes show up after 30 minutes or on a reload.
    staleTimes: { dynamic: 1800, static: 1800 },
  },
};

export default nextConfig;
