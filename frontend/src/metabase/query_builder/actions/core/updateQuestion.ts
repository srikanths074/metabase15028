import _ from "underscore";
import { assocIn } from "icepick";

import { isSupportedTemplateTagForModel } from "metabase/lib/data-modeling/utils";
import {
  getTemplateTagsForParameters,
  getTemplateTagParameters,
} from "metabase/parameters/utils/cards";

import { Dataset } from "metabase-types/api";
import { Series } from "metabase-types/types/Visualization";
import { Dispatch, GetState, QueryBuilderMode } from "metabase-types/store";
import Question from "metabase-lib/lib/Question";
import NativeQuery from "metabase-lib/lib/queries/NativeQuery";
import StructuredQuery from "metabase-lib/lib/queries/StructuredQuery";

import {
  getFirstQueryResult,
  getIsShowingTemplateTagsEditor,
  getQueryBuilderMode,
  getQuestion,
  getRawSeries,
} from "../../selectors";

import { updateUrl } from "../navigation";
import { setIsShowingTemplateTagsEditor } from "../native";
import { runQuestionQuery } from "../querying";
import { onCloseQuestionInfo, setQueryBuilderMode } from "../ui";

import { loadMetadataForCard } from "./metadata";
import { getQuestionWithDefaultVisualizationSettings } from "./utils";

function hasNewColumns(question: Question, queryResult: Dataset) {
  // NOTE: this assume column names will change
  // technically this is wrong because you could add and remove two columns with the same name
  const query = question.query();
  const previousColumns =
    (queryResult && queryResult.data.cols.map(col => col.name)) || [];
  const nextColumns =
    query instanceof StructuredQuery ? query.columnNames() : [];
  return _.difference(nextColumns, previousColumns).length > 0;
}

function checkShouldRerunPivotTableQuestion({
  isPivot,
  wasPivot,
  hasBreakouts,
  currentQuestion,
  newQuestion,
}: {
  isPivot: boolean;
  wasPivot: boolean;
  hasBreakouts: boolean;
  currentQuestion?: Question;
  newQuestion: Question;
}) {
  const isValidPivotTable = isPivot && hasBreakouts;
  const displayChange =
    (!wasPivot && isValidPivotTable) || (wasPivot && !isPivot);

  if (displayChange) {
    return true;
  }

  const currentPivotSettings = currentQuestion?.setting(
    "pivot_table.column_split",
  );
  const newPivotSettings = newQuestion.setting("pivot_table.column_split");
  return (
    isValidPivotTable && !_.isEqual(currentPivotSettings, newPivotSettings)
  );
}

type NextTemplateTagEditorState = "visible" | "hidden" | undefined;

function getNextTemplateTagEditorState({
  currentQuestion,
  newQuestion,
  isVisible,
  queryBuilderMode,
}: {
  currentQuestion?: Question;
  newQuestion: Question;
  isVisible: boolean;
  queryBuilderMode: QueryBuilderMode;
}): NextTemplateTagEditorState {
  const currentQuery = currentQuestion?.query() as NativeQuery;
  const nextQuery = newQuestion.query() as NativeQuery;
  const previousTags = currentQuery.templateTagsWithoutSnippets?.() || [];
  const nextTags = nextQuery.templateTagsWithoutSnippets?.() || [];

  if (nextTags.length > previousTags.length) {
    if (queryBuilderMode !== "dataset") {
      return "visible";
    }
    return nextTags.every(isSupportedTemplateTagForModel)
      ? "visible"
      : "hidden";
  }

  if (nextTags.length === 0 && isVisible) {
    return "hidden";
  }

  return;
}

type UpdateQuestionOpts = {
  run?: boolean | "auto";
  shouldUpdateUrl?: boolean;
  shouldStartAdHocQuestion?: boolean;
};

/**
 * Replaces the currently active question with the given Question object.
 */
export const UPDATE_QUESTION = "metabase/qb/UPDATE_QUESTION";
export const updateQuestion = (
  newQuestion: Question,
  {
    run = false,
    shouldStartAdHocQuestion = true,
    shouldUpdateUrl = false,
  }: UpdateQuestionOpts = {},
) => {
  return async (dispatch: Dispatch, getState: GetState) => {
    const currentQuestion = getQuestion(getState());
    const queryBuilderMode = getQueryBuilderMode(getState());

    const shouldTurnIntoAdHoc =
      shouldStartAdHocQuestion &&
      newQuestion.isSaved() &&
      newQuestion.query().isEditable() &&
      queryBuilderMode !== "dataset";

    if (shouldTurnIntoAdHoc) {
      newQuestion = newQuestion.withoutNameAndId();

      // When the dataset query changes, we should loose the dataset flag,
      // to start building a new ad-hoc question based on a dataset
      if (newQuestion.isDataset()) {
        newQuestion = newQuestion.setDataset(false);
        dispatch(onCloseQuestionInfo());
      }
    }

    // This scenario happens because the DatasetQueryEditor converts the dataset/model question into a normal question
    // so that its query is shown properly in the notebook editor. Various child components of the notebook editor have access to
    // this `updateQuestion` action, so they end up triggering the action with the altered question.
    if (queryBuilderMode === "dataset" && !newQuestion.isDataset()) {
      newQuestion = newQuestion.setDataset(true);
    }

    const queryResult = getFirstQueryResult(getState());
    newQuestion = newQuestion.syncColumnsAndSettings(
      currentQuestion,
      queryResult,
    );

    if (run === "auto") {
      run = hasNewColumns(newQuestion, queryResult);
    }

    if (!newQuestion.canAutoRun()) {
      run = false;
    }

    const isPivot = newQuestion.display() === "pivot";
    const wasPivot = currentQuestion?.display() === "pivot";

    if (wasPivot || isPivot) {
      const hasBreakouts =
        newQuestion.isStructured() &&
        (newQuestion.query() as StructuredQuery).hasBreakouts();

      // compute the pivot setting now so we can query the appropriate data
      if (isPivot && hasBreakouts) {
        const key = "pivot_table.column_split";
        const rawSeries = getRawSeries(getState()) as Series;
        const series = assocIn(rawSeries, [0, "card"], newQuestion.card());
        const setting = getQuestionWithDefaultVisualizationSettings(
          newQuestion,
          series,
        ).setting(key);
        newQuestion = newQuestion.updateSettings({ [key]: setting });
      }

      run = checkShouldRerunPivotTableQuestion({
        isPivot,
        wasPivot,
        hasBreakouts,
        currentQuestion,
        newQuestion,
      });
    }

    // Native query should never be in notebook mode (metabase#12651)
    if (queryBuilderMode === "notebook" && newQuestion.isNative()) {
      await dispatch(
        setQueryBuilderMode("view", {
          shouldUpdateUrl: false,
        }),
      );
    }

    const newDatasetQuery = newQuestion.query().datasetQuery();
    // Sync card's parameters with the template tags;
    if (newDatasetQuery.type === "native") {
      const templateTags = getTemplateTagsForParameters(newQuestion.card());
      const parameters = getTemplateTagParameters(templateTags);
      newQuestion = newQuestion.setParameters(parameters);
    }

    await dispatch({
      type: UPDATE_QUESTION,
      payload: { card: newQuestion.card() },
    });

    if (shouldUpdateUrl) {
      dispatch(updateUrl(newQuestion.card(), { dirty: true }));
    }

    if (currentQuestion?.isNative?.() || newQuestion.isNative()) {
      const isVisible = getIsShowingTemplateTagsEditor(getState());
      const nextState = getNextTemplateTagEditorState({
        currentQuestion,
        newQuestion,
        queryBuilderMode,
        isVisible,
      });
      if (nextState) {
        dispatch(setIsShowingTemplateTagsEditor(nextState === "visible"));
      }
    }

    const currentDependencies = currentQuestion
      ? [
          ...currentQuestion.dependentMetadata(),
          ...currentQuestion.query().dependentMetadata(),
        ]
      : [];
    const nextDependencies = [
      ...newQuestion.dependentMetadata(),
      ...newQuestion.query().dependentMetadata(),
    ];
    try {
      if (!_.isEqual(currentDependencies, nextDependencies)) {
        await dispatch(loadMetadataForCard(newQuestion.card()));
      }

      // setDefaultQuery requires metadata be loaded, need getQuestion to use new metadata
      const question = getQuestion(getState()) as Question;
      const questionWithDefaultQuery = question.setDefaultQuery();
      if (!questionWithDefaultQuery.isEqual(question)) {
        await dispatch({
          type: UPDATE_QUESTION,
          payload: {
            card: questionWithDefaultQuery.setDefaultDisplay().card(),
          },
        });
      }
    } catch (e) {
      // this will fail if user doesn't have data permissions but thats ok
      console.warn("Couldn't load metadata", e);
    }

    if (run) {
      dispatch(runQuestionQuery());
    }
  };
};
