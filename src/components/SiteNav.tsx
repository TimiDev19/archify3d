'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => setOpen(false);

  return <>
    <nav className="site-nav" aria-label="Main navigation">
      <a className="nav-link" href="#how">How it works</a>
      <a className="nav-link" href="#features">Features</a>
      <ThemeToggle />
      <a className="nav-link" href="/auth/signin">Sign in</a>
      <a className="btn primary" href="/auth/signup">Get started</a>
    </nav>

    <button
      type="button"
      className="mobile-menu-toggle"
      aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={open}
      aria-controls="mobile-navigation-sheet"
      onClick={() => setOpen(value => !value)}
    >
      {open ? <X size={21} /> : <Menu size={21} />}
    </button>

    <div className="mobile-menu-layer" data-open={open} aria-hidden={!open}>
      <button className="mobile-menu-backdrop" tabIndex={open ? 0 : -1} aria-label="Close navigation menu" onClick={close} />
      <aside
        id="mobile-navigation-sheet"
        className="mobile-menu-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!open}
      >
        <div className="mobile-menu-heading">
          <span className="display">Menu</span>
          <button ref={closeRef} type="button" className="btn mobile-menu-close" aria-label="Close navigation menu" onClick={close}><X size={19} /></button>
        </div>
        <nav className="mobile-menu-links" aria-label="Mobile navigation">
          <a href="#how" onClick={close}>How it works</a>
          <a href="#features" onClick={close}>Features</a>
        </nav>
        <div className="mobile-menu-theme">
          <span>Appearance</span>
          <ThemeToggle />
        </div>
        <div className="mobile-menu-actions">
          <a className="btn" href="/auth/signin" onClick={close}>Sign in</a>
          <a className="btn primary" href="/auth/signup" onClick={close}>Get started</a>
        </div>
      </aside>
    </div>
  </>;
}
