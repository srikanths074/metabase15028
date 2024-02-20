import { t } from "ttag";

import TippyPopoverWithTrigger from "metabase/components/PopoverWithTrigger/TippyPopoverWithTrigger";
import Tooltip from "metabase/core/components/Tooltip";
import * as Lib from "metabase-lib";

import { AggregationPicker } from "../SummarizeSidebar.styled";

import { AddAggregationButtonRoot } from "./AddAggregationButton.styled";

const STAGE_INDEX = -1;

interface AddAggregationButtonProps {
  query: Lib.Query;
  onAddAggregation: (aggregation: Lib.Aggregable) => void;
}

export function AddAggregationButton({
  query,
  onAddAggregation,
}: AddAggregationButtonProps) {
  const hasAggregations = Lib.aggregations(query, STAGE_INDEX).length > 0;
  const operators = Lib.availableAggregationOperators(query, STAGE_INDEX);

  return (
    <TippyPopoverWithTrigger
      renderTrigger={({ onClick }) => (
        <div>
          <Tooltip tooltip={t`Add a metric`} isEnabled={hasAggregations}>
            <AddAggregationButtonRoot
              icon="add"
              borderless
              onlyIcon={hasAggregations}
              onClick={onClick}
              aria-label={t`Add aggregation`}
              data-testid="add-aggregation-button"
            >
              {hasAggregations ? null : t`Add a metric`}
            </AddAggregationButtonRoot>
          </Tooltip>
        </div>
      )}
      popoverContent={({ closePopover }) => (
        <AggregationPicker
          query={query}
          stageIndex={STAGE_INDEX}
          operators={operators}
          hasExpressionInput={false}
          onSelect={aggregation => {
            onAddAggregation(aggregation);
            closePopover();
          }}
        />
      )}
    />
  );
}
