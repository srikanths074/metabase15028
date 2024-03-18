/* eslint-disable react/prop-types */
import { connect } from "react-redux";
import { t } from "ttag";

import CS from "metabase/css/core/index.css";
import { getErrorMessage } from "metabase/selectors/app";

import EmbedFrame from "./EmbedFrame";

const mapStateToProps = (state, props) => ({
  message: getErrorMessage(state, props),
});

const PublicError = ({ message = t`An error occurred` }) => (
  <EmbedFrame className={CS.spread}>
    <div className="flex layout-centered flex-full flex-column">
      <div className="QueryError-image QueryError-image--noRows" />
      <div className="mt1 h4 sm-h3 md-h2 text-bold">{message}</div>
    </div>
  </EmbedFrame>
);

export default connect(mapStateToProps)(PublicError);
