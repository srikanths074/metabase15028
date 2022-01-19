import React from "react";
import _ from "underscore";
import { t } from "ttag";

import PinnedItemCard from "metabase/collections/components/PinnedItemCard/PinnedItemCard";
import { Item, Collection } from "metabase/collections/utils";

import { Container, Grid, SectionHeader } from "./PinnedItemOverview.styled";

type Props = {
  items: Item[];
  collection: Collection;
  onToggleSelected: (item: Item) => void;
  onCopy: (items: Item[]) => void;
  onMove: (items: Item[]) => void;
};

function PinnedItemOverview({
  items,
  collection,
  onToggleSelected,
  onCopy,
  onMove,
}: Props) {
  const sortedItems = _.sortBy(items, item => item.name);
  const {
    card: cardItems = [],
    dashboard: dashboardItems = [],
    dataset: datasetItems = [],
  } = _.groupBy(sortedItems, "model");

  return (
    <Container>
      {cardItems.length > 0 && (
        <Grid>
          {cardItems.map(item => (
            <PinnedItemCard
              key={item.id}
              item={item}
              collection={collection}
              onToggleSelected={onToggleSelected}
              onCopy={onCopy}
              onMove={onMove}
            />
          ))}
        </Grid>
      )}
      {dashboardItems.length > 0 && (
        <Grid>
          {dashboardItems.map(item => (
            <PinnedItemCard
              key={item.id}
              item={item}
              collection={collection}
              onToggleSelected={onToggleSelected}
              onCopy={onCopy}
              onMove={onMove}
            />
          ))}
        </Grid>
      )}
      {datasetItems.length > 0 && (
        <div>
          <SectionHeader>
            <h4>{t`Datasets`}</h4>
            <div>{t`Start new explorations about {${collection.name}} here`}</div>
          </SectionHeader>
          <Grid>
            {datasetItems.map(item => (
              <PinnedItemCard
                key={item.id}
                item={item}
                collection={collection}
                onToggleSelected={onToggleSelected}
                onCopy={onCopy}
                onMove={onMove}
              />
            ))}
          </Grid>
        </div>
      )}
    </Container>
  );
}

export default PinnedItemOverview;
