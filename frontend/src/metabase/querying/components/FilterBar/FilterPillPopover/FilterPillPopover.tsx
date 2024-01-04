import { useMemo, useState } from "react";
import * as Lib from "metabase-lib";
import { Popover } from "metabase/ui";
import { FilterPicker } from "../../FilterPicker";
import { FilterPill } from "../FilterPill";

interface FilterPillPopoverProps {
  query: Lib.Query;
  stageIndex: number;
  filter: Lib.FilterClause;
  onChange: (query: Lib.Query) => void;
}

export function FilterPillPopover({
  query,
  stageIndex,
  filter,
  onChange,
}: FilterPillPopoverProps) {
  const [isOpened, setIsOpened] = useState(false);

  const filterInfo = useMemo(
    () => Lib.displayInfo(query, stageIndex, filter),
    [query, stageIndex, filter],
  );

  const handleChange = (newFilter: Lib.Clause | Lib.SegmentMetadata) => {
    onChange(Lib.replaceClause(query, stageIndex, filter, newFilter));
    setIsOpened(false);
  };

  const handleRemove = () => {
    onChange(Lib.removeClause(query, stageIndex, filter));
    setIsOpened(false);
  };

  return (
    <Popover opened={isOpened} position="bottom-start" onChange={setIsOpened}>
      <Popover.Target>
        <FilterPill
          onClick={() => setIsOpened(!isOpened)}
          onRemoveClick={handleRemove}
        >
          {filterInfo.displayName}
        </FilterPill>
      </Popover.Target>
      <Popover.Dropdown>
        <FilterPicker
          query={query}
          stageIndex={stageIndex}
          filter={filter}
          onSelect={handleChange}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
