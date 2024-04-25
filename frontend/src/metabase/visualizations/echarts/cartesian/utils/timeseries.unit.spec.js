import { StringColumn, NumberColumn } from "__support__/visualizations";
import { getVisualizationTransformed } from "metabase/visualizations";
import {
  computeTimeseriesDataInverval,
  getTimezone,
  computeTimeseriesTicksInterval,
} from "metabase/visualizations/echarts/cartesian/utils/timeseries";
import registerVisualizations from "metabase/visualizations/register";

registerVisualizations();

describe("visualization.lib.timeseries", () => {
  describe("computeTimeseriesDataInvervalIndex", () => {
    const TEST_CASES = [
      ["ms", 1, [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:02:01.001Z"]]],
      [
        "second",
        1,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:02:01.000Z"]],
      ],
      [
        "second",
        5,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:02:05.000Z"]],
      ],
      [
        "second",
        15,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:02:15.000Z"]],
      ],
      [
        "second",
        30,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:02:30.000Z"]],
      ],
      [
        "minute",
        1,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:02:00.000Z"]],
      ],
      [
        "minute",
        5,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:05:00.000Z"]],
      ],
      [
        "minute",
        15,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:15:00.000Z"]],
      ],
      [
        "minute",
        30,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:30:00.000Z"]],
      ],
      ["hour", 1, [["2015-01-01T00:00:00.000Z"], ["2016-05-04T01:00:00.000Z"]]],
      ["hour", 3, [["2015-01-01T00:00:00.000Z"], ["2016-05-04T03:00:00.000Z"]]],
      ["hour", 6, [["2015-01-01T00:00:00.000Z"], ["2016-05-04T06:00:00.000Z"]]],
      [
        "hour",
        12,
        [["2015-01-01T00:00:00.000Z"], ["2016-05-04T12:00:00.000Z"]],
      ],
      ["day", 1, [["2015-01-01T00:00:00.000Z"], ["2015-01-02T00:00:00.000Z"]]],
      ["week", 1, [["2015-01-01T00:00:00.000Z"], ["2015-01-08T00:00:00.000Z"]]],
      ["week", 1, [["2015-01-31T00:00:00.000Z"], ["2015-02-07T00:00:00.000Z"]]], // (metabase#14605)
      [
        "month",
        1,
        [["2015-01-01T00:00:00.000Z"], ["2015-02-01T00:00:00.000Z"]],
      ],
      [
        "month",
        3,
        [["2015-01-01T00:00:00.000Z"], ["2015-04-01T00:00:00.000Z"]],
      ],
      ["year", 1, [["2015-01-01T00:00:00.000Z"], ["2016-01-01T00:00:00.000Z"]]],
      ["year", 5, [["2015-01-01T00:00:00.000Z"], ["2020-01-01T00:00:00.000Z"]]],
      [
        "year",
        10,
        [["2015-01-01T00:00:00.000Z"], ["2025-01-01T00:00:00.000Z"]],
      ],
      [
        "year",
        100,
        [["2015-01-01T00:00:00.000Z"], ["2115-01-01T00:00:00.000Z"]],
      ],
      ["day", 1, [["2019-01-01T00:00:00.000Z"]]],
    ];

    TEST_CASES.map(([expectedUnit, expectedCount, data]) => {
      it(`should return ${expectedCount} ${expectedUnit}`, () => {
        const { unit, count } = computeTimeseriesDataInverval(
          data.map(d => new Date(d)),
        );
        expect(unit).toBe(expectedUnit);
        expect(count).toBe(expectedCount);
      });
    });

    const units = ["minute", "hour", "day", "week", "month", "year"];

    units.forEach(testUnit => {
      it(`should return one ${testUnit} when ${testUnit} interval is set`, () => {
        const { unit, count } = computeTimeseriesDataInverval(
          [
            new Date("2019-01-01").toISOString(),
            new Date("2020-01-01").toISOString(),
          ],
          testUnit,
        );
        expect(unit).toBe(testUnit);
        expect(count).toBe(1);
      });
    });

    it("should return 3 months for quarter interval", () => {
      const { unit, count } = computeTimeseriesDataInverval(
        [
          new Date("2019-01-01").toISOString(),
          new Date("2020-01-01").toISOString(),
        ],
        "quarter",
      );
      expect(unit).toBe("month");
      expect(count).toBe(3);
    });
  });

  describe("getTimezone", () => {
    const series = [
      {
        card: { visualization_settings: {}, display: "bar" },
        data: {
          results_timezone: "US/Eastern",
          cols: [StringColumn({ name: "a" }), NumberColumn({ name: "b" })],
          rows: [],
        },
      },
    ];
    it("should extract results_timezone", () => {
      const timezone = getTimezone(series);
      expect(timezone).toBe("US/Eastern");
    });
    it("should extract results_timezone after series is transformed", () => {
      const { series: transformed } = getVisualizationTransformed(series);
      const timezone = getTimezone(transformed);
      expect(timezone).toBe("US/Eastern");
    });
  });

  describe("computeTimeseriesTicksInterval", () => {
    // computeTimeseriesTicksInterval just uses tickFormat to measure the character length of the current formatting style
    const fakeTickFormat = () => "2020-01-01";
    const TEST_CASES = [
      // on a wide chart, 12 month ticks shouldn't be changed
      [
        {
          xDomain: [new Date("2020-01-01"), new Date("2021-01-01")],
          xInterval: { interval: "month", count: 1 },
          chartWidth: 1920,
          tickFormat: fakeTickFormat,
        },
        { expectedUnit: "month", expectedCount: 1 },
      ],
      // it should be bump to quarters on a narrower chart
      [
        {
          xDomain: [new Date("2020-01-01"), new Date("2021-01-01")],
          xInterval: { interval: "month", count: 1 },
          chartWidth: 800,
          tickFormat: fakeTickFormat,
        },
        { expectedUnit: "month", expectedCount: 3 },
      ],
      // even narrower and we should show yearly ticks
      [
        {
          xDomain: [new Date("2020-01-01"), new Date("2021-01-01")],
          xInterval: { interval: "month", count: 1 },
          chartWidth: 300,
          tickFormat: fakeTickFormat,
        },
        { expectedUnit: "year", expectedCount: 1 },
      ],
      // shouldn't move to a more granular interval than what was passed
      [
        {
          xDomain: [new Date("2020-01-01"), new Date("2021-01-01")],
          xInterval: { interval: "month", count: 3 },
          chartWidth: 1920,
          tickFormat: fakeTickFormat,
        },
        { expectedUnit: "month", expectedCount: 3 },
      ],
      // Long date formats should update the interval to have fewer ticks
      [
        {
          xDomain: [new Date("2020-01-01"), new Date("2021-01-01")],
          xInterval: { interval: "month", count: 1 },
          chartWidth: 1920,
          tickFormat: () =>
            // thankfully no date format is actually this long
            "The eigth day of July in the year of our Lord two thousand and ninteen",
        },
        { expectedUnit: "year", expectedCount: 1 },
      ],
    ];

    TEST_CASES.map(
      ([
        { xDomain, xInterval, chartWidth, tickFormat },
        { expectedUnit, expectedCount },
      ]) => {
        it(`should return ${expectedCount} ${expectedUnit}`, () => {
          const { unit, count } = computeTimeseriesTicksInterval(
            xDomain,
            xInterval,
            chartWidth,
            tickFormat,
          );
          expect(unit).toBe(expectedUnit);
          expect(count).toBe(expectedCount);
        });
      },
    );
  });
});
