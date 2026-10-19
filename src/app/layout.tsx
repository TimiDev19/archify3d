import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
export const metadata: Metadata = { title: 'Archify3D — 2D Plans. 3D Possibilities.', description: 'Turn supported architectural floor plans into editable 3D models.', icons: { icon: [{ url: '/images/favicon.PNG', type: 'image/png', sizes: '164x164' }], apple: [{ url: '/images/favicon.PNG', type: 'image/png', sizes: '164x164' }] } };
const themeScript = `(()=>{try{let t=localStorage.getItem('archify-theme')||'system';let d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch{}})()`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}} /></head><body><ToastProvider>{children}</ToastProvider></body></html>; }
