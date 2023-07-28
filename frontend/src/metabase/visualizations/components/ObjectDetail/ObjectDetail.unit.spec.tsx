import { render, screen, within } from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { createMockMetadata } from "__support__/metadata";
import {
  setupActionsEndpoints,
  setupCardDataset,
  setupDatabasesEndpoints,
} from "__support__/server-mocks";
import { createMockEntitiesState } from "__support__/store";
import { testDataset } from "__support__/testDataset";
import { renderWithProviders } from "__support__/ui";
import { getNextId } from "__support__/utils";
import { WritebackAction } from "metabase-types/api";
import {
  createMockCard,
  createMockDatabase,
  createMockImplicitQueryAction,
  createMockQueryAction,
  createMockTable,
} from "metabase-types/api/mocks";
import {
  PEOPLE_ID,
  createSampleDatabase,
} from "metabase-types/api/mocks/presets";
import {
  createMockQueryBuilderState,
  createMockState,
} from "metabase-types/store/mocks";
import { checkNotNull } from "metabase/core/utils/types";
import { getMetadata } from "metabase/selectors/metadata";
import Question from "metabase-lib/Question";
import {
  ObjectDetailBody,
  ObjectDetailHeader,
  ObjectDetailView,
} from "./ObjectDetail";
import type { ObjectDetailProps } from "./types";

const MOCK_CARD = createMockCard({
  name: "Product",
});

const MOCK_TABLE = createMockTable({
  name: "Product",
  display_name: "Product",
});

const mockQuestion = new Question(
  createMockCard({
    name: "Product",
  }),
);

const databaseWithEnabledActions = createMockDatabase({
  id: getNextId(),
  settings: { "database-enable-actions": true },
});

const databaseWithDisabledActions = createMockDatabase({
  id: getNextId(),
  settings: { "database-enable-actions": false },
});

const metadata = createMockMetadata({
  databases: [
    createSampleDatabase({
      id: databaseWithEnabledActions.id,
      settings: { "database-enable-actions": true },
    }),
  ],
});

const mockDataset = new Question(
  createMockCard({
    name: "Product",
    dataset: true,
    dataset_query: {
      type: "query",
      database: databaseWithEnabledActions.id,
      query: {
        "source-table": PEOPLE_ID,
      },
    },
  }),
  metadata,
);

const implicitCreateAction = createMockImplicitQueryAction({
  id: getNextId(),
  database_id: databaseWithEnabledActions.id,
  name: "Create",
  kind: "row/create",
});

const implicitDeleteAction = createMockImplicitQueryAction({
  id: getNextId(),
  database_id: databaseWithEnabledActions.id,
  name: "Delete",
  kind: "row/delete",
});

const implicitUpdateAction = createMockImplicitQueryAction({
  id: getNextId(),
  database_id: databaseWithEnabledActions.id,
  name: "Update",
  kind: "row/update",
});

const implicitPublicUpdateAction = {
  ...implicitUpdateAction,
  id: getNextId(),
  name: "Public Update",
  public_uuid: "mock-uuid",
};

const implicitPublicDeleteAction = {
  ...implicitDeleteAction,
  id: getNextId(),
  name: "Public Delete",
  public_uuid: "mock-uuid",
};

const implicitArchivedUpdateAction = {
  ...implicitUpdateAction,
  id: getNextId(),
  name: "Archived Implicit Update",
  archived: true,
};

const implicitArchivedDeleteAction = {
  ...implicitDeleteAction,
  id: getNextId(),
  name: "Archived Implicit Delete",
  archived: true,
};

const queryAction = createMockQueryAction({
  id: getNextId(),
  name: "Query action",
});

const actions = [
  implicitCreateAction,
  implicitDeleteAction,
  implicitUpdateAction,
  implicitPublicUpdateAction,
  implicitPublicDeleteAction,
  implicitArchivedUpdateAction,
  implicitArchivedDeleteAction,
  queryAction,
];

const actionsFromDatabaseWithDisabledActions = actions.map(action => ({
  ...action,
  database_id: databaseWithDisabledActions.id,
}));

function setup(options?: Partial<ObjectDetailProps>) {
  const state = createMockState({
    entities: createMockEntitiesState({
      questions: [MOCK_CARD],
      tables: [MOCK_TABLE],
    }),
    qb: createMockQueryBuilderState({ card: MOCK_CARD }),
  });
  const metadata = getMetadata(state);

  const question = checkNotNull(metadata.question(MOCK_CARD.id));
  const table = checkNotNull(metadata.table(MOCK_TABLE.id));

  renderWithProviders(
    <ObjectDetailView
      data={testDataset}
      question={question}
      table={table}
      zoomedRow={testDataset.rows[0]}
      zoomedRowID={0}
      tableForeignKeys={[]}
      tableForeignKeyReferences={[]}
      settings={{
        column: () => null,
      }}
      showHeader
      canZoom={true}
      canZoomPreviousRow={false}
      canZoomNextRow={false}
      followForeignKey={() => null}
      onVisualizationClick={() => null}
      visualizationIsClickable={() => false}
      fetchTableFks={() => null}
      loadObjectDetailFKReferences={() => null}
      viewPreviousObjectDetail={() => null}
      viewNextObjectDetail={() => null}
      closeObjectDetail={() => null}
      {...options}
    />,
  );
}

describe("Object Detail", () => {
  it("renders an object detail header", () => {
    render(
      <ObjectDetailHeader
        actionItems={[]}
        canZoom={false}
        objectName="Large Sandstone Socks"
        objectId={778}
        canZoomNextRow={false}
        canZoomPreviousRow={false}
        viewPreviousObjectDetail={() => null}
        viewNextObjectDetail={() => null}
        closeObjectDetail={() => null}
      />,
    );
    expect(screen.getByText(/Large Sandstone Socks/i)).toBeInTheDocument();
    expect(screen.getByText(/778/i)).toBeInTheDocument();
  });

  it("renders an object detail header with enabled next object button and disabled previous object button", () => {
    render(
      <ObjectDetailHeader
        actionItems={[]}
        canZoom={true}
        objectName="Large Sandstone Socks"
        objectId={778}
        canZoomNextRow={true}
        canZoomPreviousRow={false}
        viewPreviousObjectDetail={() => null}
        viewNextObjectDetail={() => null}
        closeObjectDetail={() => null}
      />,
    );
    const nextDisabled = screen
      .getByTestId("view-next-object-detail")
      .getAttribute("disabled");

    const prevDisabled = screen
      .getByTestId("view-previous-object-detail")
      .getAttribute("disabled");

    expect(nextDisabled).toBeNull();
    expect(prevDisabled).not.toBeNull();
  });

  it("renders an object detail body", () => {
    render(
      <ObjectDetailBody
        data={testDataset}
        objectName="Large Sandstone Socks"
        zoomedRow={testDataset.rows[2]}
        settings={{
          column: () => null,
        }}
        hasRelationships={false}
        onVisualizationClick={() => null}
        visualizationIsClickable={() => false}
        tableForeignKeys={[]}
        tableForeignKeyReferences={{}}
        followForeignKey={() => null}
      />,
    );

    expect(screen.getByText("Synergistic Granite Chair")).toBeInTheDocument();
    expect(screen.getByText("Doohickey")).toBeInTheDocument();
  });

  it("renders an object detail component", () => {
    setup();

    expect(screen.getByText(/Product/i)).toBeInTheDocument();
    expect(
      screen.getByText(checkNotNull(testDataset.rows[0][2]).toString()),
    ).toBeInTheDocument();
    expect(
      screen.getByText(checkNotNull(testDataset.rows[0][3]).toString()),
    ).toBeInTheDocument();
    expect(
      screen.getByText(checkNotNull(testDataset.rows[0][4]).toString()),
    ).toBeInTheDocument();
  });

  it("fetches a missing row", async () => {
    setupCardDataset({
      data: {
        rows: [
          [
            "101",
            "1807963902339",
            "Extremely Hungry Toucan",
            "Gizmo",
            "Larson, Pfeffer and Klocko",
            31.78621880685793,
            4.3,
            "2017-01-09T09:51:20.352-07:00",
          ],
        ],
      },
    });

    // because this row is not in the test dataset, it should trigger a fetch
    setup({ zoomedRowID: "101", zoomedRow: undefined });

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(
      await screen.findByText(/Extremely Hungry Toucan/i),
    ).toBeInTheDocument();
  });

  it("shows not found if it can't find a missing row", async () => {
    setupCardDataset({ data: { rows: [] } });

    // because this row is not in the test dataset, it should trigger a fetch
    setup({ zoomedRowID: "102", zoomedRow: undefined });

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(await screen.findByText(/we're a little lost/i)).toBeInTheDocument();
  });

  describe("renders actions menu", () => {
    beforeEach(() => {
      setupDatabasesEndpoints([databaseWithEnabledActions]);
      setupActionsEndpoints(actions);
      setup({ question: mockDataset });
    });

    it("should not show implicit create action", async () => {
      const action = await findActionInActionMenu(implicitCreateAction);
      expect(action).not.toBeInTheDocument();
    });

    it("should show implicit update action", async () => {
      const action = await findActionInActionMenu(implicitUpdateAction);
      expect(action).toBeInTheDocument();
    });

    it("should show implicit delete action", async () => {
      const action = await findActionInActionMenu(implicitDeleteAction);
      expect(action).toBeInTheDocument();
    });

    it("should not show implicit public update action", async () => {
      const action = await findActionInActionMenu(implicitPublicUpdateAction);
      expect(action).not.toBeInTheDocument();
    });

    it("should not show implicit public delete action", async () => {
      const action = await findActionInActionMenu(implicitPublicDeleteAction);
      expect(action).not.toBeInTheDocument();
    });

    it("should not show implicit archived update action", async () => {
      const action = await findActionInActionMenu(implicitArchivedUpdateAction);
      expect(action).not.toBeInTheDocument();
    });

    it("should not show implicit archived delete action", async () => {
      const action = await findActionInActionMenu(implicitArchivedDeleteAction);
      expect(action).not.toBeInTheDocument();
    });

    it("should not show query action", async () => {
      const action = await findActionInActionMenu(queryAction);
      expect(action).not.toBeInTheDocument();
    });
  });

  it("should not render actions menu for models based on database without enabled actions", () => {
    setupDatabasesEndpoints([databaseWithDisabledActions]);
    setupActionsEndpoints(actionsFromDatabaseWithDisabledActions);
    setup({ question: mockQuestion });

    const actionsMenu = screen.queryByTestId("actions-menu");
    expect(actionsMenu).not.toBeInTheDocument();
  });

  it("should not render actions menu for non-model questions", () => {
    setupDatabasesEndpoints([databaseWithEnabledActions]);
    setupActionsEndpoints(actions);
    setup({ question: mockQuestion });

    const actionsMenu = screen.queryByTestId("actions-menu");
    expect(actionsMenu).not.toBeInTheDocument();
  });

  it("should show update object modal on update action click", async () => {
    setupDatabasesEndpoints([databaseWithEnabledActions]);
    setupActionsEndpoints(actions);
    setup({ question: mockDataset });

    expect(
      screen.queryByTestId("action-execute-modal"),
    ).not.toBeInTheDocument();

    const action = await findActionInActionMenu(implicitUpdateAction);
    expect(action).toBeInTheDocument();
    action?.click();

    const modal = await screen.findByTestId("action-execute-modal");
    expect(modal).toBeInTheDocument();

    expect(within(modal).getByTestId("modal-header")).toHaveTextContent(
      "Update",
    );
  });

  it("should show delete object modal on delete action click", async () => {
    setupDatabasesEndpoints([databaseWithEnabledActions]);
    setupActionsEndpoints(actions);
    setup({ question: mockDataset });

    expect(screen.queryByTestId("delete-object-modal")).not.toBeInTheDocument();

    const action = await findActionInActionMenu(implicitDeleteAction);
    expect(action).toBeInTheDocument();
    action?.click();

    const modal = await screen.findByTestId("delete-object-modal");
    expect(modal).toBeInTheDocument();

    expect(within(modal).getByTestId("modal-header")).toHaveTextContent(
      "Are you sure you want to delete this row?",
    );
  });
});

async function findActionInActionMenu({ name }: Pick<WritebackAction, "name">) {
  const actionsMenu = await screen.findByTestId("actions-menu");
  userEvent.click(actionsMenu);
  const popover = await screen.findByTestId("popover");
  const action = within(popover).queryByText(name);
  return action;
}
