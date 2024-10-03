import cx from "classnames";
import moment from "moment-timezone"; // eslint-disable-line no-restricted-imports -- deprecated usage
import { Component } from "react";
import { t } from "ttag";

import Calendar from "metabase/components/Calendar";
import ExpandingContent from "metabase/components/ExpandingContent";
import InputBlurChange from "metabase/components/InputBlurChange";
import CS from "metabase/css/core/index.css";
import { getDateStyleFromSettings } from "metabase/lib/time";
import { Icon } from "metabase/ui";

import HoursMinutesInput from "../DatePicker/HoursMinutesInput";

import { TimeLabel } from "./SpecificDatePicker.styled";

const DATE_FORMAT = "YYYY-MM-DD";
const DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ss";

const TIME_SELECTOR_DEFAULT_HOUR = 12;
const TIME_SELECTOR_DEFAULT_MINUTE = 30;

interface SpecificDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  calendar?: boolean;
  hideTimeSelectors?: boolean;
  className?: string;
}

interface SpecificDatePickerState {
  showCalendar: boolean;
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default class SpecificDatePicker extends Component<
  SpecificDatePickerProps,
  SpecificDatePickerState
> {
  constructor(props: SpecificDatePickerProps) {
    super(props);

    this.state = {
      showCalendar: true,
    };
  }

  onChange = (
    date: moment.MomentInput,
    hours?: number | null,
    minutes?: number | null,
  ) => {
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

    let date: moment.Moment | undefined;
    let hours: number | undefined;
    let minutes: number | undefined;

    if (moment(value, DATE_TIME_FORMAT, true).isValid()) {
      date = moment(value, DATE_TIME_FORMAT, true);
      hours = date.hours();
      minutes = date.minutes();
      date.startOf("day");
    } else if (moment(value, DATE_FORMAT, true).isValid()) {
      date = moment(value, DATE_FORMAT, true);
    }

    const dateFormat = getDateStyleFromSettings() || "MM/DD/YYYY";

    return (
      <div className={className}>
        <div
          className={cx(
            CS.mb2,
            CS.full,
            CS.bordered,
            CS.rounded,
            CS.flex,
            CS.alignCenter,
          )}
        >
          <InputBlurChange
            placeholder={moment().format(dateFormat)}
            className={cx(CS.borderless, CS.full, CS.p1, CS.h3)}
            style={{
              outline: "none",
            }}
            value={date ? date.format(dateFormat) : ""}
            onBlurChange={({ target: { value } }) => {
              const date = moment(value, dateFormat);
              if (date.isValid()) {
                this.onChange(date, hours, minutes);
              } else {
                this.onChange(null);
              }
            }}
            rightIcon={calendar ? "calendar" : undefined}
            onRightIconClick={() =>
              this.setState({ showCalendar: !this.state.showCalendar })
            }
            rightIconTooltip={
              showCalendar ? t`Hide calendar` : t`Show calendar`
            }
          />
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
          <div className={cx({ [CS.py2]: calendar }, { [CS.mb3]: !calendar })}>
            {hours == null || minutes == null ? (
              <TimeLabel
                onClick={() =>
                  this.onChange(
                    date,
                    TIME_SELECTOR_DEFAULT_HOUR,
                    TIME_SELECTOR_DEFAULT_MINUTE,
                  )
                }
              >
                <Icon className={CS.mr1} name="clock" />
                {t`Add a time`}
              </TimeLabel>
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
