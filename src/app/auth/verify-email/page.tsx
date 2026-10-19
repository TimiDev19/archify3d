import { MailCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Verify your email — Archify3D' };

export default function VerifyEmailPage() {
  return <main className="wrap auth-layout verify-email-layout">
    <div className="verify-email-brand"><Logo tagline/></div>
    <section className="card verify-email-card" aria-labelledby="verify-email-title">
      <div className="verify-email-icon"><MailCheck size={28}/></div>
      <span className="eyebrow">ONE LAST STEP</span>
      <h1 id="verify-email-title" className="display">Check your inbox</h1>
      <p>We sent you a verification link. Open it to confirm your email and finish creating your Archify3D account.</p>
      <p className="verify-email-hint">If it isn’t there, check your spam folder. Once verified, come back and sign in.</p>
      <a className="btn primary verify-email-cta" href="/auth/signin">Go to sign in</a>
      <a className="verify-email-home" href="/">Back to Archify3D</a>
    </section>
  </main>;
}
