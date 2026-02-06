import { useEffect } from 'react';

/**
 * Hides the Lovable "Edit with Lovable" badge for ALL users.
 * The badge is injected by the Lovable platform, so we hide it via CSS.
 */
export function HideLovableBadge() {
  useEffect(() => {
    // Inject CSS to hide the Lovable badge for everyone
    const existingStyle = document.getElementById('lovable-badge-hide-style');
    
    if (!existingStyle) {
      const styleEl = document.createElement('style');
      styleEl.id = 'lovable-badge-hide-style';
      styleEl.textContent = `
        /* Hide Lovable badge for all users */
        [data-lovable-badge],
        .lovable-badge,
        #lovable-badge,
        a[href*="lovable.dev"][target="_blank"]:has(img),
        div[style*="position: fixed"][style*="bottom"]:has(a[href*="lovable"]),
        iframe[src*="lovable"],
        [class*="lovable-badge"],
        [id*="lovable-badge"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Don't remove on cleanup - keep it hidden always
  }, []);

  return null;
}
