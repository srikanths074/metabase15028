import { connect } from "react-redux";
import _ from "underscore";
import Databases from "metabase/entities/databases";
import { getUser } from "metabase/selectors/user";
import DatabaseStatusListing from "../../components/DatabaseStatusListing";

const mapStateToProps = (state: any) => ({
  user: getUser(state),
});

export default _.compose(
  Databases.loadList(),
  connect(mapStateToProps),
)(DatabaseStatusListing);
