/* @flow */

import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import "./TableInteractive.css";

import Icon from "metabase/components/Icon.jsx";

import { formatValue } from "metabase/lib/formatting";
import { isID, isFK } from "metabase/lib/schema_metadata";
import { memoize } from "metabase-lib/lib/utils";
import {
  getTableCellClickedObject,
  getTableHeaderClickedObject,
  isColumnRightAligned,
} from "metabase/visualizations/lib/table";
import { getColumnExtent } from "metabase/visualizations/lib/utils";
import { fieldRefForColumn } from "metabase/lib/dataset";
import Dimension from "metabase-lib/lib/Dimension";

import _ from "underscore";
import cx from "classnames";

import ExplicitSize from "metabase/components/ExplicitSize.jsx";
import MiniBar from "./MiniBar";

// $FlowFixMe: had to ignore react-virtualized in flow, probably due to different version
import { Grid, ScrollSync } from "react-virtualized";
import Draggable from "react-draggable";
import Ellipsified from "metabase/components/Ellipsified.jsx";

const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 36;
const MIN_COLUMN_WIDTH = ROW_HEIGHT;
const RESIZE_HANDLE_WIDTH = 5;
// if header is dragged fewer than than this number of pixels we consider it a click instead of a drag
const HEADER_DRAG_THRESHOLD = 5;

// HACK: used to get react-draggable to reset after a drag
let DRAG_COUNTER = 0;

import type {
  VisualizationProps,
  ClickObject,
} from "metabase/meta/types/Visualization";

function pickRowsToMeasure(rows, columnIndex, count = 10) {
  const rowIndexes = [];
  // measure up to 10 non-nil cells
  for (
    let rowIndex = 0;
    rowIndex < rows.length && rowIndexes.length < count;
    rowIndex++
  ) {
    if (rows[rowIndex][columnIndex] != null) {
      rowIndexes.push(rowIndex);
    }
  }
  return rowIndexes;
}

type Props = VisualizationProps & {
  width: number,
  height: number,
  sort: any,
  isPivoted: boolean,
  onActionDismissal: () => void,
};
type State = {
  columnWidths: number[],
  contentWidths: ?(number[]),

  dragColIndex?: ?number,
  dragColStyle?: ?{ [key: string]: any },
  dragColNewLefts?: ?(number[]),
  dragColNewIndex?: ?number,
  columnPositions?: ?({
    left: number,
    right: number,
    center: number,
    width: number,
  }[]),
};

type CellRendererProps = {
  key: string,
  style: { [key: string]: any },
  columnIndex: number,
  rowIndex: number,
};

type GridComponent = Component<void, void, void> & {
  recomputeGridSize: () => void,
};

@ExplicitSize()
export default class TableInteractive extends Component {
  state: State;
  props: Props;

  columnHasResized: { [key: number]: boolean };
  columnNeedsResize: { [key: number]: boolean };
  _div: HTMLElement;
  _totalContentWidth: ?number;
  _previousOverscrollBehaviorX: any;

  header: GridComponent;
  grid: GridComponent;
  headerRefs: HTMLElement[];

  constructor(props: Props) {
    super(props);

    this.state = {
      columnWidths: [],
      contentWidths: null,
    };
    this.columnHasResized = {};
    this.headerRefs = [];

    window.METABASE_TABLE = this;
  }

  static propTypes = {
    data: PropTypes.object.isRequired,
    isPivoted: PropTypes.bool.isRequired,
    sort: PropTypes.array,
  };

  static defaultProps = {
    isPivoted: false,
    renderTableHeaderWrapper: children => (
      <div className="cellData">{children}</div>
    ),
    renderTableCellWrapper: children => (
      <div className="cellData">{children}</div>
    ),
  };

  componentWillMount() {
    // for measuring cells:
    this._div = document.createElement("div");
    this._div.className = "TableInteractive";
    this._div.style.display = "inline-block";
    this._div.style.position = "absolute";
    this._div.style.visibility = "hidden";
    this._div.style.zIndex = "-1";
    document.body.appendChild(this._div);

    this._measure();
  }

  componentWillUnmount() {
    if (this._div && this._div.parentNode) {
      this._div.parentNode.removeChild(this._div);
    }
  }

  componentWillReceiveProps(newProps: Props) {
    if (
      this.props.data &&
      newProps.data &&
      !_.isEqual(this.props.data.cols, newProps.data.cols)
    ) {
      this.resetColumnWidths();
    }

    // remeasure columns if the column settings change, e.x. turning on/off mini bar charts
    const oldColSettings = this._getColumnSettings(this.props);
    const newColSettings = this._getColumnSettings(newProps);
    if (!_.isEqual(oldColSettings, newColSettings)) {
      this.remeasureColumnWidths();
    }
  }

  _getColumnSettings(props: Props) {
    return props.data && props.data.cols.map(col => props.settings.column(col));
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    const PROP_KEYS: string[] = ["width", "height", "settings", "data"];
    // compare specific props and state to determine if we should re-render
    return (
      !_.isEqual(
        _.pick(this.props, ...PROP_KEYS),
        _.pick(nextProps, ...PROP_KEYS),
      ) || !_.isEqual(this.state, nextState)
    );
  }

  componentDidUpdate() {
    if (!this.state.contentWidths) {
      this._measure();
    } else if (this.props.onContentWidthChange) {
      const total = this.state.columnWidths.reduce((sum, width) => sum + width);
      if (this._totalContentWidth !== total) {
        this.props.onContentWidthChange(total, this.state.columnWidths);
        this._totalContentWidth = total;
      }
    }
  }

  remeasureColumnWidths() {
    this.setState({
      columnWidths: [],
      contentWidths: null,
    });
    this.columnHasResized = {};
  }

  resetColumnWidths() {
    this.remeasureColumnWidths();
    this.props.onUpdateVisualizationSettings({
      "table.column_widths": undefined,
    });
  }

  _measure() {
    const {
      data: { cols, rows },
    } = this.props;

    ReactDOM.render(
      <div style={{ display: "flex" }}>
        {cols.map((column, columnIndex) => (
          <div className="fake-column" key={"column-" + columnIndex}>
            {this.tableHeaderRenderer({
              columnIndex,
              rowIndex: 0,
              key: "header",
              style: {},
            })}
            {pickRowsToMeasure(rows, columnIndex).map(rowIndex =>
              this.cellRenderer({
                rowIndex,
                columnIndex,
                key: "row-" + rowIndex,
                style: {},
              }),
            )}
          </div>
        ))}
      </div>,
      this._div,
      () => {
        const contentWidths = [].map.call(
          this._div.getElementsByClassName("fake-column"),
          columnElement => columnElement.offsetWidth,
        );

        const columnWidths: number[] = cols.map((col, index) => {
          if (this.columnNeedsResize) {
            if (
              this.columnNeedsResize[index] &&
              !this.columnHasResized[index]
            ) {
              this.columnHasResized[index] = true;
              return contentWidths[index] + 1; // + 1 to make sure it doen't wrap?
            } else if (this.state.columnWidths[index]) {
              return this.state.columnWidths[index];
            } else {
              return 0;
            }
          } else {
            return contentWidths[index] + 1;
          }
        });

        ReactDOM.unmountComponentAtNode(this._div);

        delete this.columnNeedsResize;

        this.setState({ contentWidths, columnWidths }, this.recomputeGridSize);
      },
    );
  }

  recomputeGridSize = () => {
    if (this.header && this.grid) {
      this.header.recomputeGridSize();
      this.grid.recomputeGridSize();
    }
  };

  recomputeColumnSizes = _.debounce(() => {
    this.setState({ contentWidths: null });
  }, 100);

  onCellResize(columnIndex: number) {
    this.columnNeedsResize = this.columnNeedsResize || {};
    this.columnNeedsResize[columnIndex] = true;
    this.recomputeColumnSizes();
  }

  onColumnResize(columnIndex: number, width: number) {
    const { settings } = this.props;
    const columnWidthsSetting = settings["table.column_widths"]
      ? settings["table.column_widths"].slice()
      : [];
    columnWidthsSetting[columnIndex] = Math.max(MIN_COLUMN_WIDTH, width);
    this.props.onUpdateVisualizationSettings({
      "table.column_widths": columnWidthsSetting,
    });
    setTimeout(() => this.recomputeGridSize(), 1);
  }

  onColumnReorder(columnIndex: number, newColumnIndex: number) {
    const { settings, onUpdateVisualizationSettings } = this.props;
    const columns = settings["table.columns"].slice(); // copy since splice mutates
    columns.splice(newColumnIndex, 0, columns.splice(columnIndex, 1)[0]);
    onUpdateVisualizationSettings({
      "table.columns": columns,
    });
  }

  onVisualizationClick(clicked: ?ClickObject, element: HTMLElement) {
    const { onVisualizationClick } = this.props;
    if (this.visualizationIsClickable(clicked)) {
      onVisualizationClick({ ...clicked, element });
    }
  }

  getCellClickedObject(rowIndex, columnIndex) {
    try {
      return this._getCellClickedObjectCached(
        this.props.data,
        rowIndex,
        columnIndex,
        this.props.isPivoted,
      );
    } catch (e) {
      console.error(e);
    }
  }
  @memoize
  _getCellClickedObjectCached(data, rowIndex, columnIndex, isPivoted) {
    return getTableCellClickedObject(data, rowIndex, columnIndex, isPivoted);
  }

  getHeaderClickedObject(columnIndex) {
    try {
      return this._getHeaderClickedObjectCached(
        this.props.data,
        columnIndex,
        this.props.isPivoted,
      );
    } catch (e) {
      console.error(e);
    }
  }
  @memoize
  _getHeaderClickedObjectCached(data, columnIndex, isPivoted) {
    return getTableHeaderClickedObject(data, columnIndex, isPivoted);
  }

  visualizationIsClickable(clicked) {
    try {
      const { onVisualizationClick, visualizationIsClickable } = this.props;
      const { dragColIndex } = this.state;
      if (
        // don't bother calling if we're dragging, etc
        dragColIndex == null &&
        onVisualizationClick &&
        visualizationIsClickable
      ) {
        return this._visualizationIsClickableCached(
          visualizationIsClickable,
          clicked,
        );
      }
    } catch (e) {
      console.error(e);
    }
  }
  @memoize
  _visualizationIsClickableCached(visualizationIsClickable, clicked) {
    return visualizationIsClickable(clicked);
  }

  @memoize
  getCellBackgroundColor(settings, rowIndex, columnIndex) {
    try {
      return settings["table._cell_background_getter"](rowIndex, columnIndex);
    } catch (e) {
      console.error(e);
    }
  }

  @memoize
  getCellFormattedValue(value, columnSettings) {
    try {
      return formatValue(value, {
        ...columnSettings,
        type: "cell",
        jsx: true,
        rich: true,
      });
    } catch (e) {
      console.error(e);
    }
  }

  cellRenderer = ({ key, style, rowIndex, columnIndex }: CellRendererProps) => {
    const { data, settings } = this.props;
    const { dragColIndex } = this.state;
    const { rows, cols } = data;

    const column = cols[columnIndex];
    const row = rows[rowIndex];
    const value = row[columnIndex];

    const clicked = this.getCellClickedObject(rowIndex, columnIndex);
    const isClickable = this.visualizationIsClickable(clicked);
    const backgroundColor = this.getCellBackgroundColor(
      settings,
      rowIndex,
      columnIndex,
    );

    const columnSettings = settings.column(column);

    return (
      <div
        key={key}
        style={{
          ...style,
          // use computed left if dragging
          left: this.getColumnLeft(style, columnIndex),
          // add a transition while dragging column
          transition: dragColIndex != null ? "left 200ms" : null,
          backgroundColor,
        }}
        className={cx("TableInteractive-cellWrapper text-dark", {
          "TableInteractive-cellWrapper--firstColumn": columnIndex === 0,
          "TableInteractive-cellWrapper--lastColumn":
            columnIndex === cols.length - 1,
          "TableInteractive-emptyCell": value == null,
          "cursor-pointer": isClickable,
          "justify-end": isColumnRightAligned(column),
          "Table-ID": value != null && isID(column),
          "Table-FK": value != null && isFK(column),
          link: isClickable && isID(column),
        })}
        onMouseUp={
          isClickable
            ? e => {
                this.onVisualizationClick(clicked, e.currentTarget);
              }
            : undefined
        }
      >
        {this.props.renderTableCellWrapper(
          columnSettings["show_mini_bar"] ? (
            <MiniBar
              value={value}
              options={columnSettings}
              extent={getColumnExtent(data.cols, data.rows, columnIndex)}
              cellHeight={ROW_HEIGHT}
            />
          ) : (
            this.getCellFormattedValue(value, columnSettings)
            /* using formatValue instead of <Value> here for performance. The later wraps in an extra <span> */
          ),
        )}
      </div>
    );
  };

  getDragColNewIndex(data: { x: number }) {
    const { columnPositions, dragColNewIndex, dragColStyle } = this.state;
    if (dragColStyle) {
      if (data.x < 0) {
        const left = dragColStyle.left + data.x;
        const index = _.findIndex(columnPositions, p => left < p.center);
        if (index >= 0) {
          return index;
        }
      } else if (data.x > 0) {
        const right = dragColStyle.left + dragColStyle.width + data.x;
        const index = _.findLastIndex(columnPositions, p => right > p.center);
        if (index >= 0) {
          return index;
        }
      }
    }
    return dragColNewIndex;
  }

  getColumnPositions() {
    let left = 0;
    return this.props.data.cols.map((col, index) => {
      const width = this.getColumnWidth({ index });
      const pos = {
        left,
        right: left + width,
        center: left + width / 2,
        width,
      };
      left += width;
      return pos;
    });
  }

  getNewColumnLefts(dragColNewIndex: number) {
    const { dragColIndex, columnPositions } = this.state;
    const { cols } = this.props.data;
    const indexes = cols.map((col, index) => index);
    indexes.splice(dragColNewIndex, 0, indexes.splice(dragColIndex, 1)[0]);
    let left = 0;
    const lefts = indexes.map(index => {
      const thisLeft = left;
      // $FlowFixMe: we know columnPositions[index] isn't null because onDrag is called after onStart
      left += columnPositions[index].width;
      return { index, left: thisLeft };
    });
    lefts.sort((a, b) => a.index - b.index);
    return lefts.map(p => p.left);
  }

  getColumnLeft(style: any, index: number) {
    const { dragColNewIndex, dragColNewLefts } = this.state;
    if (dragColNewIndex != null && dragColNewLefts) {
      return dragColNewLefts[index];
    }
    return style.left;
  }

  tableHeaderRenderer = ({ key, style, columnIndex }: CellRendererProps) => {
    const {
      data,
      sort,
      isPivoted,
      getColumnTitle,
      renderTableHeaderWrapper,
    } = this.props;
    const { dragColIndex } = this.state;
    const { cols } = data;
    const column = cols[columnIndex];

    const columnTitle = getColumnTitle(columnIndex);

    const clicked = this.getHeaderClickedObject(columnIndex);

    const isDraggable = !isPivoted;
    const isDragging = dragColIndex === columnIndex;
    const isClickable = this.visualizationIsClickable(clicked);
    const isSortable = isClickable && column.source;
    const isRightAligned = isColumnRightAligned(column);

    // TODO MBQL: use query lib to get the sort field
    const fieldRef = fieldRefForColumn(column, cols);
    const sortIndex = _.findIndex(
      sort,
      sort => sort[1] && Dimension.isEqual(sort[1], fieldRef),
    );
    const isSorted = sortIndex >= 0;
    const isAscending = isSorted && sort[sortIndex][0] === "asc";

    return (
      <Draggable
        /* needs to be index+name+counter so Draggable resets after each drag */
        key={columnIndex + column.name + DRAG_COUNTER}
        axis="x"
        disabled={!isDraggable}
        onStart={(e, d) => {
          this.setState({
            columnPositions: this.getColumnPositions(),
            dragColIndex: columnIndex,
            dragColStyle: style,
            dragColNewIndex: columnIndex,
          });
        }}
        onDrag={(e, data) => {
          const newIndex = this.getDragColNewIndex(data);
          if (newIndex != null && newIndex !== this.state.dragColNewIndex) {
            this.setState({
              dragColNewIndex: newIndex,
              dragColNewLefts: this.getNewColumnLefts(newIndex),
            });
          }
        }}
        onStop={(e, d) => {
          const { dragColIndex, dragColNewIndex } = this.state;
          DRAG_COUNTER++;
          if (
            dragColIndex != null &&
            dragColNewIndex != null &&
            dragColIndex !== dragColNewIndex
          ) {
            this.onColumnReorder(dragColIndex, dragColNewIndex);
          } else if (Math.abs(d.x) + Math.abs(d.y) < HEADER_DRAG_THRESHOLD) {
            // in setTimeout since headers will be rerendered due to DRAG_COUNTER changing
            setTimeout(() => {
              this.onVisualizationClick(clicked, this.headerRefs[columnIndex]);
            });
          }
          this.setState({
            columnPositions: null,
            dragColIndex: null,
            dragColStyle: null,
            dragColNewIndex: null,
            dragColNewLefts: null,
          });
        }}
      >
        <div
          ref={e => (this.headerRefs[columnIndex] = e)}
          style={{
            ...style,
            overflow: "visible" /* ensure resize handle is visible */,
            // use computed left if dragging, except for the dragged header
            left: isDragging
              ? style.left
              : this.getColumnLeft(style, columnIndex),
          }}
          className={cx(
            "TableInteractive-cellWrapper TableInteractive-headerCellData text-medium text-brand-hover",
            {
              "TableInteractive-cellWrapper--firstColumn": columnIndex === 0,
              "TableInteractive-cellWrapper--lastColumn":
                columnIndex === cols.length - 1,
              "TableInteractive-cellWrapper--active": isDragging,
              "TableInteractive-headerCellData--sorted": isSorted,
              "cursor-pointer": isClickable,
              "justify-end": isRightAligned,
            },
          )}
          onClick={
            // only use the onClick if not draggable since it's also handled in Draggable's onStop
            isClickable && !isDraggable
              ? e => {
                  this.onVisualizationClick(clicked, e.currentTarget);
                }
              : undefined
          }
        >
          {renderTableHeaderWrapper(
            <Ellipsified tooltip={columnTitle}>
              {isSortable && isRightAligned && (
                <Icon
                  className="Icon mr1"
                  name={isAscending ? "chevronup" : "chevrondown"}
                  size={8}
                />
              )}
              {columnTitle}
              {isSortable && !isRightAligned && (
                <Icon
                  className="Icon ml1"
                  name={isAscending ? "chevronup" : "chevrondown"}
                  size={8}
                />
              )}
            </Ellipsified>,
            column,
            columnIndex,
          )}
          <Draggable
            axis="x"
            bounds={{ left: RESIZE_HANDLE_WIDTH }}
            position={{ x: this.getColumnWidth({ index: columnIndex }), y: 0 }}
            onStart={e => {
              e.stopPropagation();
              this.setState({ dragColIndex: columnIndex });
            }}
            onStop={(e, { x }) => {
              // prevent onVisualizationClick from being fired
              e.stopPropagation();
              this.onColumnResize(columnIndex, x);
              this.setState({ dragColIndex: null });
            }}
          >
            <div
              className="bg-brand-hover bg-brand-active"
              style={{
                zIndex: 99,
                position: "absolute",
                width: RESIZE_HANDLE_WIDTH,
                top: 0,
                bottom: 0,
                left: -RESIZE_HANDLE_WIDTH - 1,
                cursor: "ew-resize",
              }}
            />
          </Draggable>
        </div>
      </Draggable>
    );
  };

  getColumnWidth = ({ index }: { index: number }) => {
    const { settings } = this.props;
    const { columnWidths } = this.state;
    const columnWidthsSetting = settings["table.column_widths"] || [];
    return (
      columnWidthsSetting[index] || columnWidths[index] || MIN_COLUMN_WIDTH
    );
  };

  handleOnMouseEnter = () => {
    // prevent touchpad gestures from navigating forward/back if you're expecting to just scroll the table
    // https://stackoverflow.com/a/50846937
    // $FlowFixMe: overscrollBehaviorX
    this._previousOverscrollBehaviorX = document.body.style.overscrollBehaviorX;
    // $FlowFixMe: overscrollBehaviorX
    document.body.style.overscrollBehaviorX = "none";
  };
  handleOnMouseLeave = () => {
    // $FlowFixMe: overscrollBehaviorX
    document.body.style.overscrollBehaviorX = this._previousOverscrollBehaviorX;
  };

  render() {
    const {
      width,
      height,
      data: { cols, rows },
      className,
    } = this.props;

    if (!width || !height) {
      return <div className={className} />;
    }

    const headerHeight = this.props.tableHeaderHeight || HEADER_HEIGHT;

    return (
      <ScrollSync>
        {({ onScroll, scrollLeft, scrollTop }) => (
          <div
            className={cx(className, "TableInteractive relative", {
              "TableInteractive--pivot": this.props.isPivoted,
              "TableInteractive--ready": this.state.contentWidths,
              // no hover if we're dragging a column
              "TableInteractive--noHover": this.state.dragColIndex != null,
            })}
            onMouseEnter={this.handleOnMouseEnter}
            onMouseLeave={this.handleOnMouseLeave}
          >
            <canvas
              className="spread"
              style={{ pointerEvents: "none", zIndex: 999 }}
              width={width}
              height={height}
            />
            <Grid
              ref={ref => (this.header = ref)}
              style={{
                top: 0,
                left: 0,
                right: 0,
                height: headerHeight,
                position: "absolute",
                overflow: "hidden",
              }}
              className="TableInteractive-header scroll-hide-all"
              width={width || 0}
              height={headerHeight}
              rowCount={1}
              rowHeight={headerHeight}
              // HACK: there might be a better way to do this, but add a phantom padding cell at the end to ensure scroll stays synced if main content scrollbars are visible
              columnCount={cols.length + 1}
              columnWidth={props =>
                props.index < cols.length ? this.getColumnWidth(props) : 50
              }
              cellRenderer={props =>
                props.columnIndex < cols.length
                  ? this.tableHeaderRenderer(props)
                  : null
              }
              onScroll={({ scrollLeft }) => onScroll({ scrollLeft })}
              scrollLeft={scrollLeft}
              tabIndex={null}
            />
            <Grid
              ref={ref => (this.grid = ref)}
              style={{
                top: headerHeight,
                left: 0,
                right: 0,
                bottom: 0,
                position: "absolute",
              }}
              className=""
              width={width}
              height={height - headerHeight}
              columnCount={cols.length}
              columnWidth={this.getColumnWidth}
              rowCount={rows.length}
              rowHeight={ROW_HEIGHT}
              cellRenderer={this.cellRenderer}
              onScroll={({ scrollLeft }) => {
                this.props.onActionDismissal();
                return onScroll({ scrollLeft });
              }}
              scrollLeft={scrollLeft}
              tabIndex={null}
              overscanRowCount={20}
            />
          </div>
        )}
      </ScrollSync>
    );
  }

  _benchmark() {
    const grid = ReactDOM.findDOMNode(this.grid);
    const height = grid.scrollHeight;
    console.log("height", height);
    let top = 0;
    let start = Date.now();
    // console.profile();
    function next() {
      grid.scrollTop = top;

      setTimeout(() => {
        const end = Date.now();
        console.log(end - start);
        start = end;

        top += height / 10;
        if (top < height - height / 10) {
          next();
        } else {
          // console.profileEnd();
        }
      }, 40);
    }
    next();
  }
}
