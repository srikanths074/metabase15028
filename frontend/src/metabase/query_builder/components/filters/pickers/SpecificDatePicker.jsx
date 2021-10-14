/* eslint-disable react/prop-types */
import React, { Component } from "react";
import PropTypes from "prop-types";
import { t } from "ttag";

import Calendar from "metabase/components/Calendar";
import InputBlurChange from "metabase/components/InputBlurChange";
import Icon from "metabase/components/Icon";
import ExpandingContent from "metabase/components/ExpandingContent";
import HoursMinutesInput from "./HoursMinutesInput";

import moment from "moment";
import cx from "classnames";

const DATE_FORMAT = "YYYY-MM-DD";
const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ss";

export default class SpecificDatePicker extends Component {
  props;
  state;

  constructor(props) {
    super(props);

    this.state = {
      showCalendar: true,
    };
  }

  static propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
  };

  onChange = (date, hours, minutes) => {
    const m = moment(date);
    if (!m.isValid()) {
      this.props.onChange(null);
    }

    let hasTime = false;
    if (hours != null) {
      m.hours(hours);
      hasTime = true;
    }
    if (minutes != null) {
      m.minutes(minutes);
      hasTime = true;
    }

    if (hasTime) {
      this.props.onChange(m.format(DATE_TIME_FORMAT));
    } else {
      this.props.onChange(m.format(DATE_FORMAT));
    }
  };

  render() {
    const { value, calendar, hideTimeSelectors, className } = this.props;
    const { showCalendar } = this.state;

    let date, hours, minutes;
    if (moment(value, DATE_TIME_FORMAT, true).isValid()) {
      date = moment(value, DATE_TIME_FORMAT, true);
      hours = date.hours();
      minutes = date.minutes();
      date.startOf("day");
    } else if (moment(value, DATE_FORMAT, true).isValid()) {
      date = moment(value, DATE_FORMAT, true);
    }

    return (
      <div className={className}>
        <div className="mb2 full bordered rounded flex align-center">
          <InputBlurChange
            placeholder={moment().format("MM/DD/YYYY")}
            className="borderless full p1 h3"
            style={{
              outline: "none",
            }}
            value={date ? date.format("MM/DD/YYYY") : ""}
            onBlurChange={({ target: { value } }) => {
              const date = moment(value, "MM/DD/YYYY");
              if (date.isValid()) {
                this.onChange(date, hours, minutes);
              } else {
                this.onChange(null);
              }
            }}
          />

          {calendar && (
            <Icon
              className="mr1 text-purple-hover cursor-pointer"
              name="calendar"
              onClick={() =>
                this.setState({ showCalendar: !this.state.showCalendar })
              }
              tooltip={showCalendar ? t`Hide calendar` : t`Show calendar`}
            />
          )}
        </div>

        {calendar && (
          <ExpandingContent isOpen={showCalendar}>
            <Calendar
              selected={date}
              initial={date || moment()}
              onChange={value => this.onChange(value, hours, minutes)}
              isRangePicker={false}
            />
          </ExpandingContent>
        )}

        {!hideTimeSelectors && (
          <div className={cx({ py2: calendar }, { mb3: !calendar })}>
            {hours == null || minutes == null ? (
              <div
                className="text-purple-hover cursor-pointer flex align-center"
                onClick={() => this.onChange(date, 12, 30)}
              >
                <Icon className="mr1" name="clock" />
                {t`Add a time`}
              </div>
            ) : (
              <HoursMinutesInput
                onClear={() => this.onChange(date, null, null)}
                hours={hours}
                minutes={minutes}
                onChangeHours={hours => this.onChange(date, hours, minutes)}
                onChangeMinutes={minutes => this.onChange(date, hours, minutes)}
              />
            )}
          </div>
        )}
      </div>
    );
  }
}
