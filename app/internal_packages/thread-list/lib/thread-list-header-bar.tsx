import React from 'react';
import {
  localized,
  Actions,
  Thread,
  TaskFactory,
  DatabaseStore,
  ThreadCountsStore,
  FocusedPerspectiveStore,
} from 'mailspring-exports';
import ThreadListStore from './thread-list-store';

const ICONS = {
  boxEmpty: <rect x="3.5" y="3.5" width="13" height="13" rx="2" />,
  boxAll: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M6.5 10.2l2.4 2.4 4.6-5" />
    </>
  ),
  boxSome: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M7 10h6" />
    </>
  ),
  refresh: <path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9M15.5 4.5v3h-3" />,
  more: (
    <>
      <circle cx="10" cy="4.5" r="0.9" />
      <circle cx="10" cy="10" r="0.9" />
      <circle cx="10" cy="15.5" r="0.9" />
    </>
  ),
  prev: <path d="M12 5l-5 5 5 5" />,
  next: <path d="M8 5l5 5-5 5" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
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
      {ICONS[name]}
    </svg>
  );
}

async function markAllAsRead() {
  const perspective = FocusedPerspectiveStore.current();
  const categories = perspective.categories() || [];
  let threads: Thread[];
  if (categories.length) {
    threads = await DatabaseStore.findAll<Thread>(Thread).where([
      Thread.attributes.categories.containsAny(categories.map((c) => c.id)),
      Thread.attributes.unread.equal(true),
    ]);
  } else {
    // Views that aren't a folder or label (Starred, search results): the loaded conversations.
    threads = ThreadListStore.dataSource().itemsCurrentlyInViewMatching(
      (t: Thread) => t.unread
    ) as Thread[];
  }
  if (threads.length) {
    Actions.queueTask(
      TaskFactory.taskForSettingUnread({ threads, unread: false, source: 'Thread List Header' })
    );
  }
}

/**
 * The bar above the inbox list: select all, refresh, more, and the conversation count.
 * Hidden by default; themes that want it (Clean) show it. Selection and actions go through
 * the same data source and tasks as the list's own shortcuts.
 */
export default class ThreadListHeaderBar extends React.Component<
  Record<string, unknown>,
  { selected: number; loaded: number; total: number }
> {
  static displayName = 'ThreadListHeaderBar';
  static containerRequired = false;

  _unsubscribe?: () => void;
  _unlistenDataSource?: () => void;

  constructor(props) {
    super(props);
    this.state = this._getState();
  }

  componentDidMount() {
    // The store triggers when the folder changes and swaps in a new data source; the data
    // source triggers as rows load and the selection changes.
    this._unsubscribe = ThreadListStore.listen(this._onDataSourceChanged);
    this._onDataSourceChanged();
  }

  componentWillUnmount() {
    if (this._unsubscribe) this._unsubscribe();
    if (this._unlistenDataSource) this._unlistenDataSource();
  }

  _onDataSourceChanged = () => {
    if (this._unlistenDataSource) this._unlistenDataSource();
    const ds = ThreadListStore.dataSource();
    this._unlistenDataSource = ds ? ds.listen(() => this.setState(this._getState()), this) : null;
    this.setState(this._getState());
  };

  _getState() {
    const ds = ThreadListStore.dataSource();
    const loaded = ds ? ds.itemsCurrentlyInViewMatching(() => true).length : 0;
    // The list loads conversations as you scroll, so the folder's own total is the real count.
    const categories = FocusedPerspectiveStore.current().categories() || [];
    const folderTotal = categories.reduce(
      (sum, c) => sum + (ThreadCountsStore.totalCountForCategoryId(c.id) || 0),
      0
    );
    return {
      selected: ds && ds.selection ? ds.selection.count() : 0,
      loaded,
      total: Math.max(folderTotal, ds ? ds.count() : 0, loaded),
    };
  }

  _onToggleAll = () => {
    const ds = ThreadListStore.dataSource();
    if (!ds || !ds.selection) return;
    if (this.state.selected > 0) {
      ds.selection.clear();
    } else {
      ds.selection.set(ds.itemsCurrentlyInViewMatching(() => true));
    }
  };

  _onRefresh = () => {
    AppEnv.mailsyncBridge.sendSyncMailNow();
  };

  _onMore = (event: React.MouseEvent) => {
    const { Menu, MenuItem } = require('@electron/remote');
    const menu = new Menu();
    menu.append(new MenuItem({ label: localized('Mark All as Read'), click: markAllAsRead }));
    menu.popup({ x: event.clientX, y: event.clientY });
  };

  render() {
    const { selected, loaded, total } = this.state;
    const box = selected === 0 ? 'boxEmpty' : selected >= loaded ? 'boxAll' : 'boxSome';
    const selectLabel = selected > 0 ? localized('Deselect All') : localized('Select All');

    return (
      <div className="thread-list-header-bar">
        <button
          className="header-bar-button"
          title={selectLabel}
          aria-label={selectLabel}
          onClick={this._onToggleAll}
        >
          <Icon name={box} />
        </button>
        <button
          className="header-bar-button"
          title={localized('Refresh')}
          aria-label={localized('Refresh')}
          onClick={this._onRefresh}
        >
          <Icon name="refresh" />
        </button>
        <button
          className="header-bar-button"
          title={localized('More')}
          aria-label={localized('More')}
          onClick={this._onMore}
        >
          <Icon name="more" />
        </button>
        <span className="header-bar-spacer" />
        {total > 0 && (
          <span className="header-bar-count">
            {localized('%1$@–%2$@ of %3$@', 1, loaded.toLocaleString(), total.toLocaleString())}
          </span>
        )}
        <button className="header-bar-button" disabled aria-hidden="true" tabIndex={-1}>
          <Icon name="prev" />
        </button>
        <button className="header-bar-button" disabled aria-hidden="true" tabIndex={-1}>
          <Icon name="next" />
        </button>
      </div>
    );
  }
}
