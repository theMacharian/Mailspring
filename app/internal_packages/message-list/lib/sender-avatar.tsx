import React from 'react';
import { Contact, Utils } from 'mailspring-exports';

/**
 * The sender's initials in a circle tinted from their address. Drawn locally rather than
 * looked up (ContactProfilePhoto asks Gravatar), so showing a message never sends anything
 * about its sender off the machine. Hidden unless the theme shows it (Clean does).
 */
export default function SenderAvatar({ contact, small }: { contact?: Contact; small?: boolean }) {
  if (!contact) return null;
  const hue = Utils.hueForString(contact.email || contact.name || '');
  return (
    <div
      className={`sender-avatar${small ? ' small' : ''}`}
      style={{ '--avatar-hue': hue } as React.CSSProperties}
      aria-hidden="true"
    >
      {contact.nameAbbreviation()}
    </div>
  );
}
