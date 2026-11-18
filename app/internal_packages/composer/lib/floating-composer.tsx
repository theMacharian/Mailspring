import React from 'react';
import { localized, Actions, DraftStore } from 'mailspring-exports';
import { ComposerViewForDraftClientId } from './composer-view-for-draft';
import {
  FloatingComposerStore,
  FloatingComposerEntry,
  FloatingComposerMode,
} from './floating-composer-store';

const ICONS = {
  minimize: <path d="M3 11h10" />,
  restore: <path d="M4 10l4-4 4 4" />,
  maximize: <path d="M9.5 3H13v3.5M13 3L9 7M6.5 13H3V9.5M3 13l4-4" />,
  unmaximize: <path d="M13 6.5H9.5V3M9.5 6.5L13.5 2.5M3 9.5h3.5V13M6.5 9.5L2.5 13.5" />,
  popout: <path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
};

function HeaderButton({
  icon,
  label,
  onClick,
}: {
  icon: keyof typeof ICONS;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="floating-composer-button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
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

interface PanelProps {
  entry: FloatingComposerEntry;
}

class FloatingComposerPanel extends React.Component<PanelProps, { subject: string }> {
  static displayName = 'FloatingComposerPanel';

  state = { subject: '' };

  _composer: any = null;
  _mounted = false;
  _unlisten?: () => void;

  componentDidMount() {
    this._mounted = true;
    DraftStore.sessionForClientId(this.props.entry.headerMessageId).then((session) => {
      if (!this._mounted) return;
      const update = () => {
        const draft = session.draft();
        if (draft) this.setState({ subject: (draft.subject || '').trim() });
      };
      update();
      this._unlisten = session.listen(update);
    });
  }

  componentDidUpdate(prev: PanelProps) {
    if (prev.entry.mode === 'minimized' && this.props.entry.mode !== 'minimized') {
      this._focus();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._unlisten) this._unlisten();
  }

  _focus = () => {
    if (this._composer) this._composer.focus();
  };

  _setMode = (mode: FloatingComposerMode) => {
    FloatingComposerStore.setMode(this.props.entry.headerMessageId, mode);
  };

  render() {
    const { headerMessageId, mode, newDraft } = this.props.entry;
    const title = this.state.subject || (newDraft ? localized('New Message') : localized('Draft'));
    const minimized = mode === 'minimized';
    const maximized = mode === 'maximized';

    return (
      <section className={`floating-composer mode-${mode}`} role="dialog" aria-label={title}>
        <header
          className="floating-composer-header"
          onClick={minimized ? () => this._setMode('normal') : undefined}
        >
          <span className="floating-composer-title">{title}</span>
          <HeaderButton
            icon={minimized ? 'restore' : 'minimize'}
            label={minimized ? localized('Restore') : localized('Minimize')}
            onClick={() => this._setMode(minimized ? 'normal' : 'minimized')}
          />
          <HeaderButton
            icon={maximized ? 'unmaximize' : 'maximize'}
            label={maximized ? localized('Exit full screen') : localized('Full screen')}
            onClick={() => this._setMode(maximized ? 'normal' : 'maximized')}
          />
          <HeaderButton
            icon="popout"
            label={localized('Open in a new window')}
            onClick={() => Actions.composePopoutDraft(headerMessageId, { inWindow: true })}
          />
          <HeaderButton
            icon="close"
            label={localized('Save & close')}
            onClick={() => Actions.closeFloatingComposer(headerMessageId)}
          />
        </header>
        <div className="floating-composer-body">
          <ComposerViewForDraftClientId
            ref={(c) => {
              this._composer = c;
            }}
            headerMessageId={headerMessageId}
            className="composer-full-window composer-floating"
            onDraftReady={this._focus}
            keepEmptyDraftOnUnmount={() => FloatingComposerStore.wasHandedToWindow(headerMessageId)}
          />
        </div>
      </section>
    );
  }
}

/**
 * Hosts the floating composer panels along the bottom right of the main window, newest on
 * the left like Gmail. Panels stay mounted while minimized so the editor keeps its state.
 */
export default class FloatingComposers extends React.Component<
  Record<string, unknown>,
  { entries: FloatingComposerEntry[] }
> {
  static displayName = 'FloatingComposers';
  static containerRequired = false;

  state = { entries: FloatingComposerStore.entries() };

  _unsubscribe?: () => void;

  componentDidMount() {
    this._unsubscribe = FloatingComposerStore.listen(() => {
      this.setState({ entries: FloatingComposerStore.entries() });
    });
  }

  componentWillUnmount() {
    if (this._unsubscribe) this._unsubscribe();
  }

  render() {
    const { entries } = this.state;
    if (!entries.length) return null;
    const maximized = entries.find((e) => e.mode === 'maximized');

    return (
      <div className="floating-composers">
        {maximized && (
          <div
            className="floating-composer-scrim"
            onClick={() => FloatingComposerStore.setMode(maximized.headerMessageId, 'normal')}
          />
        )}
        {entries.map((entry) => (
          <FloatingComposerPanel key={entry.headerMessageId} entry={entry} />
        ))}
      </div>
    );
  }
}
