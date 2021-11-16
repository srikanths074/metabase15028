import React from "react";
import PropTypes from "prop-types";
import { t } from "ttag";

import * as Urls from "metabase/lib/urls";

import EntityMenu from "metabase/components/EntityMenu";
import { ANALYTICS_CONTEXT } from "metabase/collections/constants";

const propTypes = {
  collection: PropTypes.func,
  list: PropTypes.arrayOf(PropTypes.object),
};

function NewCollectionItemMenu({ collection }) {
  const items = [
    {
      title: t`Question`,
      link: Urls.newQuestion({ mode: "notebook", collectionId: collection.id }),
      event: `${ANALYTICS_CONTEXT};New Item Menu;Question Click`,
    },
    {
      title: t`Dashboard`,
      link: Urls.newDashboard(collection.id),
      event: `${ANALYTICS_CONTEXT};New Item Menu;Dashboard Click`,
    },
    {
      title: t`Collection`,
      link: Urls.newCollection(collection.id),
      event: `${ANALYTICS_CONTEXT};New Item Menu;Collection Click`,
    },
  ];

  return <EntityMenu items={items} triggerIcon="add" tooltip={t`Create`} />;
}

NewCollectionItemMenu.propTypes = propTypes;

export default NewCollectionItemMenu;
