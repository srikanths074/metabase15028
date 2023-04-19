import { ORDERS, PEOPLE } from "__support__/sample_database_fixture";
import { DatasetColumn, DatetimeUnit } from "metabase-types/api";
import { ClickObject, QuestionChangeClickAction } from "metabase/modes/types";
import { StructuredDatasetQuery } from "metabase-types/types/Card";
import type Question from "metabase-lib/Question";
import ZoomDrill from "./ZoomDrill";

describe("ZoomDrill", () => {
  it("should not be valid for top level actions", () => {
    expect(ZoomDrill({ question: ORDERS.newQuestion() })).toHaveLength(0);
  });

  it("should return correct new breakout value for month -> week", () => {
    const actions = ZoomDrill(setupDateFieldQuery("month"));

    expect(actions).toHaveLength(1);

    const action = actions[0] as QuestionChangeClickAction;
    const question = action.question();
    expect((question.datasetQuery() as StructuredDatasetQuery).query).toEqual({
      "source-table": ORDERS.id,
      aggregation: [["count"]],
      filter: [
        "=",
        ["field", ORDERS.CREATED_AT.id, { "temporal-unit": "month" }],
        "2018-01-01T00:00:00Z",
      ],
      breakout: [["field", ORDERS.CREATED_AT.id, { "temporal-unit": "week" }]],
    });
    expect(question.display()).toEqual("line");
  });

  describe("title", () => {
    it.each<[DatetimeUnit, DatetimeUnit]>([
      ["year", "quarter"],
      ["month", "week"],
      ["week", "day"],
    ])(
      "should return specific title for date field: %s -> %s",
      (granularity, newGranularity) => {
        const actions = ZoomDrill(setupDateFieldQuery(granularity));

        expect(actions).toHaveLength(1);

        const action = actions[0] as QuestionChangeClickAction;
        expect(action.title).toBe(
          `See this ${granularity} by ${newGranularity}`,
        );
      },
    );

    it("should return generic title for non-date field", () => {
      const actions = ZoomDrill(setupCategoryFieldQuery());

      expect(actions).toHaveLength(1);

      const action = actions[0] as QuestionChangeClickAction;
      expect(action.title).toBe(`Zoom in`);
    });
  });
});

function setupDateFieldQuery(temporalUnit: DatetimeUnit | string): {
  question: Question;
  clicked: ClickObject;
} {
  const query = ORDERS.query()
    .aggregate(["count"])
    .breakout([
      "field",
      ORDERS.CREATED_AT.id,
      { "temporal-unit": temporalUnit },
    ]);

  const question = query.question();

  const clicked = {
    column: query.aggregationDimensions()[0].column(),
    value: 42,
    dimensions: [
      {
        column: ORDERS.CREATED_AT.dimension()
          .withTemporalUnit(temporalUnit)
          .column() as DatasetColumn,
        value: "2018-01-01T00:00:00Z",
      },
    ],
  };

  return { question, clicked };
}

function setupCategoryFieldQuery() {
  const query = PEOPLE.query()
    .aggregate(["count"])
    .breakout(["field", PEOPLE.STATE.id]);

  const question = query.question();

  const clicked = {
    column: query.aggregationDimensions()[0].column(),
    value: 194,
    dimensions: [
      {
        column: PEOPLE.STATE.dimension().column() as DatasetColumn,
        value: "TX",
      },
    ],
  };

  return { question, clicked };
}
