import { createMockField } from "metabase-types/api/mocks";
import {
  createOrdersTable,
  createPeopleTable,
  createProductsTable,
  createReviewsTable,
  createSampleDatabase,
  PEOPLE_ID,
} from "metabase-types/api/mocks/presets";
import { createMockMetadata } from "__support__/metadata";
import * as Lib from "metabase-lib";
import { columnFinder, createQuery } from "metabase-lib/test-helpers";

const PEOPLE_TABLE = createPeopleTable();

const BOOLEAN_FIELD = createMockField({
  id: 101,
  table_id: PEOPLE_ID,
  name: "IS_TRIAL",
  display_name: "Is Trial",
  base_type: "type/Boolean",
  effective_type: "type/Boolean",
  semantic_type: "type/Category",
});

const TIME_FIELD = createMockField({
  id: 102,
  table_id: PEOPLE_ID,
  name: "START_AT",
  display_name: "Start At",
  base_type: "type/Time",
  effective_type: "type/Time",
  semantic_type: null,
});

const DATABASE = createSampleDatabase({
  tables: [
    createOrdersTable(),
    createProductsTable(),
    createReviewsTable(),
    createPeopleTable({
      fields: [...(PEOPLE_TABLE.fields ?? []), BOOLEAN_FIELD, TIME_FIELD],
    }),
  ],
});

const METADATA = createMockMetadata({
  databases: [DATABASE],
});

function findColumn(query: Lib.Query, tableName: string, columnName: string) {
  const columns = Lib.filterableColumns(query, 0);
  return columnFinder(query, columns)(tableName, columnName);
}

function addFilter<T extends Lib.FilterParts>(
  query: Lib.Query,
  filterClause: Lib.ExpressionClause,
  getFilterParts: (
    query: Lib.Query,
    stageIndex: number,
    clause: Lib.FilterClause,
  ) => T | null,
) {
  const newQuery = Lib.filter(query, 0, filterClause);
  const [newFilterClause] = Lib.filters(newQuery, 0);
  const newFilterParts = getFilterParts(newQuery, 0, newFilterClause);
  const newColumnInfo = newFilterParts
    ? Lib.displayInfo(newQuery, 0, newFilterParts.column)
    : null;

  return {
    newQuery,
    filterParts: newFilterParts,
    columnInfo: newColumnInfo,
  };
}

function addStringFilter(query: Lib.Query, filterClause: Lib.ExpressionClause) {
  return addFilter(query, filterClause, Lib.stringFilterParts);
}

function addNumberFilter(query: Lib.Query, filterClause: Lib.ExpressionClause) {
  return addFilter(query, filterClause, Lib.numberFilterParts);
}

function addCoordinateFilter(
  query: Lib.Query,
  filterClause: Lib.ExpressionClause,
) {
  const { newQuery, filterParts, columnInfo } = addFilter(
    query,
    filterClause,
    Lib.coordinateFilterParts,
  );
  const longitudeColumnInfo = filterParts?.longitudeColumn
    ? Lib.displayInfo(newQuery, 0, filterParts.longitudeColumn)
    : null;

  return { newQuery, filterParts, columnInfo, longitudeColumnInfo };
}

function addBooleanFilter(
  query: Lib.Query,
  filterClause: Lib.ExpressionClause,
) {
  return addFilter(query, filterClause, Lib.booleanFilterParts);
}

function addTimeFilter(query: Lib.Query, filterClause: Lib.ExpressionClause) {
  return addFilter(query, filterClause, Lib.timeFilterParts);
}

function addExcludeDateFilter(
  query: Lib.Query,
  filterClause: Lib.ExpressionClause,
) {
  return addFilter(query, filterClause, Lib.excludeDateFilterParts);
}

describe("filter", () => {
  const query = createQuery({ metadata: METADATA });

  describe("string filters", () => {
    const tableName = "PRODUCTS";
    const columnName = "CATEGORY";
    const column = findColumn(query, tableName, columnName);

    it.each<Lib.StringFilterOperatorName>([
      "=",
      "!=",
      "contains",
      "does-not-contain",
      "starts-with",
      "ends-with",
    ])(
      'should be able to create and destructure a string filter with "%s" operator and 1 value',
      operator => {
        const { filterParts, columnInfo } = addStringFilter(
          query,
          Lib.stringFilterClause({
            operator,
            column,
            values: ["Gadget"],
            options: {},
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: ["Gadget"],
          options: {},
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.StringFilterOperatorName>(["=", "!="])(
      'should be able to create and destructure a string filter with "%s" operator and multiple values',
      operator => {
        const { filterParts, columnInfo } = addStringFilter(
          query,
          Lib.stringFilterClause({
            operator,
            column,
            values: ["Gadget", "Widget"],
            options: {},
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: ["Gadget", "Widget"],
          options: {},
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.StringFilterOperatorName>([
      "is-null",
      "not-null",
      "is-empty",
      "not-empty",
    ])(
      'should be able to create and destructure a string filter with "%s" operator without values',
      operator => {
        const { filterParts, columnInfo } = addStringFilter(
          query,
          Lib.stringFilterClause({
            operator,
            column,
            values: [],
            options: {},
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [],
          options: {},
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.StringFilterOperatorName>([
      "contains",
      "does-not-contain",
      "starts-with",
      "ends-with",
    ])(
      'should fill defaults for case sensitivity options for "%s" operator',
      () => {
        const { filterParts, columnInfo } = addStringFilter(
          query,
          Lib.stringFilterClause({
            operator: "starts-with",
            column,
            values: ["Gadget"],
            options: {},
          }),
        );

        expect(filterParts).toMatchObject({
          operator: "starts-with",
          column: expect.anything(),
          values: ["Gadget"],
          options: { "case-sensitive": false },
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.StringFilterOperatorName>([
      "contains",
      "does-not-contain",
      "starts-with",
      "ends-with",
    ])('should use provided case sensitivity options for "%s" operator', () => {
      const { filterParts, columnInfo } = addStringFilter(
        query,
        Lib.stringFilterClause({
          operator: "starts-with",
          column,
          values: ["Gadget"],
          options: { "case-sensitive": true },
        }),
      );

      expect(filterParts).toMatchObject({
        operator: "starts-with",
        column: expect.anything(),
        values: ["Gadget"],
        options: { "case-sensitive": true },
      });
      expect(columnInfo?.name).toBe(columnName);
    });

    it.each<Lib.StringFilterOperatorName>(["=", "!="])(
      'should ignore case sensitivity options as they are not supported by "%s" operator and 1 value',
      operator => {
        const { filterParts, columnInfo } = addStringFilter(
          query,
          Lib.stringFilterClause({
            operator,
            column,
            values: ["Gadget"],
            options: { "case-sensitive": true },
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: ["Gadget"],
          options: {},
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.StringFilterOperatorName>([
      "is-null",
      "not-null",
      "is-empty",
      "not-empty",
    ])(
      'should ignore case sensitivity options as they are not supported by "%s" operator without values',
      operator => {
        const { filterParts, columnInfo } = addStringFilter(
          query,
          Lib.stringFilterClause({
            operator,
            column,
            values: [],
            options: { "case-sensitive": true },
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [],
          options: {},
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it("should ignore expressions with not supported operators", () => {
      const { filterParts } = addStringFilter(
        query,
        Lib.expressionClause("concat", [
          findColumn(query, tableName, columnName),
          "A",
        ]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions without first column", () => {
      const { filterParts } = addStringFilter(
        query,
        Lib.expressionClause("=", ["A", column]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions with non-string arguments", () => {
      const { filterParts } = addStringFilter(
        query,
        Lib.expressionClause("=", [column, column]),
      );

      expect(filterParts).toBeNull();
    });
  });

  describe("number filters", () => {
    const tableName = "ORDERS";
    const columnName = "TOTAL";
    const column = findColumn(query, tableName, columnName);

    it.each<Lib.NumberFilterOperatorName>(["=", "!=", ">", ">", ">=", "<="])(
      'should be able to create and destructure a number filter with "%s" operator and 1 value',
      operator => {
        const { filterParts, columnInfo } = addNumberFilter(
          query,
          Lib.numberFilterClause({
            operator,
            column,
            values: [10],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [10],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.NumberFilterOperatorName>(["=", "!="])(
      'should be able to create and destructure a number filter with "%s" operator and multiple values',
      operator => {
        const { filterParts, columnInfo } = addNumberFilter(
          query,
          Lib.numberFilterClause({
            operator,
            column,
            values: [1, 2, 3],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [1, 2, 3],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.NumberFilterOperatorName>(["between"])(
      'should be able to create and destructure a number filter with "%s" operator and exactly 2 values',
      operator => {
        const { filterParts, columnInfo } = addNumberFilter(
          query,
          Lib.numberFilterClause({
            operator,
            column,
            values: [1, 2],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [1, 2],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.NumberFilterOperatorName>(["is-null", "not-null"])(
      'should be able to create and destructure a number filter with "%s" operator without values',
      operator => {
        const { filterParts, columnInfo } = addNumberFilter(
          query,
          Lib.numberFilterClause({
            operator,
            column,
            values: [],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it("should ignore expressions with not supported operators", () => {
      const { filterParts } = addNumberFilter(
        query,
        Lib.expressionClause("+", [
          findColumn(query, tableName, columnName),
          10,
        ]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions without first column", () => {
      const { filterParts } = addNumberFilter(
        query,
        Lib.expressionClause("=", [10, column]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions with non-numeric arguments", () => {
      const { filterParts } = addNumberFilter(
        query,
        Lib.expressionClause("=", [column, column]),
      );

      expect(filterParts).toBeNull();
    });
  });

  describe("coordinate filters", () => {
    const tableName = "PEOPLE";
    const columnName = "LATITUDE";
    const column = findColumn(query, tableName, columnName);

    it.each<Lib.CoordinateFilterOperatorName>([
      "=",
      "!=",
      ">",
      ">",
      ">=",
      "<=",
    ])(
      'should be able to create and destructure a coordinate filter with "%s" operator and 1 value',
      operator => {
        const { filterParts, columnInfo } = addCoordinateFilter(
          query,
          Lib.coordinateFilterClause({
            operator,
            column,
            values: [10],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [10],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.CoordinateFilterOperatorName>(["=", "!="])(
      'should be able to create and destructure a coordinate filter with "%s" operator and multiple values',
      operator => {
        const { filterParts, columnInfo } = addCoordinateFilter(
          query,
          Lib.coordinateFilterClause({
            operator,
            column,
            values: [1, 2, 3],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [1, 2, 3],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.CoordinateFilterOperatorName>(["between"])(
      'should be able to create and destructure a coordinate filter with "%s" operator and exactly 2 values',
      operator => {
        const { filterParts, columnInfo } = addCoordinateFilter(
          query,
          Lib.coordinateFilterClause({
            operator,
            column,
            values: [1, 2],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [1, 2],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it('should be able to create and destructure a coordinate filter with "inside" operator and 1 column', () => {
      const { filterParts, columnInfo, longitudeColumnInfo } =
        addCoordinateFilter(
          query,
          Lib.coordinateFilterClause({
            operator: "inside",
            column,
            values: [1, 2, 3, 4],
          }),
        );

      expect(filterParts).toMatchObject({
        operator: "inside",
        column: expect.anything(),
        longitudeColumn: expect.anything(),
        values: [1, 2, 3, 4],
      });
      expect(columnInfo?.name).toBe(columnName);
      expect(longitudeColumnInfo?.name).toBe(columnName);
    });

    it('should be able to create and destructure a coordinate filter with "inside" operator and 2 columns', () => {
      const { filterParts, columnInfo, longitudeColumnInfo } =
        addCoordinateFilter(
          query,
          Lib.coordinateFilterClause({
            operator: "inside",
            column,
            longitudeColumn: findColumn(query, tableName, "LONGITUDE"),
            values: [1, 2, 3, 4],
          }),
        );

      expect(filterParts).toMatchObject({
        operator: "inside",
        column: expect.anything(),
        longitudeColumn: expect.anything(),
        values: [1, 2, 3, 4],
      });
      expect(columnInfo?.name).toBe(columnName);
      expect(longitudeColumnInfo?.name).toBe("LONGITUDE");
    });

    it("should ignore expressions with not supported operators", () => {
      const { filterParts } = addCoordinateFilter(
        query,
        Lib.expressionClause("+", [
          findColumn(query, tableName, columnName),
          10,
        ]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions without first column", () => {
      const { filterParts } = addCoordinateFilter(
        query,
        Lib.expressionClause("=", [10, column]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions with non-numeric arguments", () => {
      const { filterParts } = addCoordinateFilter(
        query,
        Lib.expressionClause("=", [column, column]),
      );

      expect(filterParts).toBeNull();
    });
  });

  describe("boolean filters", () => {
    const tableName = "PEOPLE";
    const columnName = BOOLEAN_FIELD.name;
    const column = findColumn(query, tableName, columnName);

    it.each([true, false])(
      'should be able to create and destructure a boolean filter with "=" operator and a "%s" value',
      value => {
        const { filterParts, columnInfo } = addBooleanFilter(
          query,
          Lib.booleanFilterClause({
            operator: "=",
            column,
            values: [value],
          }),
        );

        expect(filterParts).toMatchObject({
          operator: "=",
          column: expect.anything(),
          values: [value],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.BooleanFilterOperatorName>(["is-null", "not-null"])(
      'should be able to create and destructure a boolean filter with "%s" operator without values',
      operator => {
        const { filterParts, columnInfo } = addBooleanFilter(
          query,
          Lib.booleanFilterClause({
            operator,
            column,
            values: [],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it("should ignore expressions with not supported operators", () => {
      const { filterParts } = addBooleanFilter(
        query,
        Lib.expressionClause("!=", [
          findColumn(query, tableName, columnName),
          true,
        ]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions without first column", () => {
      const { filterParts } = addBooleanFilter(
        query,
        Lib.expressionClause("=", [true, column]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions with non-boolean arguments", () => {
      const { filterParts } = addBooleanFilter(
        query,
        Lib.expressionClause("=", [column, column]),
      );

      expect(filterParts).toBeNull();
    });
  });

  describe("time filters", () => {
    const tableName = "PEOPLE";
    const columnName = TIME_FIELD.name;
    const column = findColumn(query, tableName, columnName);

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2020, 0, 1));
    });

    it.each<Lib.TimeFilterOperatorName>([">", "<"])(
      'should be able to create and destructure a time filter with "%s" operator and 1 value',
      operator => {
        const { filterParts, columnInfo } = addTimeFilter(
          query,
          Lib.timeFilterClause({
            operator,
            column,
            values: [new Date(2015, 0, 1, 10, 20)],
          }),
        );

        expect(filterParts).toMatchObject({
          operator,
          column: expect.anything(),
          values: [new Date(2020, 0, 1, 10, 20)],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it('should be able to create and destructure a time filter with "between" operator and 2 values', () => {
      const { filterParts, columnInfo } = addTimeFilter(
        query,
        Lib.timeFilterClause({
          operator: "between",
          column,
          values: [new Date(2015, 0, 1, 10, 20), new Date(2015, 0, 1, 18, 50)],
        }),
      );

      expect(filterParts).toMatchObject({
        operator: "between",
        column: expect.anything(),
        values: [new Date(2020, 0, 1, 10, 20), new Date(2020, 0, 1, 18, 50)],
      });
      expect(columnInfo?.name).toBe(columnName);
    });

    it("should ignore expressions with not supported operators", () => {
      const { filterParts } = addTimeFilter(
        query,
        Lib.expressionClause("=", [column, "10:20:00.000"]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions without first column", () => {
      const { filterParts } = addTimeFilter(
        query,
        Lib.expressionClause(">", ["10:20:00.000", column]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions with non-time arguments", () => {
      const { filterParts } = addTimeFilter(
        query,
        Lib.expressionClause(">", [column, column]),
      );

      expect(filterParts).toBeNull();
    });
  });

  describe("exclude date filters", () => {
    const tableName = "PRODUCTS";
    const columnName = "CREATED_AT";
    const column = findColumn(query, tableName, columnName);

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2020, 0, 1));
    });

    it.each<Lib.ExcludeDateBucketName>([
      "hour-of-day",
      "day-of-week",
      "month-of-year",
      "quarter-of-year",
    ])(
      'should be able to create and destructure an exclude date filter with "%s" bucket and multiple values',
      bucket => {
        const { filterParts, columnInfo } = addExcludeDateFilter(
          query,
          Lib.excludeDateFilterClause(query, 0, {
            operator: "!=",
            column,
            bucket,
            values: [1, 2],
          }),
        );

        expect(filterParts).toMatchObject({
          operator: "!=",
          column: expect.anything(),
          bucket,
          values: [1, 2],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it.each<Lib.ExcludeDateFilterOperatorName>(["is-null", "not-null"])(
      'should be able to create and destructure an exclude date filter with "%s" operator without values',
      operator => {
        const { filterParts, columnInfo } = addExcludeDateFilter(
          query,
          Lib.excludeDateFilterClause(query, 0, {
            operator,
            column,
            bucket: null,
            values: [1, 2],
          }),
        );

        expect(filterParts).toMatchObject({
          operator: "!=",
          column: expect.anything(),
          bucket: null,
          values: [1, 2],
        });
        expect(columnInfo?.name).toBe(columnName);
      },
    );

    it("should ignore expressions with not supported operators", () => {
      const { filterParts } = addTimeFilter(
        query,
        Lib.expressionClause("=", [column, "2020-01-01"]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions without first column", () => {
      const { filterParts } = addTimeFilter(
        query,
        Lib.expressionClause("!=", ["2020-01-01", column]),
      );

      expect(filterParts).toBeNull();
    });

    it("should ignore expressions with non-time arguments", () => {
      const { filterParts } = addExcludeDateFilter(
        query,
        Lib.expressionClause("!=", [column, column]),
      );

      expect(filterParts).toBeNull();
    });
  });
});
