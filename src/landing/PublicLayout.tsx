import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LangProvider } from '@/landing/LangContext';
import '@/landing/landing.css';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function PublicLayout() {
  return (
    <LangProvider>
      <ScrollToTop />
      <Outlet />
    </LangProvider>
  );
}
