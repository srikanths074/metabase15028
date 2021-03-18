import React from "react";
import { t, ngettext, msgid } from "ttag";
import { Flex } from "grid-styled";

import Card from "metabase/components/Card";
import Icon from "metabase/components/Icon";
import Label from "metabase/components/type/Label";
import Subhead from "metabase/components/type/Subhead";
import Sidebar from "metabase/dashboard/components/Sidebar";
import Tooltip from "metabase/components/Tooltip";

function PulsesListSidebar({
  pulses,
  createSubscription,
  onCancel,
  editPulse,
}) {
  return (
    <Sidebar>
      <div className="px4 pt3   flex justify-between align-center">
        <Subhead>{t`Subscriptions`}</Subhead>

        <Flex align="center">
          <Tooltip tooltip={t`Set up a new schedule`}>
            <Icon
              name="add"
              className="text-brand bg-light-hover rounded p1 cursor-pointer mr1"
              size={18}
              onClick={createSubscription}
            />
          </Tooltip>
          <Tooltip tooltip={t`Close`}>
            <Icon
              name="close"
              className="text-light bg-light-hover rounded p1 cursor-pointer"
              size={22}
              onClick={onCancel}
            />
          </Tooltip>
        </Flex>
      </div>
      <div className="my2 mx4">
        {pulses.map(pulse => (
          <Card
            key={pulse.id}
            flat
            className="mb3 cursor-pointer bg-brand-hover"
            onClick={() => editPulse(pulse, pulse.channels[0].channel_type)}
          >
            <div className="px3 py2 hover-parent hover--inherit text-white-hover">
              <div className="flex align-center hover-child hover--inherit">
                <Icon
                  name={
                    pulse.channels[0].channel_type === "email"
                      ? "mail"
                      : "slack"
                  }
                  className="mr1"
                  style={{ paddingBottom: "5px" }}
                  size={16}
                />
                <Label className="hover-child hover--inherit">
                  {friendlySchedule(pulse.channels[0])}
                </Label>
              </div>
              {pulse.channels[0].channel_type === "email" && (
                <EmailRecipients pulse={pulse} />
              )}
            </div>
          </Card>
        ))}
      </div>
    </Sidebar>
  );
}

function EmailRecipients({ pulse }) {
  const recipients = pulse.channels[0].recipients;
  const [first, ...rest] = recipients;

  let text = "";

  if (rest != null && rest.length > 0) {
    text += ngettext(
      msgid` and ${rest.length} other`,
      ` and ${rest.length} others`,
      rest.length,
    );
  }

  return (
    <div className="text-medium hover-child">
      <ul
        className="flex flex-wrap scroll-x scroll-y"
        style={{ maxHeight: 130 }}
      >
        <li className="flex align-center mr1 text-bold text-medium hover-child hover--inherit">
          <Icon
            name="group"
            className="text-medium hover-child hover--inherit"
            size={12}
          />
          <span
            className="ml1 text-medium hover-child hover--inherit"
            style={{ fontSize: "12px" }}
          >
            {first.common_name || first.email}
            {text !== "" && text}
          </span>
        </li>
      </ul>
    </div>
  );
}

function friendlySchedule(channel) {
  let scheduleString = "";
  if (channel.channel_type === "email") {
    scheduleString += t`Emailed `;
  } else if (channel.channel_type === "slack") {
    scheduleString += t`Sent to ` + channel.details.channel + " ";
  } else {
    scheduleString += t`Sent `;
  }

  switch (channel.schedule_type) {
    case "hourly":
      scheduleString += t`hourly`;
      break;
    case "daily": {
      const ampm = formatHourAMPM(channel.schedule_hour);
      scheduleString += t`daily at ${ampm}`;
      break;
    }
    case "weekly": {
      const ampm = formatHourAMPM(channel.schedule_hour);
      const day = formatDay(channel.schedule_day);
      scheduleString += t`${day} at ${ampm}`;
      break;
    }
    case "monthly": {
      const ampm = formatHourAMPM(channel.schedule_hour);
      const day = formatDay(channel.schedule_day);
      const frame = formatFrame(channel.schedule_frame);
      scheduleString += t`monthly on the ${frame} ${day} at ${ampm}`;
      break;
    }
    default:
      scheduleString += channel.schedule_type;
  }

  return scheduleString;
}

function formatHourAMPM(hour) {
  if (hour > 12) {
    const newHour = hour - 12;
    return t`${newHour}:00 PM`;
  } else if (hour === 0) {
    return t`12:00 AM`;
  } else {
    return t`${hour}:00 AM`;
  }
}

function formatDay(day) {
  switch (day) {
    case "mon":
      return t`Monday`;
    case "tue":
      return t`Tuesday`;
    case "wed":
      return t`Wednesday`;
    case "thu":
      return t`Thursday`;
    case "fri":
      return t`Friday`;
    case "sat":
      return t`Saturday`;
    case "sun":
      return t`Sunday`;
    default:
      return day;
  }
}

function formatFrame(frame) {
  switch (frame) {
    case "first":
      return t`first`;
    case "last":
      return t`last`;
    case "mid":
      return t`15th (Midpoint)`;
    default:
      return frame;
  }
}

export default PulsesListSidebar;
