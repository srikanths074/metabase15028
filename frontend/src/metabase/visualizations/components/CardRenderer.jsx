/* @flow */

import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";

import ExplicitSize from "metabase/components/ExplicitSize";

import { isSameSeries } from "metabase/visualizations/lib/utils";

import type { VisualizationProps } from "metabase/meta/types/Visualization";

type DeregisterFunction = () => void;

type Props = VisualizationProps & {
  renderer: (element: Element, props: VisualizationProps) => DeregisterFunction,
};

@ExplicitSize({ wrapped: true })
export default class CardRenderer extends Component {
  props: Props;

  static propTypes = {
    className: PropTypes.string,
    series: PropTypes.array.isRequired,
    renderer: PropTypes.func.isRequired,
    onRenderError: PropTypes.func.isRequired,
    isEditing: PropTypes.bool,
    isDashboard: PropTypes.bool,
  };

  _deregister: ?DeregisterFunction;

  shouldComponentUpdate(nextProps: Props) {
    // a chart only needs re-rendering when the result itself changes OR the chart type is different
    const sameSize =
      this.props.width === nextProps.width &&
      this.props.height === nextProps.height;
    const sameSeries = isSameSeries(this.props.series, nextProps.series);
    return !(sameSize && sameSeries);
  }

  componentDidMount() {
    this.renderChart();
  }

  componentDidUpdate() {
    this.renderChart();
  }

  componentWillUnmount() {
    this._deregisterChart();
  }

  _deregisterChart() {
    if (this._deregister) {
      // Prevents memory leak
      this._deregister();
      delete this._deregister;
    }
  }

  renderChart() {
    if (this.props.width == null || this.props.height == null) {
      return;
    }

    const parent = ReactDOM.findDOMNode(this);

    // deregister previous chart:
    this._deregisterChart();

    // reset the DOM:
    for (const child of parent.children) {
      parent.removeChild(child);
    }

    // create a new container element
    const element = document.createElement("div");
    parent.appendChild(element);

    if (this.props.isDashboard && this.props.isEditing) {
      // If this card is a dashboard that's currently being edited, we cover the
      // content to prevent interaction with the chart.
      const mouseBlocker = document.createElement("div");
      mouseBlocker.classList = "spread";
      mouseBlocker.style = "pointer-events: all;";
      parent.appendChild(mouseBlocker);
    }

    try {
      this._deregister = this.props.renderer(element, this.props);
    } catch (err) {
      console.error(err);
      this.props.onRenderError(err.message || err);
    }
  }

  render() {
    return <div className={this.props.className} style={this.props.style} />;
  }
}
