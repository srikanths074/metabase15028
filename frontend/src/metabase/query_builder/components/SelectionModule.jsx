/* eslint-disable react/prop-types */
import cx from "classnames";
import PropTypes from "prop-types";
import { createRef, Component } from "react";
import { t } from "ttag";
import _ from "underscore";

import Popover from "metabase/components/Popover";
import CS from "metabase/css/core/index.css";
import QueryBuilderS from "metabase/css/query_builder.module.css";
import { Icon } from "metabase/ui";

export default class SelectionModule extends Component {
  constructor(props, context) {
    super(props, context);
    this._expand = this._expand.bind(this);
    this._select = this._select.bind(this);
    this._toggleOpen = this._toggleOpen.bind(this);
    this.onClose = this.onClose.bind(this);
    // a selection module can be told to be open on initialization but otherwise is closed
    const isInitiallyOpen = props.isInitiallyOpen || false;

    this.rootRef = createRef();

    this.state = {
      open: isInitiallyOpen,
      expanded: false,
      filterTerm: null,
    };
  }

  static propTypes = {
    action: PropTypes.func.isRequired,
    display: PropTypes.string.isRequired,
    descriptionKey: PropTypes.string,
    expandFilter: PropTypes.func,
    expandTitle: PropTypes.string,
    isInitiallyOpen: PropTypes.bool,
    items: PropTypes.array,
    remove: PropTypes.func,
    selectedKey: PropTypes.string,
    selectedValue: PropTypes.node,
    parentIndex: PropTypes.number,
    placeholder: PropTypes.string,
  };

  static defaultProps = {
    className: "",
  };

  onClose() {
    this.setState({
      open: false,
      expanded: false,
    });
  }

  _toggleOpen() {
    this.setState({
      open: !this.state.open,
      expanded: !this.state.open ? this.state.expanded : false,
    });
  }

  _expand() {
    this.setState({
      expanded: true,
    });
  }

  _isExpanded() {
    if (this.state.expanded || !this.props.expandFilter) {
      return true;
    }
    // if an item that is normally in the expansion is selected then show the expansion
    for (let i = 0; i < this.props.items.length; i++) {
      const item = this.props.items[i];
      if (this._itemIsSelected(item) && !this.props.expandFilter(item, i)) {
        return true;
      }
    }
    return false;
  }

  _displayCustom(values) {
    const custom = [];
    this.props.children.forEach(function (element) {
      const newElement = element;
      newElement.props.children = values[newElement.props.content];
      custom.push(element);
    });
    return custom;
  }

  _listItems(selection) {
    if (this.props.items) {
      let sourceItems = this.props.items;

      const isExpanded = this._isExpanded();
      if (!isExpanded) {
        sourceItems = sourceItems.filter(this.props.expandFilter);
      }

      const items = sourceItems.map(function (item, index) {
        const display = item ? item[this.props.display] || item : item;
        const itemClassName = cx(QueryBuilderS.SelectionItem, {
          [QueryBuilderS.SelectionItemSelected]: selection === display,
        });
        let description = null;
        if (
          this.props.descriptionKey &&
          item &&
          item[this.props.descriptionKey]
        ) {
          description = (
            <div className={QueryBuilderS.SelectionModuleDescription}>
              {item[this.props.descriptionKey]}
            </div>
          );
        }
        // if children are provided, use the custom layout display
        return (
          <li
            className={itemClassName}
            onClick={this._select.bind(null, item)}
            key={index}
          >
            <Icon name="check" size={12} />
            <div className="flex-full">
              <div className={QueryBuilderS.SelectionModuleDisplay}>
                {display}
              </div>
              {description}
            </div>
          </li>
        );
      }, this);

      if (!isExpanded && items.length !== this.props.items.length) {
        items.push(
          <li
            className={cx(QueryBuilderS.SelectionItem, CS.borderTop)}
            onClick={this._expand}
            key="expand"
          >
            <Icon name="chevrondown" size={12} />
            <div>
              <div className={QueryBuilderS.SelectionModuleDisplay}>
                {this.props.expandedTitle || t`Advanced...`}
              </div>
            </div>
          </li>,
        );
      }

      return items;
    } else {
      return t`Sorry. Something went wrong.`;
    }
  }

  _select(item) {
    const index = this.props.index;
    // send back the item with the specified action
    if (this.props.action) {
      if (index !== undefined) {
        if (this.props.parentIndex) {
          this.props.action(
            item[this.props.selectedKey],
            index,
            this.props.parentIndex,
          );
        } else {
          this.props.action(item[this.props.selectedKey], index);
        }
      } else {
        this.props.action(item[this.props.selectedKey]);
      }
    }
    this._toggleOpen();
  }

  _itemIsSelected(item) {
    return (
      item && _.isEqual(item[this.props.selectedKey], this.props.selectedValue)
    );
  }

  renderPopover(selection) {
    if (this.state.open) {
      const itemListClasses = cx(QueryBuilderS.SelectionItems, {
        [QueryBuilderS.SelectionItemsOpen]: this.state.open,
        [QueryBuilderS.SelectionItemsExpanded]: this.state.expanded,
      });

      return (
        <Popover
          target={this.rootRef.current}
          className={cx(QueryBuilderS.SelectionModule, this.props.className)}
          onClose={this.onClose}
        >
          <div className={itemListClasses}>
            <ul
              className={cx(
                QueryBuilderS.SelectionList,
                "scroll-show",
                CS.scrollY,
              )}
            >
              {this._listItems(selection)}
            </ul>
          </div>
        </Popover>
      );
    }
  }

  render() {
    let selection;
    this.props.items.forEach(function (item) {
      if (this._itemIsSelected(item)) {
        selection = item[this.props.display];
      }
    }, this);

    const placeholder = selection || this.props.placeholder;
    let remove;
    const removeable = !!this.props.remove;

    const moduleClasses = cx(QueryBuilderS.SelectionModule, {
      selected: selection,
      removeable: removeable,
    });

    if (this.props.remove) {
      remove = (
        <a
          className={cx(
            CS.textLight,
            CS.noDecoration,
            CS.pr1,
            CS.flex,
            CS.alignCenter,
          )}
          onClick={this.props.remove.bind(null, this.props.index)}
        >
          <Icon name="close" />
        </a>
      );
    }

    return (
      <div
        className={moduleClasses + " " + this.props.className}
        ref={this.rootRef}
      >
        <div className={cx("SelectionModule-trigger", CS.flex, CS.alignCenter)}>
          <a
            className={cx("QueryOption", CS.p1, CS.flex, CS.alignCenter)}
            onClick={this._toggleOpen}
          >
            {placeholder}
          </a>
          {remove}
        </div>
        {this.renderPopover(selection)}
      </div>
    );
  }
}
