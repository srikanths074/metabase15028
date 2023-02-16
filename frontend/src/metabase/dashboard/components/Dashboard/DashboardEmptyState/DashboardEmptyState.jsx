import React from "react";
import PropTypes from "prop-types";
import { t } from "ttag";

import EmptyState from "metabase/components/EmptyState";
import { Container } from "./DashboardEmptyState.styled";

const propTypes = {
  isNightMode: PropTypes.bool.isRequired,
  addQuestion: PropTypes.func.isRequired,
};

const questionCircle = <span className="QuestionCircle">?</span>;

const DashboardEmptyState = ({ isNightMode, addQuestion }) => (
  <Container isNightMode={isNightMode}>
    <EmptyState
      illustrationElement={questionCircle}
      title={t`This dashboard is looking empty.`}
      message={t`Add a question to start making it useful!`}
      action={t`Add a question`}
      onActionClick={addQuestion}
    />
  </Container>
);

DashboardEmptyState.propTypes = propTypes;

export default DashboardEmptyState;
