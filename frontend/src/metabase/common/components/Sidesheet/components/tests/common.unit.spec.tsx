import { screen } from "@testing-library/react";

import { setup } from "./setup";

describe("InsightsTabOrLink (OSS)", () => {
  it("renders nothing for non-admins", async () => {
    setup();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
  it("renders a tab for admins", async () => {
    setup({
      isUserAdmin: true,
    });
    const tab = await screen.findByRole("tab");
    expect(tab).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
