import React, { useMemo, useCallback } from "react";
import { t } from "ttag";
import _ from "underscore";

import type {
  DashboardOrderedCard,
  ClickBehavior,
  ClickBehaviorType,
} from "metabase-types/api";
import type { Column as IColumn } from "metabase-types/types/Dataset";

import { hasActionsMenu } from "metabase/lib/click-behavior";
import Column from "./Column";

const COLUMN_SORTING_ORDER_BY_CLICK_BEHAVIOR_TYPE = [
  "link",
  "crossfilter",
  "actionMenu",
];

function explainClickBehaviorType(
  type: ClickBehaviorType,
  dashcard: DashboardOrderedCard,
) {
  return {
    action: t`Execute an action`,
    actionMenu: hasActionsMenu(dashcard)
      ? t`Open the actions menu`
      : t`Do nothing`,
    crossfilter: t`Update a dashboard filter`,
    link: t`Go to custom destination`,
  }[type];
}

interface Props {
  columns: IColumn[];
  dashcard: DashboardOrderedCard;
  getClickBehaviorForColumn: (column: IColumn) => ClickBehavior | undefined;
  onColumnClick: (column: IColumn) => void;
}

function TableClickBehaviorView({
  columns,
  dashcard,
  getClickBehaviorForColumn,
  onColumnClick,
}: Props) {
  const groupedColumns = useMemo(() => {
    const withClickBehaviors = columns.map(column => ({
      column,
      clickBehavior: getClickBehaviorForColumn(column),
    }));
    const groupedByClickBehavior = _.groupBy(
      withClickBehaviors,
      ({ clickBehavior }) => {
        return clickBehavior?.type || "actionMenu";
      },
    );

    const pairs = _.pairs(groupedByClickBehavior);
    return _.sortBy(pairs, ([type]) =>
      COLUMN_SORTING_ORDER_BY_CLICK_BEHAVIOR_TYPE.indexOf(type),
    );
  }, [columns, getClickBehaviorForColumn]);

  const renderColumn = useCallback(
    ({ column, clickBehavior }, index) => {
      return (
        <Column
          key={index}
          column={column}
          clickBehavior={clickBehavior}
          onClick={() => onColumnClick(column)}
        />
      );
    },
    [onColumnClick],
  );

  const renderColumnGroup = useCallback(
    group => {
      const [clickBehaviorType, columnsWithClickBehavior] = group;
      return (
        <div key={clickBehaviorType} className="mb2 px4">
          <h5 className="text-uppercase text-medium my1">
            {explainClickBehaviorType(clickBehaviorType, dashcard)}
          </h5>
          {columnsWithClickBehavior.map(renderColumn)}
        </div>
      );
    },
    [dashcard, renderColumn],
  );

  return <>{groupedColumns.map(renderColumnGroup)}</>;
}

export default TableClickBehaviorView;
