import { useMemo, useState } from "react";
import type {
  DatasetColumn,
  TableColumnOrderSetting,
} from "metabase-types/api";
import type * as Lib from "metabase-lib";
import type Question from "metabase-lib/Question";
import { QueryColumnPicker } from "./QueryColumnPicker";
import { TableColumnPicker } from "./TableColumnPicker";
import { getColumnSettings } from "./utils";
import type { EditWidgetData } from "./types";

interface ChartSettingTableColumnsProps {
  value: TableColumnOrderSetting[];
  columns: DatasetColumn[];
  question: Question;
  getColumnName: (column: DatasetColumn) => string;
  onChange: (value: TableColumnOrderSetting[], question?: Question) => void;
  onShowWidget: (config: EditWidgetData, targetElement: HTMLElement) => void;
}

export const ChartSettingTableColumns = ({
  value,
  columns,
  question,
  getColumnName,
  onChange,
  onShowWidget,
}: ChartSettingTableColumnsProps) => {
  const query = question.query();
  const stageIndex = -1;
  const settings = useMemo(() => getColumnSettings(value), [value]);
  const [isEditingQuery] = useState(true);

  const handleQueryChange = (query: Lib.Query) => {
    onChange(value, question.setQuery(query));
  };

  return isEditingQuery ? (
    <QueryColumnPicker
      query={query}
      stageIndex={stageIndex}
      onChange={handleQueryChange}
    />
  ) : (
    <TableColumnPicker
      query={query}
      stageIndex={stageIndex}
      columns={columns}
      settings={settings}
      getColumnName={getColumnName}
      onChange={onChange}
      onShowWidget={onShowWidget}
    />
  );
};
