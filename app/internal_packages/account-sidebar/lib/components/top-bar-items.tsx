import React from 'react';
import { ipcRenderer } from 'electron';
import { localized, Actions, AccountStore, IdentityStore } from 'mailspring-exports';

const ICONS = {
  menu: <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  help: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5" />
      <circle cx="10" cy="14" r="0.4" />
    </>
  ),
  // Feather's "settings" gear (MIT), drawn on its own 24-unit grid.
  settings: (
    <g transform="scale(0.8333)">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>
  ),
};

function TopBarButton({
  icon,
  label,
  onClick,
}: {
  icon: keyof typeof ICONS;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="top-bar-button" title={label} aria-label={label} onClick={onClick}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[icon]}
      </svg>
    </button>
  );
}

const COLLAPSED_KEY = 'core.workspace.foldersCollapsed';

function applyCollapsed() {
  document.body.classList.toggle('folders-collapsed', !!AppEnv.config.get(COLLAPSED_KEY));
}

/**
 * The menu button above the folder list. It collapses the list to its icons, as Gmail's
 * does, rather than hiding it, so the button itself never moves. The setting is kept in
 * config and exposed as a body class; themes decide what collapsed looks like.
 */
export class SidebarToggle extends React.Component {
  static displayName = 'SidebarToggle';
  static containerRequired = false;

  _disposable?: { dispose: () => void };

  componentDidMount() {
    applyCollapsed();
    this._disposable = AppEnv.config.onDidChange(COLLAPSED_KEY, () => {
      applyCollapsed();
      this.forceUpdate();
    });
  }

  componentWillUnmount() {
    if (this._disposable) this._disposable.dispose();
  }

  render() {
    const collapsed = !!AppEnv.config.get(COLLAPSED_KEY);
    return (
      <div className="sidebar-toggle">
        <TopBarButton
          icon="menu"
          label={collapsed ? localized('Show Sidebar') : localized('Hide Sidebar')}
          onClick={() => AppEnv.config.set(COLLAPSED_KEY, !collapsed)}
        />
      </div>
    );
  }
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Help, Preferences and the account badge at the right of the top bar. Hidden by default;
 * themes with a Gmail-style top bar (Clean) show it. Each opens what the menus already open.
 */
export function TopBarActions() {
  const identity = IdentityStore.identity();
  const account = AccountStore.accounts()[0];
  const name = identity
    ? `${identity.firstName || ''} ${identity.lastName || ''}`.trim()
    : (account && account.name) || '';
  const email = identity ? identity.emailAddress : account && account.emailAddress;

  return (
    <div className="top-bar-actions">
      <TopBarButton
        icon="help"
        label={localized('Mailspring Help')}
        onClick={() => ipcRenderer.send('command', 'application:view-help')}
      />
      <TopBarButton
        icon="settings"
        label={localized('Preferences')}
        onClick={() => Actions.openPreferences()}
      />
      <button
        className="top-bar-account"
        title={[name, email].filter(Boolean).join('\n')}
        aria-label={localized('Accounts')}
        onClick={() => {
          Actions.openPreferences();
          Actions.switchPreferencesTab('Accounts');
        }}
      >
        {initialsFor(name || email || '?')}
      </button>
    </div>
  );
}
TopBarActions.displayName = 'TopBarActions';
TopBarActions.containerRequired = false;

// The component registry keys components by name, so each toolbar placement gets its own.
export const TopBarActionsInReader = () => <TopBarActions />;
TopBarActionsInReader.displayName = 'TopBarActionsInReader';
TopBarActionsInReader.containerRequired = false;
