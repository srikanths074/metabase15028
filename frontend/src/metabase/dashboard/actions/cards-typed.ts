import { createAction } from "metabase/lib/redux";
import Questions from "metabase/entities/questions";
import { getDefaultSize } from "metabase/visualizations";

import type {
  ActionDashboardCard,
  BaseDashboardCard,
  CardId,
  DashboardCard,
  DashboardId,
  DashboardTabId,
  VirtualCardDisplay,
  VirtualDashboardCard,
} from "metabase-types/api";
import type { Dispatch, GetState } from "metabase-types/store";
import {
  DEFAULT_CARD_SIZE,
  getPositionForNewDashCard,
} from "metabase/lib/dashboard_grid";

import { trackCardCreated } from "../analytics";
import { autoWireParametersToNewCard } from "./auto-wire-parameters/actions";
import { ADD_CARD_TO_DASH } from "./core";
import { fetchCardData } from "./data-fetching";
import { loadMetadataForDashboard } from "./metadata";
import { getExistingDashCards } from "./utils";

type NewDashCardOpts = {
  dashId: DashboardId;
  tabId: DashboardTabId | null;
};

type AddDashCardOpts = NewDashCardOpts & {
  dashcardOverrides:
    | Partial<ActionDashboardCard>
    | Partial<DashboardCard>
    | Partial<VirtualDashboardCard>;
};

let tempId = -1;

export function generateTemporaryDashcardId() {
  return tempId--;
}

export const addDashCardToDashboard =
  ({ dashId, tabId, dashcardOverrides }: AddDashCardOpts) =>
  (dispatch: Dispatch, getState: GetState) => {
    const display = dashcardOverrides?.card?.display;
    const dashCardSize = display
      ? getDefaultSize(display) || DEFAULT_CARD_SIZE
      : DEFAULT_CARD_SIZE;

    const dashboardState = getState().dashboard;
    const dashcards = getExistingDashCards(
      dashboardState.dashboards,
      dashboardState.dashcards,
      dashId,
      tabId,
    );

    const dashcard = createDashCard<BaseDashboardCard>({
      dashboard_id: dashId,
      dashboard_tab_id: tabId ?? null,

      ...getPositionForNewDashCard(
        dashcards,
        dashCardSize.width,
        dashCardSize.height,
      ),

      ...dashcardOverrides,
    });

    dispatch(createAction(ADD_CARD_TO_DASH)(dashcard));

    return dashcard;
  };

type AddCardToDashboardOpts = NewDashCardOpts & {
  cardId: CardId;
};

export const addCardToDashboard =
  ({ dashId, tabId, cardId }: AddCardToDashboardOpts) =>
  async (dispatch: Dispatch, getState: GetState) => {
    await dispatch(Questions.actions.fetch({ id: cardId }));
    const card = Questions.selectors
      .getObject(getState(), { entityId: cardId })
      .card();

    const dashcardId = generateTemporaryDashcardId();
    const dashcard = dispatch(
      addDashCardToDashboard({
        dashId,
        tabId,
        dashcardOverrides: { id: dashcardId, card, card_id: cardId },
      }),
    );

    dispatch(fetchCardData(card, dashcard, { reload: true, clearCache: true }));
    await dispatch(loadMetadataForDashboard([dashcard]));
    dispatch(autoWireParametersToNewCard({ dashcard_id: dashcardId }));
  };

export const addHeadingDashCardToDashboard =
  ({ dashId, tabId }: NewDashCardOpts) =>
  (dispatch: Dispatch) => {
    trackCardCreated("heading", dashId);
    const dc = createVirtualDashCard({
      display: "heading",
      visualization_settings: { "dashcard.background": false },
    });
    dispatch(addDashCardToDashboard({ dashId, tabId, dashcardOverrides: dc }));
  };

export const addMarkdownDashCardToDashboard =
  ({ dashId, tabId }: NewDashCardOpts) =>
  (dispatch: Dispatch) => {
    trackCardCreated("text", dashId);
    const dc = createVirtualDashCard({ display: "text" });
    dispatch(addDashCardToDashboard({ dashId, tabId, dashcardOverrides: dc }));
  };

export const addLinkDashCardToDashboard =
  ({ dashId, tabId }: NewDashCardOpts) =>
  (dispatch: Dispatch) => {
    trackCardCreated("link", dashId);
    const dc = createVirtualDashCard({ display: "link" });
    dispatch(addDashCardToDashboard({ dashId, tabId, dashcardOverrides: dc }));
  };

function createDashCard<T extends BaseDashboardCard>(attrs: Partial<T>) {
  return {
    id: generateTemporaryDashcardId(),
    card_id: null,
    card: null,
    series: [],
    parameter_mappings: [],
    visualization_settings: {},
    ...attrs,
  };
}

function createVirtualDashCard({
  display,
  visualization_settings,
}: {
  display: VirtualCardDisplay;
  visualization_settings?: Omit<
    VirtualDashboardCard["visualization_settings"],
    "virtual_card"
  >;
}): VirtualDashboardCard {
  const virtualCard = {
    name: null,
    dataset_query: {},
    display,
    visualization_settings: {},
    archived: false,
  };

  return createDashCard<VirtualDashboardCard>({
    card: virtualCard,
    visualization_settings: {
      ...visualization_settings,
      virtual_card: virtualCard,
    },
  });
}
