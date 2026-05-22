/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // docx is a CJS-only package; exclude it from webpack bundling
        // so Node.js loads it natively in API routes.
        serverComponentsExternalPackages: ['docx'],
    },
}

module.exports = nextConfig
