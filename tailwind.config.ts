import type { Config } from 'tailwindcss';
const config: Config = { content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { brand: { indigo: '#6366F1', blue: '#3B82F6', violet: '#4F46E5' } } } }, plugins: [] };
export default config;
