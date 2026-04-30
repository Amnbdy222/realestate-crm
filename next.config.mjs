/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to prevent Supabase auth lock conflicts
  // (Strict Mode double-mounts components in dev, causing two auth instances
  // to fight over the same browser Web Lock)
  reactStrictMode: false,

  images: {
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
