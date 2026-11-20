import React from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Rx, FocusedContentStore, Thread } from 'mailspring-exports';
import ThreadListStore from './thread-list-store';
import InjectsToolbarButtons, { ToolbarRole } from './injects-toolbar-buttons';
import { readerActionStripObservable } from './reader-action-strip-theme';

function getObservable() {
  return Rx.Observable.combineLatest(
    Rx.Observable.fromStore(FocusedContentStore),
    ThreadListStore.selectionObservable(),
    readerActionStripObservable(),
    (store, items, stripEnabled) => ({
      focusedThread: store.focused('thread'),
      items,
      stripEnabled,
    })
  ).map(({ focusedThread, items, stripEnabled }) => {
    if (focusedThread) {
      // The ReaderActionStrip above the open message holds the actions instead.
      return stripEnabled ? [] : [focusedThread];
    }
    return items;
  });
}

const MessageListToolbar = ({
  items,
  injectedButtons,
}: {
  items: Thread[];
  injectedButtons?: React.ReactElement;
}) => {
  const shouldRender = items.length > 0;

  return (
    <TransitionGroup className="message-toolbar-items" component="div">
      {shouldRender ? (
        <CSSTransition key="buttons" classNames="opacity-125ms" timeout={125}>
          {injectedButtons}
        </CSSTransition>
      ) : undefined}
    </TransitionGroup>
  );
};
MessageListToolbar.displayName = 'MessageListToolbar';

const toolbarProps = {
  getObservable,
  extraRoles: [`MessageList:${ToolbarRole}`],
};

export default InjectsToolbarButtons(MessageListToolbar, toolbarProps);
