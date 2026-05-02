import { useEffect } from 'react';

/**
 * Hides the Lovable "Edit with Lovable" badge for ALL users.
 * The badge is injected by the Lovable platform, so we hide it via CSS + DOM cleanup.
 */
export function HideLovableBadge() {
  useEffect(() => {
    const STYLE_ID = 'lovable-badge-hide-style';

    if (!document.getElementById(STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        [data-lovable-badge],
        .lovable-badge,
        #lovable-badge,
        a[href*="lovable.dev"][target="_blank"],
        a[href*="lovable.app"][target="_blank"]:has(img),
        a[href*="gpteng.co"][target="_blank"],
        div[style*="position: fixed"][style*="bottom"]:has(a[href*="lovable"]),
        iframe[src*="lovable"],
        iframe[src*="gpteng"],
        [class*="lovable-badge"],
        [id*="lovable-badge"],
        [class*="EditWithLovable"],
        [data-testid*="lovable"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          position: absolute !important;
          left: -9999px !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Aggressively remove badge nodes if they slip through
    const removeBadges = () => {
      const selectors = [
        '[data-lovable-badge]',
        'a[href*="lovable.dev"][target="_blank"]',
        'iframe[src*="lovable"]',
        'iframe[src*="gpteng"]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
    };

    removeBadges();
    const observer = new MutationObserver(removeBadges);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
