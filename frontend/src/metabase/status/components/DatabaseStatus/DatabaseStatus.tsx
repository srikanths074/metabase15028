import React from "react";
import Icon from "metabase/components/Icon";
import useStatusVisibility from "../../hooks/use-status-visibility";
import { Database, InitialSyncStatus } from "../../types";
import { StatusRoot } from "./DatabaseStatus.styled";

interface Props {
  database: Database;
}

const DatabaseStatus = ({ database }: Props) => {
  const isActive = database.initial_sync_status === "incomplete";
  const isVisible = useStatusVisibility(isActive);

  if (!isVisible) {
    return null;
  }

  return (
    <StatusRoot status={database.initial_sync_status}>
      <Icon name={getIconName(database.initial_sync_status)} />
    </StatusRoot>
  );
};

const getIconName = (status: InitialSyncStatus) => {
  switch (status) {
    case "incomplete":
      return "database";
    case "complete":
      return "check";
    case "aborted":
      return "warning";
  }
};

export default DatabaseStatus;
