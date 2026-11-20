import { ListTabular } from 'mailspring-component-kit';

// Rows 1 and 3 need 30px more than the 36px every row gets.
const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
const tall = new Set(['b', 'd']);

function makeList() {
  const dataSource = {
    get: (idx: number) => items[idx],
    count: () => items.length,
    loaded: () => true,
    empty: () => false,
  };
  const list = new (ListTabular as any)({
    itemHeight: 36,
    columns: [],
    dataSource,
    extraHeightForItem: (item: { id: string }) => (tall.has(item.id) ? 30 : 0),
  });
  list.buildStateForRange({ start: 0, end: items.length, dataSource });
  return list;
}

describe('ListTabular with rows of different heights', function () {
  it('places each row below the ones before it', function () {
    const list = makeList();
    expect(list._metricsForIndex(0)).toEqual({ top: 0, height: 36 });
    expect(list._metricsForIndex(1)).toEqual({ top: 36, height: 66 });
    expect(list._metricsForIndex(2)).toEqual({ top: 102, height: 36 });
    expect(list._metricsForIndex(4)).toEqual({ top: 204, height: 36 });
    expect(list._totalExtraHeight()).toBe(60);
  });

  it('finds the row at a scroll offset', function () {
    const list = makeList();
    expect(list._indexAtOffset(0)).toBe(0);
    expect(list._indexAtOffset(100)).toBe(1);
    expect(list._indexAtOffset(102)).toBe(2);
    expect(list._indexAtOffset(210)).toBe(4);
  });

  it('keeps fixed-height lists on the simple path', function () {
    const list = new (ListTabular as any)({
      itemHeight: 36,
      columns: [],
      dataSource: { get: () => null, count: () => 0, loaded: () => true, empty: () => true },
    });
    expect(list._indexAtOffset(100)).toBe(2);
    expect(list._metricsForIndex(3)).toEqual({ top: 108, height: 36 });
  });
});
