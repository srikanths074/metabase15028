import { connect } from "react-redux";
import { push } from "react-router-redux";
import _ from "underscore";

import NewItemMenu from "metabase/components/NewItemMenu";

import Databases from "metabase/entities/databases";
import Search from "metabase/entities/search";

import { closeNavbar } from "metabase/redux/app";
import {
  getHasDataAccess,
  getHasDatabaseWithJsonEngine,
  getHasNativeWrite,
  getHasDatabaseWithActionsEnabled,
} from "metabase/selectors/data";

import { Database } from "metabase-types/api";
import { State } from "metabase-types/store";

interface MenuDatabaseProps {
  databases?: Database[];

  // Search results (untyped yet)
  models?: unknown[];
}

const mapStateToProps = (
  state: State,
  { databases = [], models = [] }: MenuDatabaseProps,
) => ({
  hasModels: models.length > 0,
  hasDataAccess: getHasDataAccess(databases),
  hasNativeWrite: getHasNativeWrite(databases),
  hasDatabaseWithJsonEngine: getHasDatabaseWithJsonEngine(databases),
  hasDatabaseWithActionsEnabled: getHasDatabaseWithActionsEnabled(databases),
});

const mapDispatchToProps = {
  onCloseNavbar: closeNavbar,
  onChangeLocation: push,
};

export default _.compose(
  Databases.loadList({
    loadingAndErrorWrapper: false,
  }),
  Search.loadList({
    // Checking if there is at least one model,
    // so we can decide if "Action" option should be shown
    query: { models: "dataset", limit: 1 },
    loadingAndErrorWrapper: false,
    listName: "models",
  }),
  connect(mapStateToProps, mapDispatchToProps),
)(NewItemMenu);
