import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default {
  distDir: process.env.HEB_TEST_OUTPUT === '1' ? '.next-test' : '.next',
  turbopack: { root },
  poweredByHeader: false,
};
