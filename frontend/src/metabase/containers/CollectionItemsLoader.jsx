/* @flow */
import React from "react";
import EntityObjectLoader from "metabase/entities/containers/EntityObjectLoader";
import EntityListLoader from "metabase/entities/containers/EntityListLoader";

import _ from "underscore";

type Props = {
  collectionId: number,
  children: () => void,
};

const CollectionItemsLoader = ({ collectionId, children, ...props }: Props) => (
  <EntityObjectLoader
    {...props}
    entityType="collections"
    entityId={collectionId}
    children={({ object }) => (
      <EntityListLoader
        {...props}
        entityType="search"
        entityQuery={{ collectionId }}
        children={({ list }) =>
          object &&
          list &&
          children({
            collection: object,
            items: list,
          })
        }
      />
    )}
  />
);

export default CollectionItemsLoader;
