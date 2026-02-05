import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Conditionally hides the Lovable "Edit with Lovable" badge for non-admin users.
 * The badge is injected by the Lovable platform, so we hide it via CSS.
 */
export function HideLovableBadge() {
  const { profile, loading } = useAuth();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    const isAdmin = profile?.is_admin === true;

    // Find and toggle visibility of Lovable badge elements
    const style = document.getElementById('lovable-badge-hide-style');
    
    if (!isAdmin) {
      // Hide the badge for non-admins
      if (!style) {
        const styleEl = document.createElement('style');
        styleEl.id = 'lovable-badge-hide-style';
        styleEl.textContent = `
          /* Hide Lovable badge for non-admin users */
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
    } else {
      // Show the badge for admins - remove the hide style if it exists
      if (style) {
        style.remove();
      }
    }

    // Cleanup on unmount
    return () => {
      const existingStyle = document.getElementById('lovable-badge-hide-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [profile?.is_admin, loading]);

  return null;
}
