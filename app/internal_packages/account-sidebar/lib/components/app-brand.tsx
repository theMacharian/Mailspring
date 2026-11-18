import React from 'react';

/**
 * The app's mark and name for the top bar above the folder list. Hidden by default; themes
 * that want a branded top bar (Clean) show it.
 */
export default function AppBrand() {
  return (
    <div className="app-brand" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 32 32">
        <rect className="app-brand-envelope" x="2" y="6" width="28" height="20" rx="6" />
        <path
          className="app-brand-flap"
          d="M7 12l9 6.2L25 12"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Mailspring</span>
    </div>
  );
}
AppBrand.displayName = 'AppBrand';
AppBrand.containerRequired = false;
