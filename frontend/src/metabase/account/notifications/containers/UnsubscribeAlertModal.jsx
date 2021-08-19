import { connect } from "react-redux";
import _ from "underscore";
import Alerts from "metabase/entities/alerts";
import { getUser, getUserId } from "metabase/selectors/user";
import { getAlert } from "../selectors";
import UnsubscribeModal from "../components/UnsubscribeModal";

const mapStateToProps = (state, props) => ({
  item: getAlert(props),
  type: "alert",
  user: getUser(state),
});

const mapDispatchToProps = {
  onArchive: Alerts.actions.unsubscribe,
};

export default _.compose(
  Alerts.loadList({
    query: state => ({ user_id: getUserId(state) }),
  }),
  connect(
    mapStateToProps,
    mapDispatchToProps,
  ),
)(UnsubscribeModal);
