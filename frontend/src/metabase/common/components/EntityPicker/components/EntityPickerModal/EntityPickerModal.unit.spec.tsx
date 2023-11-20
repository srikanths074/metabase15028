import userEvent from "@testing-library/user-event";
import fetchMock from "fetch-mock";

import { renderWithProviders, screen, within } from "__support__/ui";
import type { IconName } from "metabase/ui";
import { Button } from "metabase/ui";
import {
  createMockSearchResult,
  createMockSearchResults,
} from "metabase-types/api/mocks";

import type { CollectionPickerItem, EntityTab } from "../../types";

import type { EntityPickerModalOptions } from "./EntityPickerModal";
import { EntityPickerModal } from "./EntityPickerModal";

interface setupProps {
  title?: string;
  onItemSelect?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
  tabs?: EntityTab[];
  options?: EntityPickerModalOptions;
  selectedItem?: null | CollectionPickerItem;
  actions?: JSX.Element[];
}

const TestPicker = ({ name }: { name: string }) => (
  <p>{`Test picker ${name}`}</p>
);

const TEST_TAB = {
  icon: "audit" as IconName,
  displayName: "All the foo",
  model: "test1",
  element: <TestPicker name="foo" />,
};

const setup = ({
  title = "Pick a thing",
  onItemSelect = jest.fn(),
  onClose = jest.fn(),
  onConfirm = jest.fn(),
  tabs = [TEST_TAB],
  selectedItem = null,
  ...rest
}: setupProps = {}) => {
  // fetchMock.get("path:/api/user/current", createMockUser());
  // fetchMock.get(
  //   "path:/api/collection/1",
  //   createMockCollection({ name: "My Personal Collection" }),
  // );
  // fetchMock.get(
  //   "path:/api/collection/root",
  //   createMockCollection({ id: "root", name: "Our Analytics" }),
  // );

  // fetchMock.get("path:/api/collection/root/items", {
  //   data: [
  //     createMockCollectionItem({
  //       id: 2,
  //       name: "Collection 1",
  //       model: "collection",
  //     }),
  //     createMockCollectionItem({
  //       id: 3,
  //       name: "Collection 2",
  //       model: "collection",
  //     }),
  //     createMockCollectionItem({
  //       id: 4,
  //       name: "Collection 3",
  //       model: "collection",
  //     }),
  //   ],
  // });

  renderWithProviders(
    <EntityPickerModal
      title={title}
      onItemSelect={onItemSelect}
      onClose={onClose}
      tabs={tabs}
      selectedItem={selectedItem}
      onConfirm={onConfirm}
      {...rest}
    />,
  );
};

describe("EntityPickerModal", () => {
  it("should render a picker", async () => {
    setup({});
    expect(await screen.findByText("Test picker foo")).toBeInTheDocument();

    // expect(await screen.findByText("Collection 1")).toBeInTheDocument();
  });

  it("should render a search bar by default and show confirmation button", async () => {
    setup();
    expect(await screen.findByPlaceholderText("Search…")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Select" }),
    ).toBeInTheDocument();
  });

  it("should be able to disable the search bar", () => {
    setup({
      options: {
        showSearch: false,
      },
    });
    expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  });

  it("should show a tab list when more than 1 tab is supplied", async () => {
    const tabs = [
      TEST_TAB,
      {
        icon: "folder" as IconName,
        displayName: "All the bar",
        model: "test2",
        element: <TestPicker name="bar" />,
      },
    ];
    setup({
      tabs,
    });

    const tabList = await screen.findByRole("tablist");

    expect(tabList).toBeInTheDocument();

    expect(
      await within(tabList).findByRole("tab", { name: /All the foo/ }),
    ).toBeInTheDocument();
    expect(
      await within(tabList).findByRole("tab", { name: /All the bar/ }),
    ).toBeInTheDocument();

    userEvent.click(
      await within(tabList).findByRole("tab", { name: /All the bar/ }),
    );

    expect(await screen.findByText("Test picker bar")).toBeInTheDocument();
  });

  it("should show a search tab list when a we type in the search input", async () => {
    fetchMock.get(
      "path:/api/search",
      createMockSearchResults({
        items: [
          createMockSearchResult({
            name: "Search Result 1",
            model: "collection",
            can_write: true,
            id: 100,
          }),
          createMockSearchResult({
            name: "Search Result 2",
            model: "collection",
            can_write: true,
            id: 101,
          }),
        ],
      }),
    );

    fetchMock.get("path:/api/user/recipients", []);

    const onItemSelect = jest.fn();
    const onConfirm = jest.fn();
    setup({
      onItemSelect,
      onConfirm,
    });

    userEvent.type(await screen.findByPlaceholderText("Search…"), "My ", {
      delay: 50,
    });

    expect(await screen.findByRole("tablist")).toBeInTheDocument();
    expect(
      await screen.findByRole("tab", { name: /2 results for "My "/ }),
    ).toBeInTheDocument();

    expect(await screen.findAllByTestId("search-result-item")).toHaveLength(2);

    userEvent.click(await screen.findByText("Search Result 1"));

    expect(onItemSelect).toHaveBeenCalledTimes(1);
  });

  it("should accept an array of action buttons", async () => {
    const actionFn = jest.fn();

    const actions = [
      <Button onClick={actionFn} key="1">
        Click Me
      </Button>,
    ];

    setup({ actions });

    expect(
      await screen.findByRole("button", { name: "Click Me" }),
    ).toBeInTheDocument();
    userEvent.click(await screen.findByRole("button", { name: "Click Me" }));

    expect(actionFn).toHaveBeenCalledTimes(1);
  });
});
