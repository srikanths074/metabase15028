import { useState } from "react";

import {
  SummarizeContent,
  useSummarizeQuery,
} from "metabase/query_builder/components/view/sidebars/SummarizeSidebar/SummarizeContent";
import { Button, Stack } from "metabase/ui";
import type * as Lib from "metabase-lib";
import type Question from "metabase-lib/v1/Question";

import { useInteractiveQuestionData } from "../hooks";

export const Summarize = ({
  onApply = () => {},
  onClose,
}: {
  onApply?: () => void;
  onClose?: () => void;
}) => {
  const { onQueryChange, question } = useInteractiveQuestionData();

  const [query, setQuery] = useState<Lib.Query>();

  const onApplyFilter = () => {
    if (query) {
      onQueryChange(query);
      onApply();
    }
  };

  return (
    question && (
      <Stack>
        <SummarizeInner
          question={question}
          onQueryChange={setQuery}
          onClose={onClose}
        />
        <Button onClick={onApplyFilter}>Apply</Button>
      </Stack>
    )
  );
};

const SummarizeInner = ({
  question,
  onQueryChange,
  onClose,
}: {
  question: Question;
  onQueryChange: (query: Lib.Query) => void;
  onClose?: () => void;
}) => {
  const {
    aggregations,
    handleAddAggregations,
    handleAddBreakout,
    handleRemoveAggregation,
    handleRemoveBreakout,
    handleReplaceBreakouts,
    handleUpdateAggregation,
    handleUpdateBreakout,
    hasAggregations,
    query,
  } = useSummarizeQuery(question.query(), onQueryChange);

  return (
    <Stack>
      <Button onClick={onClose}>Close</Button>
      <SummarizeContent
        query={query}
        aggregations={aggregations}
        hasAggregations={hasAggregations}
        onAddAggregations={handleAddAggregations}
        onUpdateAggregation={handleUpdateAggregation}
        onRemoveAggregation={handleRemoveAggregation}
        onAddBreakout={handleAddBreakout}
        onUpdateBreakout={handleUpdateBreakout}
        onRemoveBreakout={handleRemoveBreakout}
        onReplaceBreakouts={handleReplaceBreakouts}
      />
    </Stack>
  );
};
