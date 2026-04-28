/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify handles the Next.js runtime via @netlify/plugin-nextjs
  // Do NOT set output: 'export' — API routes and SSR must stay dynamic

  images: {
    // Allow Supabase storage images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
