import React from 'react';
import {
  localized,
  Rx,
  Actions,
  Thread,
  WorkspaceStore,
  FocusedContentStore,
  FocusedPerspectiveStore,
  ThreadCountsStore,
} from 'mailspring-exports';
import InjectsToolbarButtons, { ToolbarRole } from './injects-toolbar-buttons';
import ThreadListStore from './thread-list-store';
import { readerActionStripObservable } from './reader-action-strip-theme';
import { conversationTotal } from './thread-list-header-bar';

// Actions the strip keeps out of sight and offers from the More menu instead. The menu
// clicks the real button, so each keeps its own task, popover and keyboard shortcut.
// Move to Folder only folds away when the account has labels; otherwise it takes the
// Labels slot (see thread-list.less).
const FOLDED_ACTIONS = ['.btn-star', '.btn-move-folder', '.thread-sharing-button'];

function getObservable() {
  return Rx.Observable.combineLatest(
    Rx.Observable.fromStore(FocusedContentStore),
    readerActionStripObservable(),
    (store, enabled) => {
      const thread = store.focused('thread');
      return enabled && thread ? [thread] : [];
    }
  );
}

function pagerState() {
  const ds = ThreadListStore.dataSource();
  const id = FocusedContentStore.focusedId('thread');
  const index = ds && id ? ds.indexOfId(id) : -1;
  const count = ds ? ds.count() : 0;
  return { index, count, total: Math.max(conversationTotal(), count) };
}

/** "3 of 120" and the Newer / Older arrows, which move through the list like the j/k keys. */
export class ReaderStripPager extends React.Component<
  Record<string, unknown>,
  ReturnType<typeof pagerState>
> {
  static displayName = 'ReaderStripPager';

  _unsubscribers: (() => void)[] = [];
  _unlistenDataSource?: () => void;

  state = pagerState();

  componentDidMount() {
    this._unsubscribers = [
      ThreadListStore.listen(this._onDataSourceChanged),
      FocusedContentStore.listen(this._update),
      ThreadCountsStore.listen(this._update),
    ];
    this._onDataSourceChanged();
  }

  componentWillUnmount() {
    this._unsubscribers.forEach((unsubscribe) => unsubscribe());
    if (this._unlistenDataSource) this._unlistenDataSource();
  }

  _onDataSourceChanged = () => {
    if (this._unlistenDataSource) this._unlistenDataSource();
    const ds = ThreadListStore.dataSource();
    this._unlistenDataSource = ds ? ds.listen(this._update, this) : null;
    this._update();
  };

  _update = () => {
    this.setState(pagerState());
  };

  render() {
    const { index, count, total } = this.state;
    const newerDisabled = index <= 0;
    const olderDisabled = index < 0 || index >= count - 1;
    return (
      <>
        <span className="reader-strip-spacer" />
        {index >= 0 && (
          <span className="reader-strip-pager">
            {localized('%1$@ of %2$@', (index + 1).toLocaleString(), total.toLocaleString())}
          </span>
        )}
        <StripButton
          className="reader-strip-newer"
          label={localized('Newer')}
          disabled={newerDisabled}
          onClick={() => AppEnv.commands.dispatch('core:previous-item')}
        />
        <StripButton
          className="reader-strip-older"
          label={localized('Older')}
          disabled={olderDisabled}
          onClick={() => AppEnv.commands.dispatch('core:next-item')}
        />
      </>
    );
  }
}

function StripButton({
  className,
  label,
  disabled,
  onClick,
  buttonRef,
}: {
  className: string;
  label: string;
  disabled?: boolean;
  onClick: (event: React.MouseEvent) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      className={`btn btn-toolbar reader-strip-button ${className}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

/**
 * The row of conversation actions at the top of an open message, for themes that ask for it
 * (`readerActionStrip`): Back · Archive, Spam, Delete · Unread, Snooze, Remind · Labels, More,
 * then the conversation's place in the list. It renders the same injected buttons as the top
 * bar's toolbar, which steps aside while the strip is showing (see message-list-toolbar.tsx).
 */
class ReaderActionStrip extends React.Component<{
  items: Thread[];
  injectedButtons?: React.ReactElement;
}> {
  static displayName = 'ReaderActionStrip';

  _el: HTMLDivElement | null = null;
  _moreEl: HTMLButtonElement | null = null;

  _foldedButtons() {
    if (!this._el) return [];
    const hasLabels = !!this._el.querySelector('.btn-apply-label');
    return FOLDED_ACTIONS.filter((selector) => hasLabels || selector !== '.btn-move-folder')
      .map((selector) => this._el.querySelector<HTMLButtonElement>(selector))
      .filter((button) => button && !button.disabled);
  }

  // Folded buttons are hidden but still laid out; moving one under the More button first
  // makes the popover it opens point at the button the user actually clicked.
  _clickFolded(button: HTMLButtonElement) {
    if (this._moreEl) {
      button.style.left = `${this._moreEl.offsetLeft}px`;
      button.style.top = `${this._moreEl.offsetTop}px`;
    }
    button.click();
  }

  _onMore = (event: React.MouseEvent) => {
    const { Menu, MenuItem } = require('@electron/remote');
    const menu = new Menu();
    const command = (name: string) => () => AppEnv.commands.dispatch(name);
    menu.append(new MenuItem({ label: localized('Reply'), click: command('core:reply') }));
    menu.append(new MenuItem({ label: localized('Forward'), click: command('core:forward') }));
    menu.append(new MenuItem({ type: 'separator' }));
    for (const button of this._foldedButtons()) {
      menu.append(
        new MenuItem({
          label: button.getAttribute('aria-label') || button.title,
          click: () => this._clickFolded(button),
        })
      );
    }
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: localized('Print'), click: command('core:print-thread') }));
    menu.popup({ x: event.clientX, y: event.clientY });
  };

  render() {
    const { items, injectedButtons } = this.props;
    if (items.length === 0) return null;

    // In the single panel layout the message is a sheet over the list. In split layouts it
    // sits beside the list and there is nothing to go back to.
    const canGoBack = WorkspaceStore.sheetStack().length > 1;
    const perspective = FocusedPerspectiveStore.current();
    const backLabel = localized('Return to %@', (perspective && perspective.name) || '');

    return (
      <div
        className="reader-action-strip"
        role="toolbar"
        aria-label={localized('Conversation Actions')}
        ref={(el) => {
          this._el = el;
        }}
      >
        {canGoBack && (
          <StripButton
            className="reader-strip-back"
            label={backLabel}
            onClick={() => Actions.popSheet()}
          />
        )}
        <div className="reader-strip-actions">{injectedButtons}</div>
        <span className="reader-strip-divider reader-strip-divider-move" />
        <span className="reader-strip-divider reader-strip-divider-flag" />
        <StripButton
          className="reader-strip-more"
          label={localized('More')}
          onClick={this._onMore}
          buttonRef={(el) => {
            this._moreEl = el;
          }}
        />
        <ReaderStripPager />
      </div>
    );
  }
}

export default InjectsToolbarButtons(ReaderActionStrip, {
  getObservable,
  extraRoles: [`MessageList:${ToolbarRole}`],
  extraExposedProps: { inReaderStrip: true },
});
