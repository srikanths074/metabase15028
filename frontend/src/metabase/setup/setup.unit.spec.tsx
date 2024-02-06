import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fetchMock from "fetch-mock";
import type { UsageReason } from "metabase-types/api";
import {
  createMockSettingsState,
  createMockSetupState,
  createMockState,
} from "metabase-types/store/mocks";
import { renderWithProviders, screen } from "__support__/ui";
import { Setup } from "./components/Setup";

async function setup({ step = 0 } = {}) {
  const state = createMockState({
    setup: createMockSetupState({
      step,
    }),
    settings: createMockSettingsState({
      "available-locales": [["en", "English"]],
    }),
  });

  fetchMock.post("path:/api/util/password_check", { valid: true });

  renderWithProviders(<Setup />, { storeInitialState: state });

  // there is some async stuff going on with the locale loading
  await screen.findByText("Let's get started");

  return;
}

describe("setup", () => {
  it("default step order should be correct", async () => {
    await setup();
    skipWelcomeScreen();
    /* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectSectionToHaveLabel"] }] */
    expectSectionToHaveLabel("What's your preferred language?", "1");
    expectSectionToHaveLabel("What should we call you?", "2");
    expectSectionToHaveLabel("What will you use Metabase for?", "3");
    expectSectionToHaveLabel("Add your data", "4");
    expectSectionToHaveLabel("Usage data preferences", "5");
  });

  describe("Usage question", () => {
    async function setupForUsageQuestion() {
      await setup();
      skipWelcomeScreen();
      skipLanguageStep();
      await submitUserInfoStep();

      await screen.findByText("Self-service analytics for my own company");
    }

    describe("when selecting 'Self service'", () => {
      it("should keep the 'Add your data' step", async () => {
        await setupForUsageQuestion();
        selectUsageReason("self-service-analytics");
        clickNextStep();

        expect(screen.getByText("Add your data")).toBeInTheDocument();

        expect(getSection("Add your data")).toHaveAttribute(
          "aria-current",
          "step",
        );

        expectSectionToHaveLabel("Add your data", "4");
        expectSectionToHaveLabel("Usage data preferences", "5");
      });
    });

    describe("when selecting 'Embedding'", () => {
      it("should hide the 'Add your data' step", async () => {
        await setupForUsageQuestion();
        selectUsageReason("embedding");
        clickNextStep();

        expect(screen.queryByText("Add your data")).not.toBeInTheDocument();

        expect(getSection("Usage data preferences")).toHaveAttribute(
          "aria-current",
          "step",
        );

        expectSectionToHaveLabel("Usage data preferences", "4");
      });
    });

    describe("when selecting 'A bit of both'", () => {
      it("should keep the 'Add your data' step", async () => {
        await setupForUsageQuestion();
        selectUsageReason("both");
        clickNextStep();

        expect(screen.getByText("Add your data")).toBeInTheDocument();

        expect(getSection("Add your data")).toHaveAttribute(
          "aria-current",
          "step",
        );

        expectSectionToHaveLabel("Add your data", "4");
        expectSectionToHaveLabel("Usage data preferences", "5");
      });
    });

    describe("when selecting 'Not sure yet'", () => {
      it("should keep the 'Add your data' step", async () => {
        await setupForUsageQuestion();
        selectUsageReason("not-sure");
        clickNextStep();

        expect(screen.getByText("Add your data")).toBeInTheDocument();

        expect(getSection("Add your data")).toHaveAttribute(
          "aria-current",
          "step",
        );

        expectSectionToHaveLabel("Add your data", "4");
        expectSectionToHaveLabel("Usage data preferences", "5");
      });
    });
  });
});

const getSection = (name: string) => screen.getByRole("listitem", { name });

const clickNextStep = () =>
  userEvent.click(screen.getByRole("button", { name: "Next" }));

const skipWelcomeScreen = () =>
  userEvent.click(screen.getByText("Let's get started"));

const skipLanguageStep = () => clickNextStep();

const submitUserInfoStep = async ({
  firstName = "John",
  lastName = "Smith",
  email = "john@example.org",
  companyName = "Acme",
  password = "Monkeyabc123",
} = {}) => {
  userEvent.type(screen.getByLabelText("First name"), firstName);
  userEvent.type(screen.getByLabelText("Last name"), lastName);
  userEvent.type(screen.getByLabelText("Email"), email);
  userEvent.type(screen.getByLabelText("Company or team name"), companyName);
  userEvent.type(screen.getByLabelText("Create a password"), password);
  userEvent.type(screen.getByLabelText("Confirm your password"), password);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
  );
  clickNextStep();
};

const selectUsageReason = (usageReason: UsageReason) => {
  const label = {
    "self-service-analytics": "Self-service analytics for my own company",
    embedding: "Embedding analytics into my application",
    both: "A bit of both",
    "not-sure": "Not sure yet",
  }[usageReason];

  userEvent.click(screen.getByLabelText(label));
};

const expectSectionToHaveLabel = (sectionName: string, label: string) => {
  const section = getSection(sectionName);

  expect(within(section).getByText(label)).toBeInTheDocument();
};
