import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { Thread, Actions, ChangeUnreadTask } from 'mailspring-exports';
import { ThreadToggleUnreadQuickAction } from '../lib/thread-list-quick-actions';
import { cleanSnippet } from '../lib/thread-list-columns';

const threadWith = (unread: boolean) =>
  new Thread({}).fromJSON({ id: `thread_${unread}`, account_id: TEST_ACCOUNT_ID, unread });

function render(thread: Thread) {
  const container = document.createElement('div');
  ReactDOM.render(<ThreadToggleUnreadQuickAction thread={thread} />, container);
  return container.firstElementChild as HTMLElement;
}

describe('ThreadToggleUnreadQuickAction', function () {
  beforeEach(function () {
    spyOn(Actions, 'queueTask');
  });

  it('marks an unread thread as read', function () {
    const el = render(threadWith(true));
    expect(el.getAttribute('aria-label')).toBe('Mark as Read');
    ReactTestUtils.Simulate.click(el);
    const task = (Actions.queueTask as any).calls[0].args[0];
    expect(task instanceof ChangeUnreadTask).toBe(true);
    expect(task.unread).toBe(false);
  });

  it('marks a read thread as unread', function () {
    const el = render(threadWith(false));
    expect(el.getAttribute('aria-label')).toBe('Mark as Unread');
    ReactTestUtils.Simulate.click(el);
    expect((Actions.queueTask as any).calls[0].args[0].unread).toBe(true);
  });

  it("doesn't open the thread underneath", function () {
    const onRowClick = jasmine.createSpy('onRowClick');
    const container = document.createElement('div');
    ReactDOM.render(
      <div onClick={onRowClick}>
        <ThreadToggleUnreadQuickAction thread={threadWith(true)} />
      </div>,
      container
    );
    ReactTestUtils.Simulate.click(container.querySelector('.action-toggle-unread'));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('cleanSnippet', function () {
  it('drops the invisible padding marketing mail adds to previews', function () {
    const padded = 'All it takes is a little customisation. ͏ ‌   ﻿ ͏ ­';
    expect(cleanSnippet(padded)).toBe('All it takes is a little customisation.');
  });

  it('leaves ordinary previews alone', function () {
    expect(cleanSnippet('Hi Wanjiru, see you Thursday.')).toBe('Hi Wanjiru, see you Thursday.');
    expect(cleanSnippet(null)).toBe(null);
  });
});
