import type { NextConfig } from 'next';
const config: NextConfig = {
    devIndicators: false,
    // Local synthesis can retry three 240s generations after embedding retrieval.
    experimental: { proxyClientMaxBodySize: '30mb', proxyTimeout: 960_000 },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
            },
        ];
    },
};
export default config;
