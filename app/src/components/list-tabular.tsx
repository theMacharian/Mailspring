import _ from 'underscore';
import React, { Component, CSSProperties } from 'react';
import { Utils, Model } from 'mailspring-exports';
import ReactDOM from 'react-dom';

import { ScrollRegion, ScrollRegionProps } from './scroll-region';
import { Spinner } from './spinner';

export * from './list-data-source';

import { ListDataSource } from './list-data-source';
import { ListSelection } from './list-selection';
import { ListTabularItem } from './list-tabular-item';

export class ListTabularColumn {
  name: string;
  flex?: number;
  width?: number;
  resolver: any;

  constructor({
    name,
    resolver,
    flex,
    width,
  }: {
    name: string;
    flex?: number;
    width?: number;
    resolver: any;
  }) {
    this.name = name;
    this.resolver = resolver;
    this.flex = flex;
    this.width = width;
  }
}

type ListTabularRowsProps = {
  rows?: any[];
  columns: any[];
  draggable?: boolean;
  itemHeight?: number;
  innerStyles?: CSSProperties;
  role?: string;
  ariaLabel?: string;
  ariaMultiselectable?: boolean;
  tabIndex?: number;
  ariaActiveDescendant?: string;
  domRef?: (el: HTMLElement | null) => void;
  onSelect?: (...args: any[]) => any;
  onClick?: (...args: any[]) => any;
  onDoubleClick?: (...args: any[]) => any;
  onDragStart?: (...args: any[]) => any;
  onDragEnd?: (...args: any[]) => any;
};

export const ListTabularRows: React.FC<ListTabularRowsProps> = React.memo(
  ({
    rows,
    columns,
    itemHeight,
    innerStyles,
    draggable,
    role,
    ariaLabel,
    ariaMultiselectable,
    tabIndex,
    ariaActiveDescendant,
    domRef,
    onClick,
    onSelect,
    onDoubleClick,
    onDragStart,
    onDragEnd,
  }) => (
    <div
      ref={domRef}
      className="list-rows"
      style={innerStyles}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      draggable={draggable}
      role={role}
      aria-label={ariaLabel}
      aria-multiselectable={ariaMultiselectable}
      tabIndex={tabIndex}
      aria-activedescendant={ariaActiveDescendant}
    >
      {rows.map(({ item, idx, itemProps = {}, top, height }) => {
        if (!item) return null;
        return (
          <ListTabularItem
            key={item.id || idx}
            item={item}
            itemProps={itemProps}
            metrics={{ top: top ?? idx * itemHeight, height: height ?? itemHeight }}
            columns={columns}
            onSelect={onSelect}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
          />
        );
      })}
    </div>
  ),
  (prev, next) => Utils.isEqualReact(prev, next)
);
ListTabularRows.displayName = 'ListTabularRows';

export interface ListTabularProps extends ScrollRegionProps {
  footer?: React.ReactNode;
  draggable?: boolean;
  className?: string;
  columns: ListTabularColumn[];
  dataSource?: ListDataSource;
  itemPropsProvider?: (...args: any[]) => any;
  itemHeight?: number;
  // Height a row needs beyond itemHeight (an attachment line, say). Rows the list hasn't
  // loaded yet are assumed to need none, so the list grows as taller rows come into view.
  extraHeightForItem?: (item: Model) => number;
  EmptyComponent?: React.ComponentType<{ visible: boolean }>;
  role?: string;
  ariaLabel?: string;
  ariaMultiselectable?: boolean;
  tabIndex?: number;
  ariaActiveDescendant?: string;
  onClick?: (...args: any[]) => any;
  onSelect?: (...args: any[]) => any;
  onDoubleClick?: (...args: any[]) => any;
  onDragStart?: (...args: any[]) => any;
  onDragEnd?: (...args: any[]) => any;
  onComponentDidUpdate?: (...args: any[]) => any;
}

interface ListTabularState {
  items: { [id: number]: Model };
  animatingOut: {
    [index: string]: {
      end: number;
      item: Model;
    };
  };
  renderedRangeStart: any;
  renderedRangeEnd: any;
  count: any;
  loaded: any;
  empty: any;
}

export class ListTabular extends Component<ListTabularProps, ListTabularState> {
  static displayName = 'ListTabular';

  static defaultProps = {
    footer: false,
    EmptyComponent: () => false,
    itemPropsProvider: () => ({}),
  };

  static Item = ListTabularItem;
  static Column = ListTabularColumn;
  static Selection = ListSelection;
  static DataSource = ListDataSource;

  _unlisten = () => {};
  updateRangeStateFiring: boolean;
  _cleanupAnimationTimeout?: number;
  _onWindowResize?: any;
  _scrollRegion: ScrollRegion;
  _listRowsEl: HTMLElement | null = null;

  // Extra height of each row seen so far, by index. Positions and the total height are
  // itemHeight per row plus these. Reset when the rows shift (a new data source, or the
  // count changing as mail arrives or leaves).
  _extraByIndex = new Map<number, number>();
  _extraCount = -1;
  _pendingScrollAdjust = 0;

  _setListRowsEl = (el: HTMLElement | null) => {
    this._listRowsEl = el;
  };

  constructor(props: ListTabularProps) {
    super(props);
    if (!props.itemHeight) {
      throw new Error(
        'ListTabular: You must provide an itemHeight - raising to avoid divide by zero errors.'
      );
    }

    this.state = this.buildStateForRange({ start: -1, end: -1 });
  }

  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize, true);
    this.setupDataSource(this.props.dataSource);
  }

  componentDidUpdate(prevProps: ListTabularProps, prevState: ListTabularState) {
    if (this.props.onComponentDidUpdate) {
      this.props.onComponentDidUpdate();
    }
    // Rows above the viewport turned out taller than assumed: move the scroll position by the
    // same amount so the rows on screen don't jump.
    if (this._pendingScrollAdjust && this._scrollRegion) {
      this._scrollRegion.scrollTop += this._pendingScrollAdjust;
      this._pendingScrollAdjust = 0;
    }
    // If our view has been swapped out for an entirely different one,
    // reset our scroll position to the top.
    if (prevProps.dataSource !== this.props.dataSource) {
      this._extraByIndex.clear();
      this._scrollRegion.scrollTop = 0;
      this.setupDataSource(this.props.dataSource);
    }

    if (this.updateRangeStateFiring) {
      this.updateRangeStateFiring = false;
    } else if (
      prevState.count !== this.state.count ||
      prevProps.itemHeight !== this.props.itemHeight
    ) {
      this.updateRangeStateIfViewportChanged();
    }

    if (!this._cleanupAnimationTimeout) {
      this._cleanupAnimationTimeout = window.setTimeout(this.onCleanupAnimatingItems, 50);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResize, true);
    if (this._cleanupAnimationTimeout) {
      window.clearTimeout(this._cleanupAnimationTimeout);
    }
    this._unlisten();
  }

  onWindowResize = () => {
    if (this._onWindowResize == null) {
      this._onWindowResize = _.debounce(this.updateRangeStateIfViewportChanged, 50);
    }
    this._onWindowResize();
  };

  onScroll = () => {
    // If we've shifted enough pixels from our previous scrollTop to require
    // new rows to be rendered, update our state!
    this.updateRangeStateIfViewportChanged();
  };

  onCleanupAnimatingItems = () => {
    this._cleanupAnimationTimeout = null;

    const nextAnimatingOut = {};
    Object.entries(this.state.animatingOut).forEach(([idx, record]) => {
      if (Date.now() < record.end) {
        nextAnimatingOut[idx] = record;
      }
    });

    if (Object.keys(nextAnimatingOut).length < Object.keys(this.state.animatingOut).length) {
      this.setState({ animatingOut: nextAnimatingOut });
    }

    if (Object.keys(nextAnimatingOut).length > 0) {
      this._cleanupAnimationTimeout = window.setTimeout(this.onCleanupAnimatingItems, 50);
    }
  };

  setupDataSource(dataSource: ListDataSource) {
    this._unlisten();
    this._unlisten = dataSource.listen(() => this.setState(this.buildStateForRange()), this);

    const range = this.getRange();
    if (range) {
      this.props.dataSource.setRetainedRange(range);
    }
    this.setState(this.buildStateForRange({ ...range, dataSource }));
  }

  getRowsToRender() {
    const { itemPropsProvider } = this.props;
    const { items, animatingOut, renderedRangeStart, renderedRangeEnd } = this.state;
    // The ordering of the rows array is important. We want current rows to
    // slide over rows which are animating out, so we need to render them last.
    const rows = [];
    Object.entries(animatingOut).forEach(([idx, record]) => {
      const itemProps = itemPropsProvider(record.item, Number(idx));
      rows.push({ item: record.item, idx: Number(idx) / 1, itemProps });
    });

    Utils.range(renderedRangeStart, renderedRangeEnd).forEach((idx) => {
      const item = items[idx];
      if (item) {
        const itemProps = itemPropsProvider(item, idx);
        rows.push({ item, idx, itemProps, ...this._metricsForIndex(idx) });
      }
    });

    return rows;
  }

  scrollTo(node: HTMLElement) {
    if (!this._scrollRegion) {
      return;
    }
    this._scrollRegion.scrollTo(node);
  }

  focusListbox() {
    this._listRowsEl?.focus({ preventScroll: true });
  }

  scrollByPage(direction: number) {
    if (!this._scrollRegion) {
      return;
    }
    const height = (ReactDOM.findDOMNode(this._scrollRegion) as HTMLElement).clientHeight;
    this._scrollRegion.scrollTop += height * direction;
  }

  getRange() {
    if (!this._scrollRegion) {
      return;
    }
    const { scrollTop } = this._scrollRegion;
    const { itemHeight } = this.props;

    // Determine the exact range of rows we want onscreen. Rows are at least itemHeight tall,
    // so this many always cover the window.
    const rangeSize = Math.ceil(window.innerHeight / itemHeight);
    let rangeStart = this._indexAtOffset(scrollTop);
    let rangeEnd = rangeStart + rangeSize;

    // Expand the start/end so that you can advance the keyboard cursor fast and
    // we have items to move to and then scroll to.
    rangeStart = Math.max(0, rangeStart - 2);
    rangeEnd = Math.min(rangeEnd + 2, this.state.count + 1);
    return { start: rangeStart, end: rangeEnd };
  }

  _extraBefore(idx: number) {
    let sum = 0;
    for (const [i, extra] of this._extraByIndex) {
      if (i < idx) sum += extra;
    }
    return sum;
  }

  _totalExtraHeight() {
    let sum = 0;
    for (const extra of this._extraByIndex.values()) sum += extra;
    return sum;
  }

  _metricsForIndex(idx: number) {
    const { itemHeight } = this.props;
    return {
      top: idx * itemHeight + this._extraBefore(idx),
      height: itemHeight + (this._extraByIndex.get(idx) || 0),
    };
  }

  // The index of the row at a vertical offset into the list.
  _indexAtOffset(offset: number) {
    const { itemHeight } = this.props;
    if (this._extraByIndex.size === 0) return Math.floor(offset / itemHeight);
    let idx = Math.max(0, Math.floor((offset - this._totalExtraHeight()) / itemHeight));
    while (this._metricsForIndex(idx + 1).top <= offset) idx++;
    return idx;
  }

  _recordExtraHeights(items: { [idx: number]: Model }, start: number, count: number) {
    const { extraHeightForItem } = this.props;
    if (!extraHeightForItem) return;
    // Measured before any reset, so a count change doesn't move the rows on screen either.
    const startTopBefore = this._extraBefore(start);
    if (count !== this._extraCount) {
      this._extraByIndex.clear();
      this._extraCount = count;
    }
    for (const [idx, item] of Object.entries(items)) {
      if (!item) continue;
      const extra = extraHeightForItem(item) || 0;
      if (extra) this._extraByIndex.set(Number(idx), extra);
      else this._extraByIndex.delete(Number(idx));
    }
    this._pendingScrollAdjust += this._extraBefore(start) - startTopBefore;
  }

  updateRangeStateIfViewportChanged() {
    const range = this.getRange();
    if (!range) {
      return;
    }

    // Final sanity check to prevent needless work
    if (
      range.end !== this.state.renderedRangeEnd ||
      range.start !== this.state.renderedRangeStart
    ) {
      this.updateRangeStateFiring = true;
      this.props.dataSource.setRetainedRange(range);
      this.setState(this.buildStateForRange(range));
    }
  }

  buildStateForRange(args: { start?: number; end?: number; dataSource?: ListDataSource } = {}) {
    const {
      start = this.state.renderedRangeStart,
      end = this.state.renderedRangeEnd,
      dataSource = this.props.dataSource,
    } = args;

    const items: { [id: number]: Model } = {};
    let animatingOut = {};

    Utils.range(start, end).forEach((idx) => {
      items[idx] = dataSource.get(idx);
    });
    this._recordExtraHeights(items, start, dataSource.count());

    // If we have a previous state, and the previous range matches the new range,
    // (eg: we're not scrolling), identify removed items. We'll render them in one
    // last time but not allocate height to them. This allows us to animate them
    // being covered by other items, not just disappearing when others start to slide up.
    if (this.state && start === this.state.renderedRangeStart) {
      const nextIds = Object.values(items).map((a) => a && a.id);
      animatingOut = {};

      // Keep items which are still animating out and are still not in the set
      Object.entries(this.state.animatingOut).forEach(([recordIdx, record]) => {
        if (Date.now() < record.end && !nextIds.includes(record.item.id)) {
          animatingOut[recordIdx] = record;
        }
      });

      // Add items which are no longer found in the set
      Object.entries(this.state.items).forEach(([previousIdx, previousItem]) => {
        if (!previousItem || nextIds.includes(previousItem.id)) {
          return;
        }
        animatingOut[previousIdx] = {
          idx: previousIdx,
          item: previousItem,
          end: Date.now() + 125,
        };
      });

      // If we think /all/ the items are animating out, or a lot of them,
      // the user probably switched to an entirely different perspective.
      // Don't bother trying to animate.
      const animatingCount = Object.keys(animatingOut).length;
      if (animatingCount > 8 || animatingCount === Object.keys(this.state.items).length) {
        animatingOut = {};
      }
    }

    return {
      items,
      animatingOut,
      renderedRangeStart: start,
      renderedRangeEnd: end,
      count: dataSource.count(),
      loaded: dataSource.loaded(),
      empty: dataSource.empty(),
    };
  }

  render() {
    const {
      footer,
      columns,
      className,
      draggable,
      itemHeight,
      EmptyComponent,
      scrollTooltipComponent,
      role,
      ariaLabel,
      ariaMultiselectable,
      tabIndex,
      ariaActiveDescendant,
      onClick,
      onSelect,
      onDragEnd,
      onDragStart,
      onDoubleClick,
    } = this.props;
    const { count, loaded, empty } = this.state;
    const rows = this.getRowsToRender();

    return (
      <div className={`list-container list-tabular ${className}`}>
        <ScrollRegion
          ref={(cm) => {
            this._scrollRegion = cm;
          }}
          onScroll={this.onScroll}
          tabIndex={-1}
          scrollTooltipComponent={scrollTooltipComponent}
        >
          <ListTabularRows
            rows={rows}
            columns={columns}
            draggable={draggable}
            itemHeight={itemHeight}
            role={role}
            ariaLabel={ariaLabel}
            ariaMultiselectable={ariaMultiselectable}
            tabIndex={tabIndex}
            ariaActiveDescendant={ariaActiveDescendant}
            domRef={this._setListRowsEl}
            innerStyles={{
              height: count * itemHeight + this._totalExtraHeight(),
              backgroundSize: `100% ${this.props.itemHeight}px`,
            }}
            onClick={onClick}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onDoubleClick={onDoubleClick}
          />
          <div className="footer">{footer}</div>
        </ScrollRegion>
        <Spinner visible={!loaded && empty} />
        <EmptyComponent visible={loaded && empty} />
      </div>
    );
  }
}
