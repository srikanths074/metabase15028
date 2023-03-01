import React from "react";
import { Route } from "react-router";
import userEvent from "@testing-library/user-event";
import moment from "moment-timezone";
import { renderWithProviders, screen } from "__support__/ui";

import {
  DEFAULT_DATE_STYLE,
  DEFAULT_TIME_STYLE,
} from "metabase/lib/formatting/datetime-utils";

import BaseItemsTable from "metabase/collections/components/BaseItemsTable";

const timestamp = "2021-06-03T19:46:52.128";

function getCollectionItem({
  id = 1,
  model = "dashboard",
  name = "My Item",
  icon = "dashboard",
  url = "/dashboard/1",
  ...rest
} = {}) {
  return {
    "last-edit-info": {
      id: 1,
      first_name: "John",
      last_name: "Doe",
      timestamp,
    },
    ...rest,
    id,
    model,
    name,
    getIcon: () => icon,
    getUrl: () => url,
  };
}

describe("Collections BaseItemsTable", () => {
  const ITEM = getCollectionItem();

  function setup({ items = [ITEM], ...props } = {}) {
    return renderWithProviders(
      <Route
        path="/"
        component={() => (
          <BaseItemsTable
            items={items}
            sortingOptions={{ sort_column: "name", sort_direction: "asc" }}
            onSortingOptionsChange={jest.fn()}
            {...props}
          />
        )}
      />,
      { withDND: true, withRouter: true },
    );
  }

  it("displays item data", () => {
    setup();
    const lastEditedAt = moment(timestamp).format("MMMM DD, YYYY");

    expect(screen.getByText(ITEM.name)).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText(lastEditedAt)).toBeInTheDocument();
  });

  it("displays last edit time on hover", () => {
    setup();
    const lastEditedAt = moment(timestamp).format("MMMM DD, YYYY");

    userEvent.hover(screen.getByText(lastEditedAt));

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      moment(timestamp).format(`${DEFAULT_DATE_STYLE}, ${DEFAULT_TIME_STYLE}`),
    );
  });

  it("doesn't show model detail page link", () => {
    setup();
    expect(screen.queryByTestId("model-detail-link")).not.toBeInTheDocument();
  });

  it("allows user to select all items", () => {
    const onSelectAll = jest.fn();
    setup({ hasUnselected: true, onSelectAll });

    userEvent.click(screen.getByLabelText("Select all items"));

    expect(onSelectAll).toHaveBeenCalled();
  });

  it("allows user to deselect all items", () => {
    const onSelectNone = jest.fn();
    setup({ hasUnselected: false, onSelectNone });

    userEvent.click(screen.getByLabelText("Select all items"));

    expect(onSelectNone).toHaveBeenCalled();
  });

  describe("models", () => {
    const model = getCollectionItem({
      id: 1,
      name: "Order",
      model: "dataset",
      url: "/model/1",
    });

    it("shows model detail page link", () => {
      setup({ items: [model] });
      expect(screen.getByTestId("model-detail-link")).toBeInTheDocument();
      expect(screen.getByTestId("model-detail-link")).toHaveAttribute(
        "href",
        "/model/1-order/detail",
      );
    });
  });
});
