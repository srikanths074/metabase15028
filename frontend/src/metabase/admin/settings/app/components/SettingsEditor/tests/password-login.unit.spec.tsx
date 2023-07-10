import userEvent from "@testing-library/user-event";
import {
  createMockSettingDefinition,
  createMockSettings,
  createMockTokenFeatures,
} from "metabase-types/api/mocks";
import { screen } from "__support__/ui";
import { setup, SetupOpts } from "./setup";

const setupEnterprise = (opts?: SetupOpts) => {
  setup({
    ...opts,
    tokenFeatures: createMockTokenFeatures({
      disable_password_login: true,
    }),
    hasEnterprisePlugins: true,
  });
};

describe("SettingsEditor", () => {
  it("should allow to toggle off password login", async () => {
    setupEnterprise({
      definitions: [
        createMockSettingDefinition({ key: "enable-password-login" }),
        createMockSettingDefinition({ key: "google-auth-enabled" }),
      ],
      settingValues: createMockSettings({
        "enable-password-login": true,
        "google-auth-enabled": true,
      }),
    });

    userEvent.click(await screen.findByText("Authentication"));
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    expect(
      screen.getByText("Enable Password Authentication"),
    ).toBeInTheDocument();
  });
});
