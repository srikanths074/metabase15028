import React from "react";
import { render, screen } from "@testing-library/react";
import ArchiveModal from "./ArchiveModal";

const getAlert = ({ creator = getUser(), channels = [getChannel()] } = {}) => ({
  creator,
  channels,
  created_at: "2021-05-08T02:02:07.441Z",
});

const getPulse = ({ creator = getUser(), channels = [getChannel()] } = {}) => ({
  creator,
  channels,
  created_at: "2021-05-08T02:02:07.441Z",
});

const getUser = ({ id = 1 } = {}) => ({
  id,
  common_name: "John Doe",
});

const getChannel = ({
  channel_type = "email",
  schedule_type = "hourly",
  recipients = [getUser()],
} = {}) => {
  return {
    channel_type,
    schedule_type,
    recipients,
    schedule_hour: 8,
    schedule_day: "mon",
    schedule_frame: "first",
  };
};

describe("ArchiveModal", () => {
  it("should render an email alert", () => {
    const alert = getAlert();

    render(<ArchiveModal item={alert} type="alert" />);

    screen.getByText("Delete this alert?");
    screen.getByText("Yes, delete this alert");
    screen.getByText("You created this alert on 05/08/2021", { exact: false });
    screen.getByText("It’s currently being sent to 1 email.", { exact: false });
  });

  it("should render an email pulse", () => {
    const pulse = getPulse();

    render(<ArchiveModal item={pulse} type="pulse" />);

    screen.getByText("Delete this subscription?");
    screen.getByText("Yes, delete this subscription");
    screen.getByText("05/08/2021", { exact: false });
    screen.getByText("It’s currently being sent to 1 email.", { exact: false });
  });

  it("should render a slack pulse", () => {
    const pulse = getPulse({
      channels: [getChannel({ channel_type: "slack" })],
    });

    render(<ArchiveModal item={pulse} type="pulse" />);

    screen.getByText("1 Slack channel", { exact: false });
  });

  it("should render an alert with both email and slack channels", () => {
    const alert = getAlert({
      channels: [
        getChannel({
          channel_type: "email",
          recipients: [getUser(), getUser()],
        }),
        getChannel({
          channel_type: "slack",
          recipients: [getUser(), getUser(), getUser()],
        }),
      ],
    });

    render(<ArchiveModal item={alert} type="alert" />);

    screen.getByText("2 emails and 3 Slack channels", { exact: false });
  });
});
