/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the dev server's manifest/cache separate from production builds. Running
  // `next build` while `next dev` is open must not overwrite its RSC manifests.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  poweredByHeader: false,
  headers: async () => [{ source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'X-Frame-Options', value: 'DENY' }] }]
};
export default nextConfig;
