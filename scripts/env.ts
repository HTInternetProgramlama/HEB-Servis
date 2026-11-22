import { loadEnvConfig } from '@next/env';
export function loadConfig() {
  if (process.env.HEB_ENV_FILE) process.loadEnvFile(process.env.HEB_ENV_FILE);
  else loadEnvConfig(process.cwd());
}
