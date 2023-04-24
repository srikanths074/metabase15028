import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusListingView as StatusListing } from "./StatusListing";

const DatabaseStatusMock = () => <div>DatabaseStatus</div>;

jest.mock("../../containers/DatabaseStatus", () => DatabaseStatusMock);

describe("StatusListing", () => {
  it("should render database statuses for admins", () => {
    render(<StatusListing isAdmin={true} isLoggedIn />);

    expect(screen.getByText("DatabaseStatus")).toBeInTheDocument();
  });

  it("should not render database statuses for non-admins", () => {
    render(<StatusListing isAdmin={false} isLoggedIn />);

    expect(screen.queryByText("DatabaseStatus")).not.toBeInTheDocument();
  });
});
