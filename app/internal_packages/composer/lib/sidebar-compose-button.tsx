import React from 'react';
import { localized, Actions } from 'mailspring-exports';

/**
 * A labelled Compose button at the top of the folder list. Hidden by default; themes that
 * want it (Clean) show it and hide the toolbar's ComposeButton, so other themes are
 * unchanged.
 */
export default function SidebarComposeButton() {
  return (
    <div className="sidebar-compose">
      <button
        className="sidebar-compose-button"
        title={localized('Compose new message')}
        onClick={() => Actions.composeNewBlankDraft()}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12.5 4.5l3 3L7 16H4v-3l8.5-8.5z" />
          <path d="M11 6l3 3" />
        </svg>
        <span>{localized('Compose')}</span>
      </button>
    </div>
  );
}
SidebarComposeButton.displayName = 'SidebarComposeButton';
SidebarComposeButton.containerRequired = false;
