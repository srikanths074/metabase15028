/* @flow */

import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import { t } from "c-3po";
import "./TableInteractive.css";

import Icon from "metabase/components/Icon.jsx";

import { formatValue, formatColumn } from "metabase/lib/formatting";
import { isID } from "metabase/lib/schema_metadata";
import {
  getTableCellClickedObjectForSummary,
  isColumnRightAligned,
} from "metabase/visualizations/lib/table";

import _ from "underscore";
import cx from "classnames";

import ExplicitSize from "metabase/components/ExplicitSize.jsx";

// $FlowFixMe: had to ignore react-virtualized in flow, probably due to different version
import { Grid, ScrollSync, defaultCellRangeRenderer } from "react-virtualized";
import Draggable from "react-draggable";

const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 30;
const MIN_COLUMN_WIDTH = ROW_HEIGHT;
const RESIZE_HANDLE_WIDTH = 5;

import type { VisualizationProps } from "metabase/meta/types/Visualization";
import type { Row, Column } from "metabase/meta/types/Dataset";
import orderBy from "lodash.orderby";
import set from "lodash.set";
import flatMap from "lodash.flatmap";

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
};

type CellRendererProps = {
  key: string,
  style: { [key: string]: any },
  columnIndex: number,
  rowIndex: number,
};

type CellRangeProps = {
  visibleRowIndices: Range,
  visibleColumnIndices: Range,
};

type Range = { start: Number, stop: Number };

type RenderCellType = {
  row: Row,
  column: Column,
  columnIndex: number,
  visibleRowIndices: Range,
  key: string,
  rowIndex: number,
  isGrandTotal: boolean,
  style: { [key: string]: any },
  onVisualizationClick: Function,
  visualizationIsClickable: Function,
};

type GridComponent = Component<void, void, void> & {
  recomputeGridSize: () => void,
};

@ExplicitSize
export default class TableInteractiveSummary extends Component {
  state: State;
  props: Props;

  columnHasResized: { [key: number]: boolean };
  columnNeedsResize: { [key: number]: boolean };
  _div: HTMLElement;

  header: GridComponent;
  grid: GridComponent;

  constructor(props: Props) {
    super(props);

    this.state = {
      columnWidths: [],
      contentWidths: null,
    };
    this.columnHasResized = {};
  }

  static propTypes = {
    data: PropTypes.object.isRequired,
    sort: PropTypes.array,
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
      JSON.stringify(this.props.data && this.props.data.cols) !==
      JSON.stringify(newProps.data && newProps.data.cols)
    ) {
      this.resetColumnWidths();
    }
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
    }
  }

  resetColumnWidths() {
    this.setState({
      columnWidths: [],
      contentWidths: null,
    });
    this.columnHasResized = {};
    this.props.onUpdateVisualizationSettings({
      "summaryTable.column_widths": undefined,
    });
  }

  _measure = () => {
    let {
      data: { cols, rows, probeRows, probeCols, valueColsLen, columnsHeaders },
    } = this.props;
    //todo: benchmark it
    probeCols = cols;
    valueColsLen = 0;

    const probeHeaders = flatMap(columnsHeaders, row =>
      row.map((header, columnIndex) => header && { ...header, columnIndex }),
    ).filter(p => p);

    ReactDOM.render(
      <div style={{ display: "flex" }}>
        {probeHeaders.map(({ columnIndex, columnSpan, value, column }) => (
          <div
            className="fake-column"
            title={columnIndex + "-" + columnSpan}
            key={Math.random()}
          >
            {this.renderHeader({ style: {}, value, column, columnIndex: 0 })}
          </div>
        ))}
        {probeCols.map((column, columnIndex) => (
          <div
            className="fake-column"
            title={columnIndex + "-" + 1}
            key={Math.random()}
          >
            {probeRows.map(probeRow =>
              this.renderCell(
                probeRow,
                column,
                columnIndex,
                { start: 0, stop: rows.length },
                "key: " + Math.random(),
                0,
                true,
                {},
              ),
            )}
          </div>
        ))}
      </div>,
      this._div,
      () => {
        let contentWidths = [].map.call(
          this._div.getElementsByClassName("fake-column"),
          columnElement => {
            const splittedKey = columnElement.title.split("-");
            const columnIndex = parseInt(splittedKey[0]);
            const columnSpan = parseInt(splittedKey[1]);
            return {
              columnIndex,
              columnSpan,
              offsetWidth: columnElement.offsetWidth,
            };
          },
        );

        contentWidths = orderBy(contentWidths, [
          "columnSpan",
          "columnIndex",
        ]).reduce(computeWidths, []);

        const diff = cols.length - probeCols.length;
        if (diff > 0) {
          const toDuplicate = contentWidths.slice(
            contentWidths.length - valueColsLen,
          );
          contentWidths = [
            ...contentWidths,
            ...Array.from(Array(diff).keys())
              .map(p => p % valueColsLen)
              .map(p => toDuplicate[p]),
          ];
        }

        let columnWidths: number[] = cols.map((col, index) => {
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
  };

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
    let columnWidthsSetting = settings["summaryTable.column_widths"]
      ? settings["summaryTable.column_widths"].slice()
      : [];
    columnWidthsSetting[columnIndex] = Math.max(MIN_COLUMN_WIDTH, width);
    this.props.onUpdateVisualizationSettings({
      "summaryTable.column_widths": columnWidthsSetting,
    });
    setTimeout(() => this.recomputeGridSize(), 1);
  }

  cellRenderer = (
    { visibleRowIndices, visibleColumnIndices, aa }: CellRangeProps,
    { key, style, rowIndex, columnIndex }: CellRendererProps,
  ) => {
    const groupingManager = this.props.data;

    if (!groupingManager.isVisible(rowIndex, columnIndex, visibleRowIndices)) {
      return null;
    }
    const { data, onVisualizationClick, visualizationIsClickable } = this.props;
    const { rows, cols } = data;
    const column = cols[columnIndex];
    const row = rows[rowIndex];
    const isGrandTotal =
      row.isTotalColumnIndex === 0 &&
      groupingManager.rows.length - 1 === rowIndex;
    return this.renderCell(
      row,
      column,
      columnIndex,
      visibleRowIndices,
      key,
      rowIndex,
      isGrandTotal,
      style,
      onVisualizationClick,
      visualizationIsClickable,
    );
  };

  renderCell = (
    row,
    column,
    columnIndex,
    visibleRowIndices,
    key,
    rowIndex,
    isGrandTotal,
    style,
    onVisualizationClick,
    visualizationIsClickable,
  ): (RenderCellType => void) => {
    const groupingManager = this.props.data;
    let value = column.getValue(row);

    const isTotal = row.isTotalColumnIndex === columnIndex + 1;

    let formatedRes = formatValue(value, {
      column: column,
      type: "cell",
      jsx: true,
      rich: true,
      isTotal: isTotal,
    });

    if (isGrandTotal && columnIndex === 0) formatedRes = "Grand totals";

    let mappedStyle = {
      ...groupingManager.mapStyle(
        rowIndex,
        columnIndex,
        visibleRowIndices,
        style,
      ),
    };
    if (isGrandTotal)
      mappedStyle = {
        ...mappedStyle,
        background: "#509ee3",
        color: "white",
        fontWeight: "bold",
      };
    else if (
      row.isTotalColumnIndex &&
      row.isTotalColumnIndex <= columnIndex + 1
    )
      mappedStyle = {
        ...mappedStyle,
        background: "#EDEFF0",
        color: "#6E757C",
        fontWeight: "bold",
      };

    const clicked = getTableCellClickedObjectForSummary(
      this.props.data,
      rowIndex,
      columnIndex,
      false,
    );

    const isClickable =
      onVisualizationClick && visualizationIsClickable(clicked);

    if (isTotal && typeof formatedRes === "string")
      formatedRes = "Totals for " + formatedRes;

    return (
      <div
        key={key}
        style={mappedStyle}
        className={cx("TableInteractive-cellWrapper", {
          "TableInteractive-cellWrapper--firstColumn": columnIndex === 0,
          "TableInteractive-cellWrapper--lastColumn":
            columnIndex === this.props.data.cols.length - 1,
          "cursor-pointer": isClickable,
          "justify-end": isColumnRightAligned(column),
          link: isClickable && isID(column),
        })}
        onMouseUp={
          isClickable
            ? e => {
                onVisualizationClick({ ...clicked, element: e.currentTarget });
              }
            : undefined
        }
      >
        <div className="cellData">
          {/* using formatValue instead of <Value> here for performance. The later wraps in an extra <span> */}
          {formatedRes}
        </div>
      </div>
    );
  };

  tableLowerHeaderRenderer = ({
    key,
    style,
    columnIndex,
    rowIndex,
  }: CellRendererProps) => {
    const { columnsHeaders } = this.props.data;
    const columnHeader = columnsHeaders[rowIndex][columnIndex];
    if(!columnHeader){
      return null;
    }

    return this.renderHeader({ ...columnHeader, key, style, columnIndex});
  };

  renderHeader = ({
    key,
    style,
    column,
    value,
    columnIndex,
    columnSpan,
    displayText
  }: CellRendererProps) => {
    const { sort, onVisualizationClick, visualizationIsClickable } = this.props;

    let columnTitle = displayText || (value || value === 0
      ? formatValue(value, {
          column: column,
          type: "cell",
          jsx: true,
          rich: true,
        })
      : column && formatColumn(column));

    if(columnSpan && columnSpan !== 1)
      style = {...style, width : style.width * columnSpan};
    /*
        if (isPivoted) {
          // if it's a pivot table, the first column is
          if (columnIndex >= 0) {
            clicked = column._dimension;
          }
        } else {
          clicked = { column };
        }
    */
    const isClickable = onVisualizationClick && visualizationIsClickable(null); //clicked
    const isSortable = isClickable && column.source;
    const isRightAligned = isColumnRightAligned(column);

    // the column id is in `["field-id", fieldId]` format
    const isSorted =
      sort && sort[0] && sort[0][0] && sort[0][0][1] === column.id;
    const isAscending = sort && sort[0] && sort[0][1] === "ascending";

    return (
      <div
        key={key}
        style={{
          ...style,
          overflow: "visible" /* ensure resize handle is visible */,
        }}
        className={cx(
          "TableInteractive-cellWrapper TableInteractive-headerCellData",
          {
            "TableInteractive-headerCellData--sorted": isSorted,
            "cursor-pointer": isClickable,
            "justify-end": isRightAligned,
          },
        )}
        // use onMouseUp instead of onClick since we can stopPropation when resizing headers
        onMouseUp={
          isClickable
            ? e => {
                onVisualizationClick({ ...null, element: e.currentTarget }); //clicked
              }
            : undefined
        }
      >
        <div className="cellData">
          {isSortable &&
            isRightAligned && (
              <Icon
                className="Icon mr1"
                name={isAscending ? "chevronup" : "chevrondown"}
                size={8}
              />
            )}
          {columnTitle}
          {isSortable &&
            !isRightAligned && (
              <Icon
                className="Icon ml1"
                name={isAscending ? "chevronup" : "chevrondown"}
                size={8}
              />
            )}
        </div>
        <Draggable
          axis="x"
          bounds={{ left: RESIZE_HANDLE_WIDTH }}
          position={{ x: this.getColumnWidth({ index: columnIndex }), y: 0 }}
          onStop={(e, { x }) => {
            // prevent onVisualizationClick from being fired
            e.stopPropagation();
            this.onColumnResize(columnIndex, x);
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
    );
  };

  getColumnWidth = ({ index }: { index: number }) => {
    const { settings } = this.props;
    const { columnWidths } = this.state;
    const columnWidthsSetting = settings["summaryTable.column_widths"] || [];
    return (
      columnWidthsSetting[index] || columnWidths[index] || MIN_COLUMN_WIDTH
    );
  };

  render() {
    const {
      width,
      height,
      data: { cols, rows, columnsHeaders },
      className,
    } = this.props;
    if (!width || !height) {
      return <div className={className} />;
    }

    const headerHeight = HEADER_HEIGHT * columnsHeaders.length;

    return (
      <ScrollSync>
        {({
          clientHeight,
          clientWidth,
          onScroll,
          scrollHeight,
          scrollLeft,
        }) => (
          <div
            className={cx(className, "TableInteractive relative", {
              "TableInteractive--pivot": this.props.isPivoted,
              "TableInteractive--ready": this.state.contentWidths,
            })}
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
                position: "absolute",
                overflow: "hidden"
              }}
              className="TableInteractive-header scroll-hide-all"
              width={width || 0}
              height={headerHeight}
              rowCount={columnsHeaders.length}
              rowHeight={HEADER_HEIGHT}
              // HACK: there might be a better way to do this, but add a phantom padding cell at the end to ensure scroll stays synced if main content scrollbars are visible
              columnCount={columnsHeaders[0].length + 1}
              columnWidth={props =>
                props.index < cols.length ? this.getColumnWidth(props) : 50
              }
              cellRenderer={props =>
                props.columnIndex < cols.length
                  ? this.tableLowerHeaderRenderer(props)
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
              onScroll={({ scrollLeft }) => {
                this.props.onActionDismissal();
                return onScroll({ scrollLeft });
              }}
              scrollLeft={scrollLeft}
              tabIndex={null}
              overscanRowCount={20}
              cellRenderer={() => {}}
              cellRangeRenderer={rangeArgs =>
                defaultCellRangeRenderer({
                  ...rangeArgs,
                  cellRenderer: renderArgs =>
                    this.cellRenderer(rangeArgs, renderArgs),
                })
              }
            />
          </div>
        )}
      </ScrollSync>
    );
  }
}

const computeWidths = (
  acc: Number[],
  { columnIndex, columnSpan, offsetWidth },
) => {
  if (columnSpan === 1)
    return set(
      acc,
      columnIndex,
      Math.max(offsetWidth, acc[columnIndex] || MIN_COLUMN_WIDTH),
    );

  const subsetToModify = acc
    .slice(columnIndex, columnIndex + columnSpan)
    .map(p => p || MIN_COLUMN_WIDTH);
  const subsetLen = subsetToModify.reduce((acc, elem) => acc + elem, 0);
  if (subsetLen < offsetWidth) {
    const multiplier = offsetWidth / subsetLen;
    subsetToModify
      .map(p => p * multiplier)
      .forEach((newValue, index) => set(acc, columnIndex + index, newValue));
  }

  return acc;
};
