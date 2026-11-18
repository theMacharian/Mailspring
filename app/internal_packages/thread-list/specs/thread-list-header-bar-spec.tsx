import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { ThreadCountsStore, FocusedPerspectiveStore } from 'mailspring-exports';
import ThreadListStore from '../lib/thread-list-store';
import ThreadListHeaderBar from '../lib/thread-list-header-bar';

function fakeDataSource(items: { id: string }[], selectedCount = 0) {
  const selection = {
    count: () => selectedCount,
    clear: jasmine.createSpy('clear'),
    set: jasmine.createSpy('set'),
  };
  return {
    selection,
    count: () => items.length,
    itemsCurrentlyInViewMatching: () => items,
    listen: () => () => {},
  };
}

function render() {
  const container = document.createElement('div');
  ReactDOM.render(<ThreadListHeaderBar />, container);
  return container;
}

describe('ThreadListHeaderBar', function () {
  beforeEach(function () {
    spyOn(FocusedPerspectiveStore, 'current').andReturn({ categories: () => [{ id: 'inbox' }] });
    spyOn(ThreadCountsStore, 'totalCountForCategoryId').andReturn(2745);
  });

  it("shows the loaded range against the folder's total", function () {
    spyOn(ThreadListStore, 'dataSource').andReturn(fakeDataSource([{ id: 'a' }, { id: 'b' }]));
    const el = render();
    expect(el.querySelector('.header-bar-count').textContent).toBe('1–2 of 2,745');
  });

  it('selects every loaded conversation when none are selected', function () {
    const items = [{ id: 'a' }, { id: 'b' }];
    const ds = fakeDataSource(items, 0);
    spyOn(ThreadListStore, 'dataSource').andReturn(ds);
    const el = render();
    ReactTestUtils.Simulate.click(el.querySelector('[aria-label="Select All"]'));
    expect(ds.selection.set).toHaveBeenCalledWith(items);
  });

  it('clears the selection when some are selected', function () {
    const ds = fakeDataSource([{ id: 'a' }, { id: 'b' }], 1);
    spyOn(ThreadListStore, 'dataSource').andReturn(ds);
    const el = render();
    ReactTestUtils.Simulate.click(el.querySelector('[aria-label="Deselect All"]'));
    expect(ds.selection.clear).toHaveBeenCalled();
  });
});
