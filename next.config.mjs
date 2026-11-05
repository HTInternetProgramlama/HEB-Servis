import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default {
  turbopack: { root },
  poweredByHeader: false,
  ...(process.env.GITHUB_PAGES === 'true' && {
    output: 'export',
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};
