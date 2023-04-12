import React from "react";
import userEvent from "@testing-library/user-event";
import { checkNotNull } from "metabase/core/utils/types";
import { getMetadata } from "metabase/selectors/metadata";
import { Card } from "metabase-types/api";
import { createMockCard, createMockDataset } from "metabase-types/api/mocks";
import { createMockState } from "metabase-types/store/mocks";
import { setupCardQueryDownloadEndpoint } from "__support__/server-mocks";
import { createEntitiesState } from "__support__/store";
import { getIcon, renderWithProviders, screen } from "__support__/ui";
import QueryDownloadWidget from "./QueryDownloadWidget";

interface SetupOpts {
  card?: Card;
}

const setup = ({ card = createMockCard() }: SetupOpts = {}) => {
  const state = createMockState({
    entities: createEntitiesState({
      questions: [card],
    }),
  });

  const metadata = getMetadata(state);
  const question = checkNotNull(metadata.question(card.id));
  const dataset = createMockDataset();

  setupCardQueryDownloadEndpoint(card, "json");

  renderWithProviders(
    <QueryDownloadWidget question={question} result={dataset} />,
  );
};

describe("QueryDownloadWidget", () => {
  it("should display query export options for table questions", async () => {
    setup({
      card: createMockCard({
        display: "table",
      }),
    });

    userEvent.click(getIcon("download"));

    expect(await screen.findByText(/Download/)).toBeInTheDocument();
    expect(screen.getByText(".json")).toBeInTheDocument();
    expect(screen.queryByText(".png")).not.toBeInTheDocument();
  });

  it("should display query export options for chart questions", async () => {
    setup({
      card: createMockCard({
        display: "line",
      }),
    });

    userEvent.click(getIcon("download"));

    expect(await screen.findByText(/Download/)).toBeInTheDocument();
    expect(screen.getByText(".json")).toBeInTheDocument();
    expect(screen.getByText(".png")).toBeInTheDocument();
  });
});
