import React, { memo } from "react";
import { t } from "ttag";
import Settings from "metabase/lib/settings";
import * as Urls from "metabase/lib/urls";
import { parseTimestamp } from "metabase/lib/time";
import { formatDateTimeWithUnit } from "metabase/lib/formatting";
import EntityMenu from "metabase/components/EntityMenu";
import { Collection, Timeline, TimelineEvent } from "metabase-types/api";
import {
  CardAside,
  CardBody,
  CardCreatorInfo,
  CardDateInfo,
  CardDescription,
  CardRoot,
  CardThread,
  CardThreadIcon,
  CardThreadIconContainer,
  CardThreadStroke,
  CardTitle,
} from "./EventCard.styled";

export interface EventCardProps {
  event: TimelineEvent;
  timeline: Timeline;
  collection: Collection;
}

const EventCard = ({
  event,
  timeline,
  collection,
}: EventCardProps): JSX.Element => {
  const menuItems = getMenuItems(event, timeline, collection);
  const dateMessage = getDateMessage(event);
  const creatorMessage = getCreatorMessage(event);

  return (
    <CardRoot>
      <CardThread>
        <CardThreadIconContainer>
          <CardThreadIcon name={event.icon} />
        </CardThreadIconContainer>
        <CardThreadStroke />
      </CardThread>
      <CardBody>
        <CardDateInfo>{dateMessage}</CardDateInfo>
        <CardTitle>{event.name}</CardTitle>
        {event.description && (
          <CardDescription>{event.description}</CardDescription>
        )}
        <CardCreatorInfo>{creatorMessage}</CardCreatorInfo>
      </CardBody>
      <CardAside>
        <EntityMenu items={menuItems} triggerIcon="ellipsis" />
      </CardAside>
    </CardRoot>
  );
};

const getMenuItems = (
  event: TimelineEvent,
  timeline: Timeline,
  collection: Collection,
) => {
  return [
    {
      title: t`Edit event`,
      link: Urls.editEventInCollection(event, timeline, collection),
    },
  ];
};

const getDateMessage = (event: TimelineEvent) => {
  const date = parseTimestamp(event.timestamp);
  const options = Settings.formattingOptions();

  if (date.hours() === 0 && date.minutes() === 0) {
    return formatDateTimeWithUnit(date, "day", options);
  } else {
    return formatDateTimeWithUnit(date, "default", options);
  }
};

const getCreatorMessage = (event: TimelineEvent) => {
  const options = Settings.formattingOptions();
  const createdAt = formatDateTimeWithUnit(event.created_at, "day", options);

  if (event.creator) {
    return t`${event.creator.common_name} added this on ${createdAt}`;
  } else {
    return t`Added on ${createdAt}`;
  }
};

export default memo(EventCard);
