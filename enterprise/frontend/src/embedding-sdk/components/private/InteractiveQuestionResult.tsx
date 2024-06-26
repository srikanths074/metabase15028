import cx from "classnames";
import type { ReactElement, ReactNode } from "react";
import { t } from "ttag";

import {
  SdkError,
  SdkLoader,
} from "embedding-sdk/components/private/PublicComponentWrapper";
import {
  QuestionBackButton,
  FilterBar,
  QuestionResetButton,
  Title,
  Filter,
  FilterButton,
  Summarize,
  SummarizeButton,
  Notebook,
  NotebookButton,
} from "embedding-sdk/components/public/InteractiveQuestion";
import { useInteractiveQuestionContext } from "embedding-sdk/components/public/InteractiveQuestion/context/context";
import CS from "metabase/css/core/index.css";
import { Box, Flex, Group, Stack } from "metabase/ui";

import { QuestionVisualization } from "../public/InteractiveQuestion/components";

interface InteractiveQuestionResultProps {
  withTitle?: boolean;
  customTitle?: ReactNode;
  height?: string | number;
}

export const InteractiveQuestionResult = ({
  height,
}: InteractiveQuestionResultProps): ReactElement => {
  const {
    defaultHeight,
    isQueryRunning,
    isQuestionLoading,
    queryResults,
    question,
    isFilterOpen,
    isSummarizeOpen,
    isNotebookOpen,
  } = useInteractiveQuestionContext();

  if (isQuestionLoading || isQueryRunning) {
    return <SdkLoader />;
  }

  if (!question || !queryResults) {
    return <SdkError message={t`Question not found`} />;
  }

  if (isFilterOpen) {
    return <Filter />;
  }

  if (isSummarizeOpen) {
    return <Summarize />;
  }

  if (isNotebookOpen) {
    return <Notebook />;
  }

  return (
    <Box
      className={cx(CS.flexFull, CS.fullWidth)}
      h={height ?? defaultHeight}
      bg="var(--mb-color-bg-question)"
    >
      <Stack h="100%">
        <Flex direction="row" gap="md" px="md" align="center">
          <QuestionBackButton />
          <Title />
          <QuestionResetButton />
          <FilterButton />
          <SummarizeButton />
          <NotebookButton />
        </Flex>

        <FilterBar />

        <Group h="100%" pos="relative" align="flex-start">
          <QuestionVisualization />
        </Group>
      </Stack>
    </Box>
  );
};
