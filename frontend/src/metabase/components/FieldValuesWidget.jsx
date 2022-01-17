/* eslint-disable react/prop-types */
import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { t, jt } from "ttag";
import _ from "underscore";

import TokenField from "metabase/components/TokenField";
import { ListField } from "metabase/components/ListField";
import ValueComponent from "metabase/components/Value";
import LoadingSpinner from "metabase/components/LoadingSpinner";

import AutoExpanding from "metabase/hoc/AutoExpanding";

import { MetabaseApi } from "metabase/services";
import { addRemappings, fetchFieldValues } from "metabase/redux/metadata";
import { defer } from "metabase/lib/promise";
import { stripId } from "metabase/lib/formatting";
import { fetchDashboardParameterValues } from "metabase/dashboard/actions";
import { getDashboardParameterValuesCache } from "metabase/dashboard/selectors";

import Fields from "metabase/entities/fields";

const MAX_SEARCH_RESULTS = 100;

const fieldValuesWidgetPropTypes = {
  addRemappings: PropTypes.func,
  expand: PropTypes.bool,
};

const optionsMessagePropTypes = {
  message: PropTypes.string.isRequired,
};

const mapDispatchToProps = {
  addRemappings,
  fetchFieldValues,
  fetchDashboardParameterValues,
};

function mapStateToProps(state, { fields = [] }) {
  // try and use the selected fields, but fall back to the ones passed
  return {
    dashboardParameterValuesCache: getDashboardParameterValuesCache(state),
    fields: fields.map(
      field =>
        Fields.selectors.getObject(state, { entityId: field.id }) || field,
    ),
  };
}

@AutoExpanding
export class FieldValuesWidget extends Component {
  constructor(props) {
    super(props);
    this.state = {
      options: [],
      loadingState: "INIT",
      lastValue: "",
    };
  }

  static defaultProps = {
    color: "purple",
    maxResults: MAX_SEARCH_RESULTS,
    alwaysShowOptions: true,
    style: {},
    formatOptions: {},
    maxWidth: 500,
    disableSearch: false,
  };

  // if [dashboard] parameter ID is specified use the fancy new Chain Filter API endpoints to fetch parameter values.
  // Otherwise (e.g. for Cards) fall back to the old field/:id/values endpoint
  useChainFilterEndpoints() {
    return this.props.dashboard && this.props.dashboard.id;
  }

  parameterId() {
    return this.props.parameter && this.props.parameter.id;
  }

  componentDidMount() {
    if (this.shouldList()) {
      if (this.useChainFilterEndpoints()) {
        this.fetchDashboardParamValues();
      } else {
        const { fields, fetchFieldValues } = this.props;
        fields.forEach(field => fetchFieldValues(field.id));
      }
    }
  }

  fetchDashboardParamValues = async () => {
    this.setState({
      loadingState: "LOADING",
      options: [],
    });

    let options;
    try {
      const { dashboard, parameter, parameters } = this.props;
      const args = {
        dashboardId: dashboard?.id,
        parameter,
        parameters,
      };
      await this.props.fetchDashboardParameterValues(args);
      options = this.props.dashboardParameterValuesCache.get(args);
    } finally {
      this.setState({
        loadingState: "LOADED",
        options,
      });
    }
  };

  componentWillUnmount() {
    if (this._cancel) {
      this._cancel();
    }
  }

  getSearchableTokenFieldPlaceholder(fields, firstField) {
    let placeholder;

    const names = new Set(
      fields.map(field => stripId(this.searchField(field).display_name)),
    );

    if (names.size > 1) {
      placeholder = t`Search`;
    } else {
      const [name] = names;

      placeholder = t`Search by ${name}`;
      if (firstField.isID() && firstField !== this.searchField(firstField)) {
        placeholder += t` or enter an ID`;
      }
    }
    return placeholder;
  }

  getNonSearchableTokenFieldPlaceholder(firstField) {
    if (firstField.isID()) {
      return t`Enter an ID`;
    } else if (firstField.isNumeric()) {
      return t`Enter a number`;
    } else {
      return t`Enter some text`;
    }
  }

  getTokenFieldPlaceholder() {
    const { fields, placeholder } = this.props;

    if (placeholder) {
      return placeholder;
    }

    const [firstField] = fields;

    if (this.hasList()) {
      return t`Search the list`;
    } else if (this.isSearchable()) {
      return this.getSearchableTokenFieldPlaceholder(fields, firstField);
    } else {
      return this.getNonSearchableTokenFieldPlaceholder(firstField);
    }
  }

  shouldList() {
    // Virtual fields come from native queries or questions that are based on other questions.
    // Currently, the back end returns `has_field_values` in their metadata,
    // but features like values search are not properly supported yet, so we ignore them for now.
    const nonVirtualFields = this.props.fields.filter(
      field => typeof field.id === "number",
    );

    return (
      !this.props.disableSearch &&
      nonVirtualFields.every(field => field.has_field_values === "list")
    );
  }

  hasList() {
    const nonEmptyArray = a => a && a.length > 0;
    return (
      this.shouldList() &&
      (this.useChainFilterEndpoints()
        ? this.state.loadingState === "LOADED" &&
          nonEmptyArray(this.state.options)
        : this.props.fields.every(field => nonEmptyArray(field.values)))
    );
  }

  isSearchable() {
    const { fields, disableSearch } = this.props;
    return (
      !disableSearch &&
      // search is available if:
      // all fields have a valid search field
      fields.every(this.searchField) &&
      // at least one field is set to display as "search"
      fields.some(f => f.has_field_values === "search") &&
      // and all fields are either "search" or "list"
      fields.every(
        f => f.has_field_values === "search" || f.has_field_values === "list",
      ) &&
      // ignoring for fields from native queries or coming from nested queries
      // Currently, the back end returns `has_field_values` in their metadata,
      // but features like values search are not properly supported yet, so we ignore them for now.
      fields.every(f => f.id !== "string")
    );
  }

  onInputChange = value => {
    if (value && this.isSearchable()) {
      this._search(value);
    }

    return value;
  };

  searchField = field => {
    if (this.props.disablePKRemappingForSearch && field.isPK()) {
      return field.isSearchable() ? field : null;
    }

    const remappedField = field.remappedField();
    if (remappedField && remappedField.isSearchable()) {
      return remappedField;
    }
    return field.isSearchable() ? field : null;
  };

  showRemapping = () => this.props.fields.length === 1;

  search = async (value, cancelled) => {
    if (!value) {
      return;
    }

    const { fields } = this.props;

    let results;
    if (this.useChainFilterEndpoints()) {
      const { dashboard, parameter, parameters } = this.props;
      const args = {
        dashboardId: dashboard?.id,
        parameter,
        parameters,
        query: value,
      };
      await this.props.fetchDashboardParameterValues(args);
      results = this.props.dashboardParameterValuesCache.get(args);
    } else {
      results = dedupeValues(
        await Promise.all(
          fields.map(field =>
            MetabaseApi.field_search(
              {
                value,
                fieldId: field.id,
                searchFieldId: this.searchField(field).id,
                limit: this.props.maxResults,
              },
              { cancelled },
            ),
          ),
        ),
      );

      results = results.map(result => [].concat(result));
    }

    if (this.showRemapping()) {
      const [field] = fields;
      if (field.remappedField() === this.searchField(field)) {
        this.props.addRemappings(field.id, results);
      }
    }

    return results;
  };

  _search = value => {
    const { lastValue, options } = this.state;

    // if this search is just an extension of the previous search, and the previous search
    // wasn't truncated, then we don't need to do another search because TypeaheadListing
    // will filter the previous result client-side
    if (
      lastValue &&
      value.slice(0, lastValue.length) === lastValue &&
      options.length < this.props.maxResults
    ) {
      return;
    }

    this.setState({
      loadingState: "LOADING",
    });

    if (this._cancel) {
      this._cancel();
    }

    this._searchDebounced(value);
  };

  _searchDebounced = _.debounce(async value => {
    this.setState({
      loadingState: "LOADING",
    });

    const cancelDeferred = defer();
    this._cancel = () => {
      this._cancel = null;
      cancelDeferred.resolve();
    };

    let results;
    try {
      results = await this.search(value, cancelDeferred.promise);
    } catch (e) {
      console.warn(e);
    }

    this._cancel = null;

    if (results) {
      this.setState({
        loadingState: "LOADED",
        options: results,
        lastValue: value,
      });
    } else {
      this.setState({
        loadingState: "INIT",
        options: [],
        lastValue: value,
      });
    }
  }, 500);

  renderOptions({ optionsList, isFocused, isAllSelected, isFiltered }) {
    const { alwaysShowOptions, fields } = this.props;
    const { loadingState } = this.state;
    if (alwaysShowOptions || isFocused) {
      if (optionsList) {
        return optionsList;
      } else if (this.hasList()) {
        if (isAllSelected) {
          return <EveryOptionState />;
        }
      } else if (this.isSearchable()) {
        if (loadingState === "LOADING") {
          return <LoadingState />;
        } else if (loadingState === "LOADED" && isFiltered) {
          return <NoMatchState fields={fields.map(this.searchField)} />;
        }
      }
    }
  }

  renderValue = (value, options) => {
    const { fields, formatOptions } = this.props;
    return (
      <ValueComponent
        value={value}
        column={fields[0]}
        maximumFractionDigits={20}
        remap={this.showRemapping()}
        {...formatOptions}
        {...options}
      />
    );
  };

  render() {
    const {
      value,
      onChange,
      fields,
      multi,
      autoFocus,
      color,
      className,
      style,
      parameter,
    } = this.props;
    const { loadingState } = this.state;

    const placeholder = this.getTokenFieldPlaceholder();

    let options = [];
    if (this.hasList() && !this.useChainFilterEndpoints()) {
      options = dedupeValues(fields.map(field => field.values));
    } else if (
      loadingState === "LOADED" &&
      (this.isSearchable() || this.useChainFilterEndpoints())
    ) {
      options = this.state.options;
    } else {
      options = [];
    }

    const isLoading = loadingState === "LOADING";
    const isFetchingList = this.shouldList() && isLoading;
    const hasListData = this.hasList();

    return (
      <div
        style={{
          width: this.props.expand ? this.props.maxWidth : null,
          minWidth: this.props.minWidth,
          maxWidth: this.props.maxWidth,
        }}
      >
        {isFetchingList && <LoadingState />}
        {hasListData && (
          <ListField
            isDashboardFilter={parameter}
            placeholder={this.getTokenFieldPlaceholder()}
            value={value.filter(v => v != null)}
            onChange={onChange}
            options={options}
            optionRenderer={option =>
              this.renderValue(option[0], { autoLoad: false })
            }
          />
        )}
        {!hasListData && !isFetchingList && (
          <TokenField
            value={value.filter(v => v != null)}
            onChange={onChange}
            placeholder={placeholder}
            updateOnInputChange
            // forwarded props
            multi={multi}
            autoFocus={autoFocus}
            color={color}
            style={{ ...style, minWidth: "inherit" }}
            className={className}
            parameter={this.props.parameter}
            optionsStyle={!parameter ? { maxHeight: "none" } : {}}
            // end forwarded props
            options={options}
            valueKey={0}
            valueRenderer={value =>
              this.renderValue(value, { autoLoad: true, compact: false })
            }
            optionRenderer={option =>
              this.renderValue(option[0], { autoLoad: false })
            }
            layoutRenderer={props => (
              <div>
                {props.valuesList}
                {this.renderOptions(props)}
              </div>
            )}
            filterOption={(option, filterString) => {
              const lowerCaseFilterString = filterString.toLowerCase();
              return option.some(
                value =>
                  value != null &&
                  String(value)
                    .toLowerCase()
                    .includes(lowerCaseFilterString),
              );
            }}
            onInputChange={this.onInputChange}
            parseFreeformValue={v => {
              // trim whitespace
              v = String(v || "").trim();
              // empty string is not valid
              if (!v) {
                return null;
              }
              // if the field is numeric we need to parse the string into an integer
              if (fields[0].isNumeric()) {
                if (/^-?\d+(\.\d+)?$/.test(v)) {
                  return parseFloat(v);
                } else {
                  return null;
                }
              }
              return v;
            }}
          />
        )}
      </div>
    );
  }
}

FieldValuesWidget.propTypes = fieldValuesWidgetPropTypes;

function dedupeValues(valuesList) {
  const uniqueValueMap = new Map(valuesList.flat().map(o => [o[0], o]));
  return Array.from(uniqueValueMap.values());
}

const LoadingState = () => (
  <div
    className="flex layout-centered align-center border-bottom"
    style={{ minHeight: 82 }}
  >
    <LoadingSpinner size={32} />
  </div>
);

const NoMatchState = ({ fields }) => {
  if (fields.length > 1) {
    // if there is more than one field, don't name them
    return <OptionsMessage message={t`No matching result`} />;
  }
  const [{ display_name }] = fields;
  return (
    <OptionsMessage
      message={jt`No matching ${(
        <strong>&nbsp;{display_name}&nbsp;</strong>
      )} found.`}
    />
  );
};

const EveryOptionState = () => (
  <OptionsMessage
    message={t`Including every option in your filter probably won’t do much…`}
  />
);

const OptionsMessage = ({ message }) => (
  <div className="flex layout-centered p4 border-bottom">{message}</div>
);

OptionsMessage.propTypes = optionsMessagePropTypes;

export default connect(mapStateToProps, mapDispatchToProps)(FieldValuesWidget);
