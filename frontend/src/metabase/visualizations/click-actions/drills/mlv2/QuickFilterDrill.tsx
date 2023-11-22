import { t } from "ttag";
import type {
  ClickAction,
  Drill,
} from "metabase/visualizations/types/click-actions";
import * as Lib from "metabase-lib";
import type Question from "metabase-lib/Question";
import { getFilterPopover } from "./utils";

export const QuickFilterDrill: Drill<Lib.QuickFilterDrillThruInfo> = ({
  question,
  drill,
  drillDisplayInfo,
  applyDrill,
}) => {
  const { operators } = drillDisplayInfo;
  const drillInfo = Lib.quickFilterDrillDetails(drill);
  const columnInfo = Lib.displayInfo(drillInfo.query, -1, drillInfo.column);

  return operators.map(operator =>
    getClickAction(
      question,
      drill,
      drillInfo,
      columnInfo,
      operator,
      applyDrill,
    ),
  );
};

function getClickAction(
  question: Question,
  drill: Lib.DrillThru,
  { query, column, value }: Lib.QuickFilterDrillThruDetails,
  columnInfo: Lib.ColumnDisplayInfo,
  operator: Lib.QuickFilterDrillThruOperator,
  applyDrill: (
    drill: Lib.DrillThru,
    operator: Lib.QuickFilterDrillThruOperator,
  ) => Question,
): ClickAction {
  const defaultAction: ClickAction = {
    name: operator,
    title: operator,
    section: "filter",
    sectionDirection: "row",
    buttonType: "token-filter",
    question: () => applyDrill(drill, operator),
  };

  if (Lib.isDate(column) && value != null) {
    const dateAction: ClickAction = {
      ...defaultAction,
      sectionTitle: t`Filter by this date`,
      sectionDirection: "column",
      buttonType: "horizontal",
    };

    switch (operator) {
      case "=":
        return {
          ...dateAction,
          title: t`On`,
        };
      case "≠":
        return {
          ...dateAction,
          title: t`Not on`,
        };
      case ">":
        return {
          ...dateAction,
          title: t`After`,
        };
      case "<":
        return {
          ...dateAction,
          title: t`Before`,
        };
      default:
        return dateAction;
    }
  }

  if (Lib.isString(column) && typeof value === "string") {
    const stringAction: ClickAction = {
      ...defaultAction,
      sectionTitle: t`Filter by ${columnInfo.displayName}`,
      sectionDirection: "column",
      buttonType: "horizontal",
    };
    const valueTitle = getTextValueTitle(value);

    switch (operator) {
      case "=":
        return {
          ...stringAction,
          title: t`Is ${valueTitle}`,
          iconText: operator,
        };
      case "≠":
        return {
          ...stringAction,
          title: t`Is not ${valueTitle}`,
          iconText: operator,
        };
      case "contains": {
        return {
          ...stringAction,
          title: `Contains…`,
          popover: getFilterPopover({ question, query, column }),
        };
      }
      case "does-not-contain": {
        return {
          ...stringAction,
          title: `Does not contain…`,
          popover: getFilterPopover({ question, query, column }),
        };
      }
      default:
        return stringAction;
    }
  }

  return defaultAction;
}

const getTextValueTitle = (value: string): string => {
  if (value.length === 0) {
    return t`empty`;
  }

  if (value.length > 20) {
    return t`this`;
  }

  return value;
};
