import { createMockStructuredDatasetQuery } from "metabase-types/api/mocks";
import { createSampleDatabase } from "metabase-types/api/mocks/presets";
import { createMockMetadata } from "__support__/metadata";
import { NumberColumn } from "__support__/visualizations";
import { renderWithProviders, screen } from "__support__/ui";
import Visualization from "metabase/visualizations/components/Visualization";
import registerVisualizations from "metabase/visualizations/register";

registerVisualizations();

const series = (rows, settings = {}) => {
  const cols = [NumberColumn({ name: "Foo" })];
  return [
    {
      card: {
        display: "table",
        visualization_settings: settings,
        dataset_query: createMockStructuredDatasetQuery(),
      },
      data: { rows, cols },
    },
  ];
};

describe("Table", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  it("should render correct background colors", () => {
    const rows = [[1], [2], [3], [4]];
    const settings = {
      "table.column_formatting": [
        {
          color: "#FF0000",
          columns: ["Foo"],
          type: "single",
          operator: ">",
          value: 2,
          highlight_row: false,
        },
      ],
    };
    const metadata = createMockMetadata({ databases: createSampleDatabase() });

    renderWithProviders(
      <Visualization rawSeries={series(rows, settings)} metadata={metadata} />,
    );
    jest.runAllTimers();

    const bgColors = rows
      .map(([value]) => screen.getByText(String(value)))
      .map(element => element.parentNode.style["background-color"]);
    expect(bgColors).toEqual([
      "",
      "",
      "rgba(255, 0, 0, 0.65)",
      "rgba(255, 0, 0, 0.65)",
    ]);
  });
});
