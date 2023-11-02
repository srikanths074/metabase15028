import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, within } from "__support__/ui";
import { createMockEntitiesState } from "__support__/store";
import { checkNotNull } from "metabase/lib/types";
import { getMetadata } from "metabase/selectors/metadata";
import { createSampleDatabase } from "metabase-types/api/mocks/presets";
import { createMockState } from "metabase-types/store/mocks";
import * as Lib from "metabase-lib";
import { createQuery, columnFinder } from "metabase-lib/test-helpers";
import { NumberFilterPicker } from "./NumberFilterPicker";

const storeInitialState = createMockState({
  entities: createMockEntitiesState({
    databases: [createSampleDatabase()],
  }),
});

const metadata = getMetadata(storeInitialState);

function findNumericColumn(query: Lib.Query) {
  const columns = Lib.filterableColumns(query, 0);
  const findColumn = columnFinder(query, columns);
  return findColumn("ORDERS", "TOTAL");
}

function createFilteredQuery({
  operator = "=",
  values = [0],
}: Partial<Lib.NumberFilterParts> = {}) {
  const initialQuery = createQuery({ metadata });
  const column = findNumericColumn(initialQuery);

  const clause = Lib.numberFilterClause({ operator, column, values });
  const query = Lib.filter(initialQuery, 0, clause);
  const [filter] = Lib.filters(query, 0);

  return { query, column, filter };
}

const NUMERIC_TEST_CASES: Array<[string, number]> = [
  ["negative integer", -24],
  ["negative float", -17.32],
  ["zero", 0],
  ["positive float", 3.14],
  ["positive integer", 42],
];

const BETWEEN_TEST_CASES = [
  [-10.5, -10],
  [-10, 0],
  [0, 10],
  [10, 10.5],
  [-10, 10.5],
];

const EXPECTED_OPERATORS = [
  "Equal to",
  "Not equal to",
  "Between",
  "Greater than",
  "Greater than or equal to",
  "Less than",
  "Less than or equal to",
  "Is empty",
  "Not empty",
];

type SetupOpts = {
  query?: Lib.Query;
  column?: Lib.ColumnMetadata;
  filter?: Lib.FilterClause;
};

function setup({
  query = createQuery({ metadata }),
  column = findNumericColumn(query),
  filter,
}: SetupOpts = {}) {
  const onChange = jest.fn();
  const onBack = jest.fn();

  renderWithProviders(
    <NumberFilterPicker
      query={query}
      stageIndex={0}
      column={column}
      filter={filter}
      isNew={!filter}
      onChange={onChange}
      onBack={onBack}
    />,
    { storeInitialState },
  );

  function getNextFilterParts() {
    const [filter] = onChange.mock.lastCall;
    return Lib.numberFilterParts(query, 0, filter);
  }

  function getNextFilterColumnName() {
    const parts = getNextFilterParts();
    const column = checkNotNull(parts?.column);
    return Lib.displayInfo(query, 0, column).longDisplayName;
  }

  return {
    query,
    column,
    getNextFilterParts,
    getNextFilterColumnName,
    onChange,
    onBack,
  };
}

async function setOperator(operator: string) {
  userEvent.click(screen.getByLabelText("Filter operator"));
  userEvent.click(await screen.findByText(operator));
}

describe("NumberFilterPicker", () => {
  describe("new filter", () => {
    it("should render a blank editor", () => {
      setup();

      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Equal to")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter a number")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Add filter" })).toBeDisabled();
    });

    it("should list operators", async () => {
      setup();

      userEvent.click(screen.getByLabelText("Filter operator"));
      const listbox = await screen.findByRole("listbox");
      const options = within(listbox).getAllByRole("option");

      expect(options).toHaveLength(EXPECTED_OPERATORS.length);
      EXPECTED_OPERATORS.forEach(operatorName =>
        expect(within(listbox).getByText(operatorName)).toBeInTheDocument(),
      );
    });

    describe("with one value", () => {
      it.each(NUMERIC_TEST_CASES)(
        "should add a filter with a %s value",
        async (title, value) => {
          const { getNextFilterParts, getNextFilterColumnName } = setup();

          await setOperator("Greater than");
          userEvent.type(
            screen.getByPlaceholderText("Enter a number"),
            String(value),
          );
          userEvent.click(screen.getByText("Add filter"));

          const filterParts = getNextFilterParts();
          expect(filterParts).toMatchObject({
            operator: ">",
            column: expect.anything(),
            values: [value],
          });
          expect(getNextFilterColumnName()).toBe("Total");
        },
      );
    });

    describe("with two values", () => {
      it.each(BETWEEN_TEST_CASES)(
        "should add a filter with with %i to %i values",
        async (leftValue, rightValue) => {
          const { getNextFilterParts, getNextFilterColumnName } = setup();
          const addFilterButton = screen.getByRole("button", {
            name: "Add filter",
          });

          await setOperator("Between");

          const [leftInput, rightInput] =
            screen.getAllByPlaceholderText("Enter a number");
          userEvent.type(leftInput, String(leftValue));
          expect(addFilterButton).toBeDisabled();

          userEvent.type(rightInput, String(rightValue));
          userEvent.click(addFilterButton);

          const filterParts = getNextFilterParts();
          expect(filterParts).toMatchObject({
            operator: "between",
            column: expect.anything(),
            values: [leftValue, rightValue],
          });
          expect(getNextFilterColumnName()).toBe("Total");
        },
      );
    });

    describe("with many values", () => {
      it("should add a filter with many values", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup();

        userEvent.type(
          screen.getByPlaceholderText("Enter a number"),
          "-5, -1, 0, 1, 5",
        );
        userEvent.click(screen.getByText("Add filter"));

        const filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "=",
          column: expect.anything(),
          values: [-5, -1, 0, 1, 5],
        });
        expect(getNextFilterColumnName()).toBe("Total");
      });
    });

    describe("with no values", () => {
      it("should add a filter", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup();

        await setOperator("Is empty");
        userEvent.click(screen.getByText("Add filter"));

        const filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "is-null",
          column: expect.anything(),
          values: [],
        });
        expect(getNextFilterColumnName()).toBe("Total");
      });
    });

    it("should handle invalid input", async () => {
      setup();

      userEvent.type(
        screen.getByPlaceholderText("Enter a number"),
        "Twenty four",
      );

      expect(screen.getByRole("button", { name: "Add filter" })).toBeDisabled();
    });

    it("should go back", () => {
      const { onBack, onChange } = setup();
      userEvent.click(screen.getByLabelText("Back"));
      expect(onBack).toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("existing filter", () => {
    describe("with one value", () => {
      it.each(NUMERIC_TEST_CASES)(
        "should render a filter with a %s value",
        (title, value) => {
          const opts = createFilteredQuery({
            operator: ">",
            values: [value],
          });
          setup(opts);

          expect(screen.getByText("Total")).toBeInTheDocument();
          expect(screen.getByDisplayValue("Greater than")).toBeInTheDocument();
          expect(screen.getByDisplayValue(String(value))).toBeInTheDocument();
          expect(screen.getByText("Update filter")).toBeEnabled();
        },
      );

      it.each(NUMERIC_TEST_CASES)(
        "should update a filter with a %s value",
        async (title, value) => {
          const opts = createFilteredQuery({ operator: ">", values: [1000] });
          const { getNextFilterParts, getNextFilterColumnName } = setup(opts);

          await setOperator("Greater than");
          userEvent.type(
            screen.getByPlaceholderText("Enter a number"),
            `{selectall}{backspace}${value}`,
          );
          userEvent.click(screen.getByText("Update filter"));

          const filterParts = getNextFilterParts();
          expect(filterParts).toMatchObject({
            operator: ">",
            column: expect.anything(),
            values: [value],
          });
          expect(getNextFilterColumnName()).toBe("Total");
        },
      );
    });

    describe("with two values", () => {
      it.each(BETWEEN_TEST_CASES)(
        "should render a filter with %i to %i values",
        (leftValue, rightValue) => {
          const opts = createFilteredQuery({
            operator: "between",
            values: [leftValue, rightValue],
          });
          setup(opts);

          expect(screen.getByText("Total")).toBeInTheDocument();
          expect(screen.getByDisplayValue("Between")).toBeInTheDocument();
          expect(
            screen.getByDisplayValue(String(leftValue)),
          ).toBeInTheDocument();
          expect(
            screen.getByDisplayValue(String(rightValue)),
          ).toBeInTheDocument();
          expect(screen.getByText("Update filter")).toBeEnabled();
        },
      );

      it.each(BETWEEN_TEST_CASES)(
        "should update a filter with %i to %i values",
        async (leftValue, rightValue) => {
          const opts = createFilteredQuery({
            operator: "between",
            values: [0, 1000],
          });
          const { getNextFilterParts, getNextFilterColumnName } = setup(opts);
          const updateButton = screen.getByRole("button", {
            name: "Update filter",
          });

          await setOperator("Between");

          const [leftInput, rightInput] =
            screen.getAllByPlaceholderText("Enter a number");
          userEvent.type(leftInput, `{selectall}{backspace}${leftValue}`);
          expect(updateButton).toBeEnabled();

          userEvent.type(rightInput, `{selectall}{backspace}${rightValue}`);
          userEvent.click(updateButton);

          const filterParts = getNextFilterParts();
          expect(filterParts).toMatchObject({
            operator: "between",
            column: expect.anything(),
            values: [leftValue, rightValue],
          });
          expect(getNextFilterColumnName()).toBe("Total");
        },
      );
    });

    describe("with many values", () => {
      it("should update a filter with many values", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup(
          createFilteredQuery({ operator: "=", values: [-1, 0, 1, 2] }),
        );

        userEvent.type(
          screen.getByRole("textbox"),
          "{backspace}{backspace}5,11,7",
        );
        userEvent.click(screen.getByText("Update filter"));

        const filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "=",
          column: expect.anything(),
          values: [-1, 0, 5, 11, 7],
        });
        expect(getNextFilterColumnName()).toBe("Total");
      });
    });

    describe("without a value", () => {
      it("should render a filter with no values", () => {
        setup(createFilteredQuery({ operator: "not-null", values: [] }));

        expect(screen.getByText("Total")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Not empty")).toBeInTheDocument();
        expect(screen.getByText("Update filter")).toBeEnabled();
      });

      it("should update a filter with no values", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup(
          createFilteredQuery({ operator: "not-null", values: [] }),
        );

        await setOperator("Is empty");
        userEvent.click(screen.getByText("Update filter"));

        const filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "is-null",
          column: expect.anything(),
          values: [],
        });
        expect(getNextFilterColumnName()).toBe("Total");
      });
    });

    it("should list operators", async () => {
      setup(createFilteredQuery({ operator: "<" }));

      userEvent.click(screen.getByDisplayValue("Less than"));
      const listbox = await screen.findByRole("listbox");
      const options = within(listbox).getAllByRole("option");

      expect(options).toHaveLength(EXPECTED_OPERATORS.length);
      EXPECTED_OPERATORS.forEach(operatorName =>
        expect(within(listbox).getByText(operatorName)).toBeInTheDocument(),
      );
    });

    it("should change an operator", async () => {
      const opts = createFilteredQuery({
        operator: "<",
        values: [11],
      });
      const { getNextFilterParts, getNextFilterColumnName } = setup(opts);

      await setOperator("Greater than");
      userEvent.click(screen.getByText("Update filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: ">",
        column: expect.anything(),
        values: [11],
      });
      expect(getNextFilterColumnName()).toBe("Total");
    });

    it("should re-use values when changing an operator", async () => {
      setup(createFilteredQuery({ operator: "=", values: [10, 20] }));
      const updateButton = screen.getByRole("button", {
        name: "Update filter",
      });

      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();

      await setOperator("Not equal to");

      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(updateButton).toBeEnabled();

      await setOperator("Greater than");

      expect(screen.getByDisplayValue("10")).toBeInTheDocument();
      expect(screen.queryByText("20")).not.toBeInTheDocument();
      expect(updateButton).toBeEnabled();

      await setOperator("Is empty");

      expect(screen.queryByText("10")).not.toBeInTheDocument();
      expect(screen.queryByText("20")).not.toBeInTheDocument();
      expect(updateButton).toBeEnabled();

      await setOperator("Equal to");

      expect(screen.queryByText("10")).not.toBeInTheDocument();
      expect(screen.queryByText("20")).not.toBeInTheDocument();
      expect(updateButton).toBeDisabled();
    });

    it("should go back", () => {
      const { onBack, onChange } = setup(createFilteredQuery());
      userEvent.click(screen.getByLabelText("Back"));
      expect(onBack).toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
