import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, within } from "__support__/ui";
import { setupSearchEndpoints } from "__support__/server-mocks";
import { createMockSearchResult } from "metabase-types/api/mocks";
import { TypeFilter } from "metabase/search/components/SearchFilterModal/filters/TypeFilter";
import { SearchModelType } from "metabase-types/api";

const TRANSLATED_NAME_BY_MODEL_TYPE: Record<string, string> = {
  action: "Action",
  card: "Question",
  dataset: "Model",
  dashboard: "Dashboard",
  table: "Table",
  database: "Database",
  collection: "Collection",
  segment: "Segment",
  metric: "Metric",
  pulse: "Pulse",
};

const TEST_TYPES: Array<SearchModelType> = [
  "action",
  "card",
  "collection",
  "dashboard",
  "database",
  "dataset",
  "table",
  "indexed-entity",
  "pulse",
  "segment",
  "metric",
];

const TEST_TYPE_SUBSET: Array<SearchModelType> = [
  "dashboard",
  "collection",
  "database",
];

const TestTypeFilterComponent = ({
  initialValue = [],
  onChangeFilters,
}: {
  initialValue?: SearchModelType[];
  onChangeFilters: (value: SearchModelType[]) => void;
}) => {
  const [value, setValue] = useState<SearchModelType[]>(initialValue);

  const onChange = (value: SearchModelType[]) => {
    setValue(value);
    onChangeFilters(value);
  };

  return <TypeFilter value={value} onChange={onChange} />;
};

const setup = async ({
  availableModels = TEST_TYPES,
  initialValue = [],
}: {
  availableModels?: SearchModelType[];
  initialValue?: SearchModelType[];
} = {}) => {
  setupSearchEndpoints(
    availableModels.map((type, index) =>
      createMockSearchResult({ model: type, id: index + 1 }),
    ),
  );

  const onChangeFilters = jest.fn();

  renderWithProviders(
    <TestTypeFilterComponent
      onChangeFilters={onChangeFilters}
      initialValue={initialValue}
    />,
  );
  await waitFor(() =>
    expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument(),
  );

  return {
    onChangeFilters,
  };
};

const getCheckboxes = () => {
  return within(screen.getByTestId("type-filter-checkbox-group")).getAllByRole(
    "checkbox",
    {},
  ) as HTMLInputElement[];
};

describe("TypeFilter", () => {
  it("should display `Type` and all type labels", async () => {
    await setup();
    expect(screen.getByText("Type")).toBeInTheDocument();
    for (const entityType of TEST_TYPES) {
      console.log(entityType);
      expect(TRANSLATED_NAME_BY_MODEL_TYPE[entityType]).toBeInTheDocument();
    }
  });

  it("should only display available types", async () => {
    await setup({ availableModels: TEST_TYPE_SUBSET });

    const options = getCheckboxes();

    expect(options).toHaveLength(TEST_TYPE_SUBSET.length);

    options.forEach((option, index) => {
      expect(TEST_TYPE_SUBSET).toContain(option.value);
    });
  });

  it("should populate the filter with initial values", async () => {
    await setup({ initialValue: TEST_TYPE_SUBSET });

    const options = getCheckboxes();

    expect(options.length).toEqual(TEST_TYPES.length);

    const checkedOptions = options.filter(option => option.checked);

    expect(checkedOptions.length).toEqual(TEST_TYPE_SUBSET.length);
    for (const checkedOption of checkedOptions) {
      expect(TEST_TYPE_SUBSET).toContain(checkedOption.value);
    }
  });

  it("should allow selecting multiple types", async () => {
    const { onChangeFilters } = await setup();
    const options = getCheckboxes();

    for (let i = 0; i < options.length; i++) {
      userEvent.click(options[i]);
      expect(onChangeFilters).toHaveReturnedTimes(i + 1);
    }

    expect(onChangeFilters).toHaveReturnedTimes(TEST_TYPES.length);
    expect(onChangeFilters).toHaveBeenLastCalledWith(TEST_TYPES);
  });

  it("should allow de-selecting multiple types", async () => {
    const { onChangeFilters } = await setup({ initialValue: TEST_TYPE_SUBSET });

    const options = getCheckboxes();
    const checkedOptions = options.filter(option => option.checked);
    for (const checkedOption of checkedOptions) {
      userEvent.click(checkedOption);
    }

    expect(onChangeFilters).toHaveReturnedTimes(TEST_TYPE_SUBSET.length);
    expect(onChangeFilters).toHaveBeenLastCalledWith([]);
  });
});
