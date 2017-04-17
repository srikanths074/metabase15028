import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import styles from "./Legend.css";

import Icon from "metabase/components/Icon.jsx";
import LegendItem from "./LegendItem.jsx";

import * as Urls from "metabase/lib/urls";

import cx from "classnames";

import { normal } from "metabase/lib/colors";

const DEFAULT_COLORS = Object.values(normal);

export default class LegendHeader extends Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            width: 0
        };
    }

    static propTypes = {
        series: PropTypes.array.isRequired,
        hovered: PropTypes.object,
        onHoverChange: PropTypes.func,
        onRemoveSeries: PropTypes.func,
        actionButtons: PropTypes.node,
        linkToCard: PropTypes.bool,
        description: PropTypes.string
    };

    static defaultProps = {
        series: [],
        settings: {},
        visualizationIsClickable: () => false
    };

    componentDidMount() {
        this.componentDidUpdate();
    }

    componentDidUpdate() {
        let width = ReactDOM.findDOMNode(this).offsetWidth;
        if (width !== this.state.width) {
            this.setState({ width });
        }
    }

    render() {
        const { series, hovered, onRemoveSeries, actionButtons, onHoverChange, linkToCard, settings, description, onVisualizationClick, visualizationIsClickable } = this.props;
        const showDots = series.length > 1;
        const isNarrow = this.state.width < 150;
        const showTitles = !showDots || !isNarrow;

        let colors = settings["graph.colors"] || DEFAULT_COLORS;

        const isClickable = series.length > 0 && series[0].clicked && visualizationIsClickable(series[0].clicked);

        return (
            <div  className={cx(styles.LegendHeader, "Card-title mx1 flex flex-no-shrink flex-row align-center")}>
                { series.map((s, index) => [
                    <LegendItem
                        key={index}
                        title={s.card.name}
                        description={description}
                        href={linkToCard && s.card.id && Urls.question(s.card.id)}
                        color={colors[index % colors.length]}
                        showDot={showDots}
                        showTitle={showTitles}
                        isMuted={hovered && hovered.index != null && index !== hovered.index}
                        onMouseEnter={() => onHoverChange && onHoverChange({ index })}
                        onMouseLeave={() => onHoverChange && onHoverChange(null) }
                        onClick={isClickable && ((e) =>
                            onVisualizationClick({ ...s.clicked, element: e.currentTarget })
                        )}
                    />,
                    onRemoveSeries && index > 0 &&
                      <Icon
                          name="close"
                          className="text-grey-2 flex-no-shrink mr1 cursor-pointer"
                          width={12} height={12}
                          onClick={() => onRemoveSeries(s.card)}
                      />
                ])}
                { actionButtons &&
                  <span className="flex-no-shrink flex-align-right relative">
                      {actionButtons}
                  </span>
                }
            </div>
        );
    }
}
