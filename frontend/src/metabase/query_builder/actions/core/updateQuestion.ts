import { assocIn } from "icepick";
import { t } from "ttag";
import _ from "underscore";

import Questions from "metabase/entities/questions";
import { createThunkAction } from "metabase/lib/redux";
import { loadMetadataForCard } from "metabase/questions/actions";
import { addUndo } from "metabase/redux/undo";
import * as Lib from "metabase-lib";
import type Question from "metabase-lib/v1/Question";
import { getTemplateTagParametersFromCard } from "metabase-lib/v1/parameters/utils/template-tags";
import type NativeQuery from "metabase-lib/v1/queries/NativeQuery";
import type { Series } from "metabase-types/api";
import type {
  Dispatch,
  GetState,
  QueryBuilderMode,
} from "metabase-types/store";

import {
  getFirstQueryResult,
  getIsShowingTemplateTagsEditor,
  getQueryBuilderMode,
  getQuestion,
  getRawSeries,
} from "../../selectors";
import { setIsShowingTemplateTagsEditor } from "../native";
import { updateUrl } from "../navigation";
import { runQuestionQuery } from "../querying";
import { onCloseQuestionInfo, setQueryBuilderMode } from "../ui";

import { getQuestionWithDefaultVisualizationSettings } from "./utils";

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

function shouldTemplateTagEditorBeVisible({
  currentQuestion,
  newQuestion,
  isVisible,
  queryBuilderMode,
}: {
  currentQuestion?: Question;
  newQuestion: Question;
  isVisible: boolean;
  queryBuilderMode: QueryBuilderMode;
}): boolean {
  // variable tags are not supported by models, so don't change the visibility
  if (queryBuilderMode === "dataset") {
    return isVisible;
  }
  const isCurrentQuestionNative =
    currentQuestion && Lib.queryDisplayInfo(currentQuestion.query()).isNative;
  const isNewQuestionNative = Lib.queryDisplayInfo(
    newQuestion.query(),
  ).isNative;

  const previousTags = isCurrentQuestionNative
    ? (currentQuestion.legacyQuery() as NativeQuery).variableTemplateTags()
    : [];
  const nextTags = isNewQuestionNative
    ? (newQuestion.legacyQuery() as NativeQuery).variableTemplateTags()
    : [];
  if (nextTags.length > previousTags.length) {
    return true;
  } else if (nextTags.length === 0) {
    return false;
  }
  return isVisible;
}

export type UpdateQuestionOpts = {
  run?: boolean;
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
    const { isEditable } = Lib.queryDisplayInfo(newQuestion.query());

    const shouldTurnIntoAdHoc =
      shouldStartAdHocQuestion &&
      newQuestion.isSaved() &&
      isEditable &&
      queryBuilderMode !== "dataset";

    if (shouldTurnIntoAdHoc) {
      newQuestion = newQuestion.withoutNameAndId();

      // When the dataset query changes, we should change the question type,
      // to start building a new ad-hoc question based on a dataset
      if (newQuestion.type() === "model") {
        newQuestion = newQuestion.setType("question");
        dispatch(onCloseQuestionInfo());
      }
    }

    const queryResult = getFirstQueryResult(getState());
    newQuestion = newQuestion.syncColumnsAndSettings(queryResult);

    if (!newQuestion.canAutoRun()) {
      run = false;
    }

    const isPivot = newQuestion.display() === "pivot";
    const wasPivot = currentQuestion?.display() === "pivot";

    const isCurrentQuestionNative =
      currentQuestion && Lib.queryDisplayInfo(currentQuestion.query()).isNative;
    const isNewQuestionNative = Lib.queryDisplayInfo(
      newQuestion.query(),
    ).isNative;

    if (wasPivot || isPivot) {
      const hasBreakouts =
        !isNewQuestionNative &&
        Lib.breakouts(newQuestion.query(), -1).length > 0;

      // compute the pivot setting now so we can query the appropriate data
      if (isPivot && hasBreakouts) {
        const key = "pivot_table.column_split";
        const rawSeries = getRawSeries(getState()) as Series;

        if (rawSeries) {
          const series = assocIn(rawSeries, [0, "card"], newQuestion.card());
          const setting = getQuestionWithDefaultVisualizationSettings(
            newQuestion,
            series,
          ).setting(key);
          newQuestion = newQuestion.updateSettings({ [key]: setting });
        }
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
    if (queryBuilderMode === "notebook" && isNewQuestionNative) {
      await dispatch(
        setQueryBuilderMode("view", {
          shouldUpdateUrl: false,
        }),
      );
    }

    // Sync card's parameters with the template tags;
    if (isNewQuestionNative) {
      const parameters = getTemplateTagParametersFromCard(newQuestion.card());
      newQuestion = newQuestion.setParameters(parameters);
    }

    await dispatch({
      type: UPDATE_QUESTION,
      payload: { card: newQuestion.card() },
    });

    if (shouldUpdateUrl) {
      dispatch(updateUrl(null, { dirty: true }));
    }

    if (isCurrentQuestionNative || isNewQuestionNative) {
      const isVisible = getIsShowingTemplateTagsEditor(getState());
      const shouldBeVisible = shouldTemplateTagEditorBeVisible({
        currentQuestion,
        newQuestion,
        queryBuilderMode,
        isVisible,
      });
      if (isVisible !== shouldBeVisible) {
        dispatch(setIsShowingTemplateTagsEditor(shouldBeVisible));
      }
    }

    const currentDependencies = currentQuestion
      ? Lib.dependentMetadata(currentQuestion.query())
      : [];
    const nextDependencies = Lib.dependentMetadata(newQuestion.query());
    try {
      if (!_.isEqual(currentDependencies, nextDependencies)) {
        await dispatch(loadMetadataForCard(newQuestion.card()));
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

// just using the entity action doesn't cause the question/model to live update
// also calling updateQuestion ensures the view matches the server state
export const SET_ARCHIVED_QUESTION = "metabase/question/SET_ARCHIVED_QUESTION";
export const setArchivedQuestion = createThunkAction(
  SET_ARCHIVED_QUESTION,
  function (question, archived = true) {
    return async function (dispatch) {
      await dispatch(
        Questions.actions.update({ id: question.card().id }, { archived }),
      );

      dispatch(
        updateQuestion(question.setArchived(archived), {
          shouldUpdateUrl: false,
          shouldStartAdHocQuestion: false,
        }),
      );

      dispatch(
        addUndo({
          subject: question.card().type === "question" ? t`question` : t`model`,
          verb: archived ? t`trashed` : t`restored`,
          action: () => dispatch(setArchivedQuestion(question, !archived)),
        }),
      );
    };
  },
);
