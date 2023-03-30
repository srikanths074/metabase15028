import { connect } from "react-redux";
import { getSetting } from "metabase/selectors/settings";
import type { State } from "metabase-types/store";
import HomeLayout from "../../components/HomeLayout";

const mapStateToProps = (state: State) => ({
  hasIllustration: getSetting(state, "show-lighthouse-illustration"),
});

export default connect(mapStateToProps)(HomeLayout);
