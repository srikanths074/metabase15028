import _ from "underscore";

import { createSelector } from "reselect";

import { getMetadata } from "metabase/selectors/metadata";

import {
  getParameterMappingOptions as _getParameterMappingOptions,
  getMappingsByParameter as _getMappingsByParameter,
} from "metabase/meta/Dashboard";

import { SIDEBAR_NAME } from "metabase/dashboard/constants";

import type { CardId, Card } from "metabase-types/types/Card";
import type { DashCardId } from "metabase-types/types/Dashboard";
import type {
  ParameterId,
  Parameter,
  ParameterMapping,
  ParameterMappingUIOption,
} from "metabase-types/types/Parameter";

export type AugmentedParameterMapping = ParameterMapping & {
  dashcard_id: DashCardId,
  overlapMax?: number,
  mappingsWithValues?: number,
  values: Array<string>,
};

export type MappingsByParameter = {
  [key: ParameterId]: {
    [key: DashCardId]: {
      [key: CardId]: AugmentedParameterMapping,
    },
  },
};

export const getDashboardId = state => state.dashboard.dashboardId;
export const getIsEditing = state => !!state.dashboard.isEditing;
export const getDashboardBeforeEditing = state => state.dashboard.isEditing;
export const getClickBehaviorSidebarDashcard = state => {
  const { sidebar, dashcards } = state.dashboard;
  return sidebar.name === SIDEBAR_NAME.clickBehavior
    ? dashcards[sidebar.props.dashcardId]
    : null;
};
export const getDashboards = state => state.dashboard.dashboards;
export const getDashcards = state => state.dashboard.dashcards;
export const getCardData = state => state.dashboard.dashcardData;
export const getSlowCards = state => state.dashboard.slowCards;
export const getParameterValues = state => state.dashboard.parameterValues;
export const getLoadingStartTime = state =>
  state.dashboard.loadingDashCards.startTime;
export const getIsAddParameterPopoverOpen = state =>
  state.dashboard.isAddParameterPopoverOpen;

export const getSidebar = state => state.dashboard.sidebar;
export const getIsSharing = createSelector(
  [getSidebar],
  sidebar => sidebar.name === SIDEBAR_NAME.sharing,
);

export const getShowAddQuestionSidebar = createSelector(
  [getSidebar],
  sidebar => sidebar.name === SIDEBAR_NAME.addQuestion,
);

export const getDashboard = createSelector(
  [getDashboardId, getDashboards],
  (dashboardId, dashboards) => dashboards[dashboardId],
);

export const getDashboardComplete = createSelector(
  [getDashboard, getDashcards],
  (dashboard, dashcards) =>
    dashboard && {
      ...dashboard,
      ordered_cards: dashboard.ordered_cards
        .map(id => dashcards[id])
        .filter(dc => !dc.isRemoved),
    },
);

export const getIsDirty = createSelector(
  [getDashboard, getDashcards],
  (dashboard, dashcards) =>
    !!(
      dashboard &&
      (dashboard.isDirty ||
        _.some(
          dashboard.ordered_cards,
          id =>
            !(dashcards[id].isAdded && dashcards[id].isRemoved) &&
            (dashcards[id].isDirty ||
              dashcards[id].isAdded ||
              dashcards[id].isRemoved),
        ))
    ),
);

export const getEditingParameterId = createSelector(
  [getSidebar],
  sidebar => {
    return sidebar.name === SIDEBAR_NAME.editParameter
      ? sidebar.props?.parameterId
      : null;
  },
);

export const getIsEditingParameter = createSelector(
  [getEditingParameterId],
  parameterId => parameterId != null,
);

export const getEditingParameter = createSelector(
  [getDashboard, getEditingParameterId],
  (dashboard, editingParameterId) =>
    editingParameterId != null
      ? _.findWhere(dashboard.parameters, { id: editingParameterId })
      : null,
);

const getCard = (state, props) => props.card;
const getDashCard = (state, props) => props.dashcard;

export const getParameterTarget = createSelector(
  [getEditingParameter, getCard, getDashCard],
  (parameter, card, dashcard) => {
    if (parameter == null) {
      return null;
    }
    const mapping = _.findWhere(dashcard.parameter_mappings, {
      card_id: card.id,
      parameter_id: parameter.id,
    });
    return mapping && mapping.target;
  },
);

export const getMappingsByParameter = createSelector(
  [getMetadata, getDashboardComplete],
  _getMappingsByParameter,
);

/** Returns the dashboard's parameters objects, with field_id added, if appropriate */
export const getParameters = createSelector(
  [getMetadata, getDashboard, getMappingsByParameter],
  (metadata, dashboard, mappingsByParameter) =>
    ((dashboard && dashboard.parameters) || []).map(parameter => {
      const mappings = _.flatten(
        _.map(mappingsByParameter[parameter.id] || {}, _.values),
      );

      // we change out widgets if a parameter is connected to non-field targets
      const hasOnlyFieldTargets = mappings.every(x => x.field_id != null);

      // get the unique list of field IDs these mappings reference
      const fieldIds = _.chain(mappings)
        .map(m => m.field_id)
        .uniq()
        .filter(fieldId => fieldId != null)
        .value();
      const fieldIdsWithFKResolved = _.chain(fieldIds)
        .map(id => metadata.field(id))
        .filter(f => f)
        .map(f => (f.target || f).id)
        .uniq()
        .value();
      return {
        ...parameter,
        field_ids: fieldIds,
        // if there's a single uniqe field (accounting for FKs) then
        // include it as the one true field_id
        field_id:
          fieldIdsWithFKResolved.length === 1
            ? fieldIdsWithFKResolved[0]
            : null,
        hasOnlyFieldTargets,
      };
    }),
);

export const makeGetParameterMappingOptions = () => {
  const getParameterMappingOptions = createSelector(
    [getMetadata, getEditingParameter, getCard],
    (
      metadata,
      parameter: Parameter,
      card: Card,
    ): Array<ParameterMappingUIOption> => {
      return _getParameterMappingOptions(metadata, parameter, card);
    },
  );
  return getParameterMappingOptions;
};

export const getDefaultParametersById = createSelector(
  [getDashboard],
  dashboard =>
    ((dashboard && dashboard.parameters) || []).reduce((map, parameter) => {
      if (parameter.default) {
        map[parameter.id] = parameter.default;
      }

      return map;
    }, {}),
);
