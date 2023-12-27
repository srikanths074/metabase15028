import { act, renderHook } from "@testing-library/react-hooks";
import { checkNotNull } from "metabase/lib/types";
import * as Lib from "metabase-lib";
import { PEOPLE_ID } from "metabase-types/api/mocks/presets";
import { columnFinder, createQuery } from "metabase-lib/test-helpers";
import { useCoordinateFilter } from "./use-coordinate-filter";

interface CreateFilterCase {
  operator: Lib.CoordinateFilterOperatorName;
  values: number[];
  displayName: string;
}

interface UpdateFilterCase {
  operator: Lib.CoordinateFilterOperatorName;
  expression: Lib.ExpressionClause;
  values: number[];
  displayName: string;
}

interface CoerceFilterCase {
  operator: Lib.CoordinateFilterOperatorName;
  values: (number | "")[];
  displayName: string;
}

interface ValidateFilterCase {
  operator: Lib.CoordinateFilterOperatorName;
  values: (number | "")[];
}

describe("useCoordinateFilter", () => {
  const defaultQuery = Lib.withDifferentTable(createQuery(), PEOPLE_ID);
  const stageIndex = 0;
  const availableColumns = Lib.filterableColumns(defaultQuery, stageIndex);
  const latitudeColumn = columnFinder(defaultQuery, availableColumns)(
    "PEOPLE",
    "LATITUDE",
  );
  const longitudeColumn = columnFinder(defaultQuery, availableColumns)(
    "PEOPLE",
    "LONGITUDE",
  );

  it.each<CreateFilterCase>([
    {
      operator: "=",
      values: [10, 20],
      displayName: "Latitude is equal to 2 selections",
    },
    {
      operator: "!=",
      values: [10],
      displayName: "Latitude is not equal to 10",
    },
    {
      operator: ">",
      values: [10],
      displayName: "Latitude is greater than 10",
    },
  ])(
    'should allow to create a filter for "$operator" operator',
    ({ operator, values, displayName }) => {
      const { result } = renderHook(() =>
        useCoordinateFilter({
          query: defaultQuery,
          stageIndex,
          column: latitudeColumn,
        }),
      );

      act(() => {
        const { setOperator, setValues } = result.current;
        setOperator(operator);
        setValues(values);
      });

      act(() => {
        const { operator, values, getFilterClause } = result.current;
        const newFilter = checkNotNull(
          getFilterClause(operator, longitudeColumn, values),
        );

        expect(
          Lib.displayInfo(defaultQuery, stageIndex, newFilter),
        ).toMatchObject({
          displayName,
        });
      });
    },
  );

  it.each<UpdateFilterCase>([
    {
      operator: "=",
      expression: Lib.coordinateFilterClause({
        operator: "=",
        column: latitudeColumn,
        longitudeColumn,
        values: [10],
      }),
      values: [20],
      displayName: "Latitude is equal to 20",
    },
  ])(
    'should allow to update a filter for "$operator" operator',
    ({ expression, values, displayName }) => {
      const query = Lib.filter(defaultQuery, stageIndex, expression);
      const [filter] = Lib.filters(query, stageIndex);

      const { result } = renderHook(() =>
        useCoordinateFilter({
          query,
          stageIndex,
          column: latitudeColumn,
          filter,
        }),
      );

      act(() => {
        const { setValues } = result.current;
        setValues(values);
      });

      act(() => {
        const { operator, values, getFilterClause } = result.current;
        const newFilter = checkNotNull(
          getFilterClause(operator, longitudeColumn, values),
        );

        expect(Lib.displayInfo(query, stageIndex, newFilter)).toMatchObject({
          displayName,
        });
      });
    },
  );

  it.each<CoerceFilterCase>([
    {
      operator: "between",
      values: [20, 10],
      displayName: "Latitude is between 10 and 20",
    },
    {
      operator: "between",
      values: [10, ""],
      displayName: "Latitude is greater than or equal to 10",
    },
    {
      operator: "between",
      values: ["", 10],
      displayName: "Latitude is less than or equal to 10",
    },
    {
      operator: "inside",
      values: [-90, 180, 90, -180],
      displayName:
        "Latitude is between -90 and 90 and Longitude is between -180 and 180",
    },
  ])(
    'should allow to coerce a filter for "$operator" operator',
    ({ operator, values, displayName }) => {
      const { result } = renderHook(() =>
        useCoordinateFilter({
          query: defaultQuery,
          stageIndex,
          column: latitudeColumn,
        }),
      );

      act(() => {
        const { getFilterClause } = result.current;
        const newFilter = checkNotNull(
          getFilterClause(operator, longitudeColumn, values),
        );

        expect(
          Lib.displayInfo(defaultQuery, stageIndex, newFilter),
        ).toMatchObject({
          displayName,
        });
      });
    },
  );

  it.each<ValidateFilterCase>([
    {
      operator: "=",
      values: [],
    },
    {
      operator: ">",
      values: [""],
    },
    {
      operator: "between",
      values: ["", ""],
    },
    {
      operator: "inside",
      values: ["", "", "", ""],
    },
  ])(
    'should validate values for "$operator" operator',
    ({ operator, values }) => {
      const { result } = renderHook(() =>
        useCoordinateFilter({
          query: defaultQuery,
          stageIndex,
          column: latitudeColumn,
        }),
      );

      act(() => {
        const { setOperator, setValues } = result.current;
        setOperator(operator);
        setValues(values);
      });

      act(() => {
        const { operator, values, isValid, getFilterClause } = result.current;
        expect(isValid).toBeFalsy();
        expect(
          getFilterClause(operator, longitudeColumn, values),
        ).toBeUndefined();
      });
    },
  );

  it("should preserve values when switching operators", () => {
    const { result } = renderHook(() =>
      useCoordinateFilter({
        query: defaultQuery,
        stageIndex,
        column: latitudeColumn,
      }),
    );

    act(() => {
      const { setValues } = result.current;
      setValues([10]);
    });

    act(() => {
      const { values, getDefaultValues, setOperator, setValues } =
        result.current;
      const newOperator = "!=";
      setOperator(newOperator);
      setValues(getDefaultValues(newOperator, values));
    });

    act(() => {
      const { operator, values, getFilterClause } = result.current;
      const newFilter = checkNotNull(
        getFilterClause(operator, longitudeColumn, values),
      );

      expect(
        Lib.displayInfo(defaultQuery, stageIndex, newFilter),
      ).toMatchObject({
        displayName: "Latitude is not equal to 10",
      });
    });
  });
});
