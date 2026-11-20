import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import {
  Thread,
  WorkspaceStore,
  ThreadCountsStore,
  FocusedContentStore,
  FocusedPerspectiveStore,
} from 'mailspring-exports';
import ThreadListStore from '../lib/thread-list-store';
import ReaderActionStrip, { ReaderStripPager } from '../lib/reader-action-strip';
import MessageListToolbar from '../lib/message-list-toolbar';

function fakeDataSource(ids: string[]) {
  return {
    selection: { items: () => [], count: () => 0 },
    count: () => ids.length,
    indexOfId: (id: string) => ids.indexOf(id),
    itemsCurrentlyInViewMatching: () => ids.map((id) => ({ id })),
    listen: () => () => {},
  };
}

function render(element: React.ReactElement) {
  const container = document.createElement('div');
  ReactDOM.render(element, container);
  return container;
}

describe('ReaderActionStrip', function () {
  const thread = new Thread({ id: 'b', accountId: 'acct', subject: 'Hello' });

  beforeEach(function () {
    spyOn(ThreadListStore, 'dataSource').andReturn(fakeDataSource(['a', 'b', 'c']));
    spyOn(FocusedContentStore, 'focusedId').andReturn('b');
    spyOn(FocusedContentStore, 'focused').andReturn(thread);
    spyOn(FocusedPerspectiveStore, 'current').andReturn({
      name: 'Inbox',
      categories: () => [{ id: 'inbox' }],
    });
    spyOn(ThreadCountsStore, 'totalCountForCategoryId').andReturn(120);
    spyOn(WorkspaceStore, 'sheetStack').andReturn([{ id: 'Threads' }, { id: 'Thread' }]);
  });

  describe('pager', function () {
    it("shows the conversation's place in the folder", function () {
      const el = render(<ReaderStripPager />);
      expect(el.querySelector('.reader-strip-pager').textContent).toBe('2 of 120');
    });

    it('moves through the list like the keyboard does', function () {
      spyOn(AppEnv.commands, 'dispatch');
      const el = render(<ReaderStripPager />);
      ReactTestUtils.Simulate.click(el.querySelector('.reader-strip-older'));
      expect(AppEnv.commands.dispatch).toHaveBeenCalledWith('core:next-item');
      ReactTestUtils.Simulate.click(el.querySelector('.reader-strip-newer'));
      expect(AppEnv.commands.dispatch).toHaveBeenCalledWith('core:previous-item');
    });

    it('disables Newer on the first conversation', function () {
      (FocusedContentStore.focusedId as jasmine.Spy).andReturn('a');
      const el = render(<ReaderStripPager />);
      expect((el.querySelector('.reader-strip-newer') as HTMLButtonElement).disabled).toBe(true);
      expect((el.querySelector('.reader-strip-older') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('with a theme that asks for it', function () {
    beforeEach(function () {
      spyOn(AppEnv.themes, 'getActiveTheme').andReturn({ readerActionStrip: true });
    });

    it('shows Back, More and the pager above the open message', function () {
      const el = render(<ReaderActionStrip />);
      expect(el.querySelector('.reader-strip-back').getAttribute('aria-label')).toBe(
        'Return to Inbox'
      );
      expect(el.querySelector('.reader-strip-more')).not.toBe(null);
      expect(el.querySelector('.reader-strip-pager')).not.toBe(null);
    });

    it('leaves out Back when the message sits beside the list', function () {
      (WorkspaceStore.sheetStack as jasmine.Spy).andReturn([{ id: 'Threads' }]);
      const el = render(<ReaderActionStrip />);
      expect(el.querySelector('.reader-strip-back')).toBe(null);
    });

    it("empties the top bar's toolbar, so each shortcut is bound once", function () {
      const el = render(<MessageListToolbar />);
      expect(el.querySelector('.message-toolbar-items').children.length).toBe(0);
    });
  });

  describe('with other themes', function () {
    beforeEach(function () {
      spyOn(AppEnv.themes, 'getActiveTheme').andReturn({ readerActionStrip: false });
    });

    it('renders nothing', function () {
      const el = render(<ReaderActionStrip />);
      expect(el.querySelector('.reader-action-strip')).toBe(null);
    });

    it("keeps the actions in the top bar's toolbar", function () {
      const el = render(<MessageListToolbar />);
      expect(el.querySelector('.message-toolbar-items').children.length).toBe(1);
    });
  });
});
