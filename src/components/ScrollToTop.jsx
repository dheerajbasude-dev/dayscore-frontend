import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Reset window/document scroll (mobile viewports)
    window.scrollTo(0, 0);

    // Reset .main-content container scroll (desktop viewports)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
      if (typeof mainContent.scrollTo === 'function') {
        mainContent.scrollTo(0, 0);
      }
    }
  }, [pathname]);

  return null;
}
