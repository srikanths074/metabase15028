import { useCallback } from "react";
import { t } from "ttag";
import _ from "underscore";
import { DndContext, useSensor, PointerSensor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  verticalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { uuid } from "metabase/lib/utils";
import { Sortable } from "metabase/core/components/Sortable";
import { Stack } from "metabase/ui";
import type { DatasetColumn, SmartScalarComparison } from "metabase-types/api";
import { COMPARISON_TYPES } from "../constants";
import type { ComparisonMenuOption } from "../types";
import { ComparisonPicker } from "./ComparisonPicker";
import {
  AddComparisonButton,
  ComparisonList,
} from "./SmartScalarSettingsWidgets.styled";

type SmartScalarComparisonWidgetProps = {
  onChange: (setting: SmartScalarComparison[]) => void;
  options: ComparisonMenuOption[];
  comparableColumns: DatasetColumn[];
  value: SmartScalarComparison[];
  maxComparisons: number;
};

export function SmartScalarComparisonWidget({
  value,
  maxComparisons,
  onChange,
  ...props
}: SmartScalarComparisonWidgetProps) {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });

  const canAddComparison = value.length < maxComparisons;
  const canRemoveComparison = value.length > 1;

  const handleAddComparison = useCallback(() => {
    const comparison = { id: uuid(), type: COMPARISON_TYPES.PREVIOUS_PERIOD };
    onChange([...value, comparison]);
  }, [value, onChange]);

  const handleChangeComparison = useCallback(
    (comparison: SmartScalarComparison) => {
      const nextValue = value.map(item =>
        item.id === comparison.id ? comparison : item,
      );
      onChange(nextValue);
    },
    [value, onChange],
  );

  const handleRemoveComparison = useCallback(
    (comparison: SmartScalarComparison) => {
      const nextValue = value.filter(item => item.id !== comparison.id);
      onChange(nextValue);
    },
    [value, onChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = event.active.id;
      const overId = event.over?.id;
      if (typeof activeId === "string" && typeof overId === "string") {
        const activeIndex = value.findIndex(({ id }) => id === activeId);
        const overIndex = value.findIndex(({ id }) => id === overId);
        const nextValue = arrayMove(value, activeIndex, overIndex);
        onChange(nextValue);
      }
    },
    [value, onChange],
  );

  return (
    <Stack>
      <DndContext
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        sensors={[pointerSensor]}
      >
        <SortableContext items={value} strategy={verticalListSortingStrategy}>
          <ComparisonList data-testid="comparison-list">
            {value.map(comparison => (
              <Sortable as="li" key={comparison.id} id={comparison.id}>
                <ComparisonPicker
                  {...props}
                  value={comparison}
                  isRemovable={canRemoveComparison}
                  onChange={handleChangeComparison}
                  onRemove={() => handleRemoveComparison(comparison)}
                />
              </Sortable>
            ))}
          </ComparisonList>
        </SortableContext>
      </DndContext>
      <AddComparisonButton
        disabled={!canAddComparison}
        onClick={handleAddComparison}
      >{t`Add comparison`}</AddComparisonButton>
    </Stack>
  );
}
