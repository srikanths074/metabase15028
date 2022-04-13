/* eslint-disable react/prop-types */
import React from "react";
import PropTypes from "prop-types";
import { t } from "ttag";

import Clearable from "./Clearable";
import AggregationPopover from "./AggregationPopover";
import TippyPopover from "metabase/components/Popover/TippyPopover";

// NOTE: lots of duplication between AggregationWidget and BreakoutWidget

export default class AggregationWidget extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      isOpen: props.isInitiallyOpen || false,
    };
  }

  static propTypes = {
    aggregation: PropTypes.array,
    onChangeAggregation: PropTypes.func.isRequired,
    query: PropTypes.object.isRequired,
    isInitiallyOpen: PropTypes.bool,
    children: PropTypes.object,
    showRawData: PropTypes.bool,
  };

  handleChangeAggregation = value => {
    this.props.onChangeAggregation(value);
    this.handleClose();
  };

  handleOpen = () => {
    this.setState({ isOpen: true });
  };

  handleClose = () => {
    this.setState({ isOpen: false });
  };

  render() {
    const {
      aggregation,
      query = aggregation.query && aggregation.query(),
      children,
      className,
    } = this.props;

    const trigger = aggregation ? (
      <Clearable
        onClear={
          query.canRemoveAggregation()
            ? () => this.handleChangeAggregation(null)
            : null
        }
      >
        <span className={className}>
          {isRows(aggregation) ? t`Raw data` : aggregation.displayName()}
        </span>
      </Clearable>
    ) : (
      children
    );
    const popover = (
      <TippyPopover
        placement="bottom-start"
        visible={this.state.isOpen}
        onClose={this.handleClose}
        content={
          <AggregationPopover
            query={query}
            aggregation={aggregation}
            onChangeAggregation={this.handleChangeAggregation}
            showMetrics={this.props.showMetrics}
          />
        }
      >
        <div>{trigger}</div>
      </TippyPopover>
    );

    if (trigger) {
      return <div onClick={this.handleOpen}>{popover}</div>;
    } else {
      return null;
    }
  }
}

const isRows = aggregation => aggregation && aggregation[0] === "rows";
