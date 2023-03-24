import React, { useCallback } from "react";
import { useAsyncFn } from "react-use";
import { jt, t } from "ttag";
import { MetabotApi } from "metabase/services";
import { User } from "metabase-types/api";
import { fillQuestionTemplateTags } from "metabase/metabot/utils/question";
import Question from "metabase-lib/Question";
import MetabotEmptyState from "../MetabotEmptyState";
import MetabotGreeting from "../MetabotGreeting";
import MetabotPrompt from "../MetabotPrompt";
import MetabotQueryBuilder from "../MetabotQueryBuilder";
import ModelLink from "../ModelLink";
import { MetabotHeader, MetabotRoot } from "../MetabotLayout";

interface ModelMetabotProps {
  model: Question;
  user?: User;
}

const ModelMetabot = ({ model, user }: ModelMetabotProps) => {
  const [{ value, loading }, run] = useAsyncFn(getQuestionAndResults);

  const handleRun = useCallback(
    (query: string) => {
      run(model, query);
    },
    [model, run],
  );

  return (
    <MetabotRoot>
      <MetabotHeader>
        <MetabotGreeting>{getGreetingMessage(model, user)}</MetabotGreeting>
        <MetabotPrompt
          user={user}
          placeholder={gePromptPlaceholder(model)}
          isRunning={loading}
          onRun={handleRun}
        />
      </MetabotHeader>
      {value ? (
        <MetabotQueryBuilder
          question={value.question}
          results={value.results}
        />
      ) : (
        <MetabotEmptyState />
      )}
    </MetabotRoot>
  );
};

const getGreetingMessage = (model: Question, user?: User) => {
  const link = <ModelLink model={model} />;
  const name = user?.first_name;

  return name
    ? jt`What do you want to know about ${link}, ${name}?`
    : jt`What do you want to know about ${link}?`;
};

const gePromptPlaceholder = (model: Question) => {
  return t`Ask something like, how many ${model.displayName()} have we had over time?`;
};

const getQuestionAndResults = async (model: Question, query: string) => {
  const card = await MetabotApi.modelPrompt({
    modelId: model.id(),
    question: query,
  });
  const question = fillQuestionTemplateTags(
    new Question(card, model.metadata()),
  );
  const results = await question.apiGetResults();

  return { question, results };
};

export default ModelMetabot;
