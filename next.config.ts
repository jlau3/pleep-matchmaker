import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  experimental: {
    // Keep pages you've visited in the browser for 2 minutes, so going back to
    // a tab (Tier List, Friends, ...) is instant instead of a new server round
    // trip. Your own changes (adding a friend, saving settings, blocking) call
    // revalidatePath, which clears this right away; other players' new votes
    // show up within 2 minutes, or on a pull-to-refresh / reload.
    staleTimes: { dynamic: 120 },
  },
};

export default nextConfig;
