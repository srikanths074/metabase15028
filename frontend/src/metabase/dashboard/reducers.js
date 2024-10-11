import { assoc, assocIn, dissoc } from "icepick";
import reduceReducers from "reduce-reducers";
import _ from "underscore";

import Questions from "metabase/entities/questions";
import Revisions from "metabase/entities/revisions";
import { combineReducers, handleActions } from "metabase/lib/redux";

import {
  CLEAR_CARD_DATA,
  INITIALIZE,
  REMOVE_PARAMETER,
  RESET_PARAMETERS,
  SET_PARAMETER_VALUE,
  SET_PARAMETER_VALUES,
  fetchCardDataAction,
  fetchDashboard,
  tabsReducer,
} from "./actions";
import { INITIAL_DASHBOARD_STATE } from "./constants";
import {
  autoApplyFilters,
  dashboardId,
  dashboards,
  dashcards,
  editingDashboard,
  isAddParameterPopoverOpen,
  isNavigatingBackToDashboard,
  loadingControls,
  loadingDashCards,
  missingActionParameters,
  parameterValues,
  sidebar,
  slowCards,
  theme,
} from "./reducers-typed";

// Many of these slices are also updated by `tabsReducer` in `frontend/src/metabase/dashboard/actions/tabs.ts`
const dashcardData = handleActions(
  {
    // clear existing dashboard data when loading a dashboard
    [INITIALIZE]: {
      next: (state, { payload: { clearCache = true } = {} }) =>
        clearCache ? {} : state,
    },
    [fetchCardDataAction.fulfilled]: {
      next: (state, { payload: { dashcard_id, card_id, result } }) =>
        assocIn(state, [dashcard_id, card_id], result),
    },
    [CLEAR_CARD_DATA]: {
      next: (state, { payload: { cardId, dashcardId } }) =>
        assocIn(state, [dashcardId, cardId]),
    },
    [Questions.actionTypes.UPDATE]: (state, { payload: { object: card } }) =>
      _.mapObject(state, dashboardData => dissoc(dashboardData, card.id)),
    [Revisions.actionTypes.REVERT]: (state, { payload: revision }) =>
      _.mapObject(state, dashboardData =>
        dissoc(dashboardData, revision.model_id),
      ),
  },
  INITIAL_DASHBOARD_STATE.dashcardData,
);

const draftParameterValues = handleActions(
  {
    [INITIALIZE]: {
      next: (state, { payload: { clearCache = true } = {} }) => {
        return clearCache ? {} : state;
      },
    },
    [fetchDashboard.fulfilled]: {
      next: (
        state,
        { payload: { dashboard, parameterValues, preserveParameters } },
      ) =>
        preserveParameters && !dashboard.auto_apply_filters
          ? state
          : parameterValues,
    },
    [SET_PARAMETER_VALUE]: {
      next: (state, { payload: { id, value } }) =>
        assoc(state ?? {}, id, value),
    },
    [SET_PARAMETER_VALUES]: {
      next: (state, { payload }) => payload,
    },
    [RESET_PARAMETERS]: {
      next: (state, { payload: parameters }) => {
        return parameters.reduce(
          (result, parameter) => assoc(result, parameter.id, parameter.value),
          state ?? {},
        );
      },
    },
    [REMOVE_PARAMETER]: {
      next: (state, { payload: { id } }) => dissoc(state, id),
    },
  },
  {},
);

export const dashboardReducers = reduceReducers(
  INITIAL_DASHBOARD_STATE,
  combineReducers({
    dashboardId,
    missingActionParameters,
    autoApplyFilters,
    theme,
    slowCards,
    isNavigatingBackToDashboard,
    isAddParameterPopoverOpen,
    editingDashboard,
    loadingControls,
    sidebar,
    parameterValues,
    dashboards,
    loadingDashCards,
    dashcards,
    dashcardData,
    draftParameterValues,
    // Combined reducer needs to init state for every slice
    selectedTabId: (state = INITIAL_DASHBOARD_STATE.selectedTabId) => state,
    tabDeletions: (state = INITIAL_DASHBOARD_STATE.tabDeletions) => state,
  }),
  tabsReducer,
);
