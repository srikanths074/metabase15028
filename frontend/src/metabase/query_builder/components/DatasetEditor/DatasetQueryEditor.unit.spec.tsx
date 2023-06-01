import { screen } from "@testing-library/react";
import fetchMock from "fetch-mock";
import _ from "underscore";

import {
  setupCollectionsEndpoints,
  setupDatabasesEndpoints,
} from "__support__/server-mocks";
import { createMockEntitiesState } from "__support__/store";
import { renderWithProviders } from "__support__/ui";
import { Card } from "metabase-types/api";
import {
  createMockCard,
  createMockCollection,
  createMockNativeDatasetQuery,
} from "metabase-types/api/mocks";
import { createSampleDatabase } from "metabase-types/api/mocks/presets";
import { createMockState } from "metabase-types/store/mocks";
import { checkNotNull } from "metabase/core/utils/types";
import { getMetadata } from "metabase/selectors/metadata";

const { NativeQueryEditor } = jest.requireActual(
  "metabase/query_builder/components/NativeQueryEditor",
);

const TEST_DB = createSampleDatabase();

const TEST_NATIVE_CARD = createMockCard({
  dataset_query: createMockNativeDatasetQuery({
    type: "native",
    database: TEST_DB.id,
    native: {
      query: "select * from orders",
      "template-tags": undefined,
    },
  }),
});

const ROOT_COLLECTION = createMockCollection({ id: "root" });

interface SetupOpts {
  card?: Card;
  height?: number;
  isActive: boolean;
  readOnly?: boolean;
}

const setup = async ({
  card = TEST_NATIVE_CARD,
  height = 300,
  isActive,
  readOnly = false,
}: SetupOpts) => {
  setupDatabasesEndpoints([TEST_DB]);
  setupCollectionsEndpoints([ROOT_COLLECTION]);

  const storeInitialState = createMockState({
    entities: createMockEntitiesState({
      databases: [createSampleDatabase()],
      questions: [card],
    }),
  });
  const metadata = getMetadata(storeInitialState);
  const question = checkNotNull(metadata.question(card.id));
  const query = question.query();

  const { default: DatasetQueryEditor } = await import(
    "metabase/query_builder/components/DatasetEditor/DatasetQueryEditor"
  );

  const { rerender } = renderWithProviders(
    <DatasetQueryEditor
      isActive={isActive}
      height={height}
      query={query}
      question={question}
      readOnly={readOnly}
      onResizeStop={_.noop}
    />,
  );

  return { query, question, rerender };
};

describe("DatasetQueryEditor", () => {
  beforeEach(() => {
    fetchMock.get("path:/api/native-query-snippet", () => []);

    jest.unmock("metabase/query_builder/components/NativeQueryEditor");

    jest
      .spyOn(NativeQueryEditor.prototype, "loadAceEditor")
      .mockImplementation(_.noop);
  });

  it("renders sidebar when query tab is active", async () => {
    await setup({ isActive: true });

    expect(
      screen.getByTestId("native-query-editor-sidebar"),
    ).toBeInTheDocument();
  });

  it("shows the native query editor container when query tab is active", async () => {
    await setup({ isActive: true });

    expect(screen.getByTestId("native-query-editor-container")).toBeVisible();
  });

  it("does not render sidebar when query tab is inactive", async () => {
    await setup({ isActive: false });

    expect(
      screen.queryByTestId("native-query-editor-sidebar"),
    ).not.toBeInTheDocument();
  });

  it("hides the native query editor container when query tab is inactive", async () => {
    await setup({ isActive: false });

    expect(
      screen.getByTestId("native-query-editor-container"),
    ).not.toBeVisible();
  });

  it("re-renders DatasetQueryEditor when height is 0 and isActive prop changes", async () => {
    const { query, question, rerender } = await setup({
      height: 0,
      isActive: true,
    });

    expect(
      screen.getByTestId("native-query-editor-sidebar"),
    ).toBeInTheDocument();

    const { default: DatasetQueryEditor } = await import(
      "metabase/query_builder/components/DatasetEditor/DatasetQueryEditor"
    );

    rerender(
      <DatasetQueryEditor
        isActive={false}
        height={0}
        query={query}
        question={question}
        readOnly={false}
        onResizeStop={_.noop}
      />,
    );

    expect(
      screen.queryByTestId("native-query-editor-sidebar"),
    ).not.toBeInTheDocument();
  });
});
