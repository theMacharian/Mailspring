import MailspringStore from 'mailspring-store';
import { Actions } from 'mailspring-exports';

export type FloatingComposerMode = 'normal' | 'minimized' | 'maximized';

export interface FloatingComposerEntry {
  headerMessageId: string;
  mode: FloatingComposerMode;
  newDraft: boolean;
}

// As many panels as sit side by side along the bottom of a typical window. Opening one
// more closes the oldest; its draft stays in Drafts.
const MAX_OPEN = 3;

/**
 * Tracks the drafts open in floating composer panels in the main window, oldest first.
 * The DraftStore routes drafts here instead of a composer window while
 * `core.composing.floatingComposer` is on.
 */
class _FloatingComposerStore extends MailspringStore {
  _entries: FloatingComposerEntry[] = [];
  // Drafts whose panel closed because they moved to a composer window. Their panel must not
  // discard them on unmount even if they're still empty.
  _handedToWindow = new Set<string>();

  constructor() {
    super();
    this.listenTo(Actions.composeInFloatingPanel, this._onOpen);
    this.listenTo(Actions.closeFloatingComposer, this._onClose);
    this.listenTo(Actions.composePopoutDraft, this._onPopout);
    this.listenTo(Actions.sendDraft, this._onClose);
    this.listenTo(Actions.destroyDraft, this._onDestroy);
  }

  entries() {
    return this._entries;
  }

  wasHandedToWindow(headerMessageId: string) {
    return this._handedToWindow.has(headerMessageId);
  }

  setMode(headerMessageId: string, mode: FloatingComposerMode) {
    this._entries = this._entries.map((e) => {
      if (e.headerMessageId === headerMessageId) return { ...e, mode };
      // Only one panel can fill the window at a time.
      if (mode === 'maximized' && e.mode === 'maximized') return { ...e, mode: 'normal' };
      return e;
    });
    this.trigger();
  }

  _onOpen = (headerMessageId: string, { newDraft = false }: { newDraft?: boolean } = {}) => {
    if (this._entries.some((e) => e.headerMessageId === headerMessageId)) {
      this.setMode(headerMessageId, 'normal');
      return;
    }
    const entries = this._entries.map((e) =>
      e.mode === 'maximized' ? { ...e, mode: 'normal' as const } : e
    );
    this._handedToWindow.delete(headerMessageId);
    entries.push({ headerMessageId, mode: 'normal', newDraft });
    this._entries = entries.slice(-MAX_OPEN);
    this.trigger();
  };

  _onClose = (headerMessageId: string) => {
    const next = this._entries.filter((e) => e.headerMessageId !== headerMessageId);
    if (next.length !== this._entries.length) {
      this._entries = next;
      this.trigger();
    }
  };

  _onPopout = (headerMessageId: string, { inWindow }: { inWindow?: boolean } = {}) => {
    if (!inWindow) return;
    this._handedToWindow.add(headerMessageId);
    this._onClose(headerMessageId);
  };

  _onDestroy = ({ headerMessageId }: { headerMessageId: string }) => {
    this._onClose(headerMessageId);
  };
}

export const FloatingComposerStore = new _FloatingComposerStore();
