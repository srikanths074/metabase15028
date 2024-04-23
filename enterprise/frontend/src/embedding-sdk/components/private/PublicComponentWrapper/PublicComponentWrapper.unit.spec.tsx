import { renderWithProviders, screen } from "__support__/ui";
import { SDK_REDUCERS } from "embedding-sdk/store";
import type { LoginStatus } from "embedding-sdk/store/types";
import {
  createMockLoginStatusState,
  createMockSdkState,
} from "embedding-sdk/test/mocks/state";
import { createMockState } from "metabase-types/store/mocks";

import { PublicComponentWrapper } from "./PublicComponentWrapper";

const setup = (status: LoginStatus = { status: "uninitialized" }) => {
  const state = createMockState({
    sdk: createMockSdkState({
      loginStatus: createMockLoginStatusState(status),
    }),
  });

  renderWithProviders(
    <PublicComponentWrapper>
      <div>My component</div>
    </PublicComponentWrapper>,
    {
      storeInitialState: state,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      customReducers: SDK_REDUCERS,
    },
  );
};

describe("PublicComponentWrapper", () => {
  it("renders Initializing message when loginStatus is uninitialized", () => {
    setup();
    const message = screen.getByText("Initializing…");
    expect(message).toBeInTheDocument();
  });

  it("renders API Key valid message when loginStatus is initialized", () => {
    setup({ status: "initialized" });
    const message = screen.getByText("API Key / JWT is valid.");
    expect(message).toBeInTheDocument();
  });

  it("renders loader when loginStatus is loading", () => {
    setup({ status: "loading" });
    const loader = screen.getByTestId("loading-spinner");
    expect(loader).toBeInTheDocument();
  });

  it("renders error message when loginStatus is error", () => {
    setup({
      status: "error",
      error: { name: "Error", message: "Something went wrong" },
    });
    const errorMessage = screen.getByText(/Something went wrong/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it("renders children when loginStatus is success", () => {
    setup({ status: "success" });
    const component = screen.getByText("My component");
    expect(component).toBeInTheDocument();
  });
});
