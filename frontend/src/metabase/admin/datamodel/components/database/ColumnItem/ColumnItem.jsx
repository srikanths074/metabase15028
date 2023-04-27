/* eslint-disable react/prop-types */
import React, { Component } from "react";
import { t } from "ttag";

import _ from "underscore";
import cx from "classnames";
import Select, { Option } from "metabase/core/components/Select";
import * as MetabaseCore from "metabase/lib/core";
import { getGlobalSettingsForColumn } from "metabase/visualizations/lib/settings/column";

import { currency } from "cljs/metabase.shared.util.currency";

import * as MetabaseAnalytics from "metabase/lib/analytics";
import { isTypeFK, isCurrency } from "metabase-lib/types/utils/isa";

const getFkFieldPlaceholder = (field, idfields) => {
  const hasIdFields = idfields?.length > 0;
  const isRestrictedFKTargedSelected =
    isTypeFK(field.semantic_type) &&
    field.fk_target_field_id != null &&
    !idfields?.some(idField => idField.id === field.fk_target_field_id);

  if (isRestrictedFKTargedSelected) {
    return t`Field access denied`;
  }

  return hasIdFields ? t`Select a target` : t`No key available`;
};

// FieldVisibilityPicker and SemanticTypeSelect are also used in FieldApp

export class FieldVisibilityPicker extends Component {
  handleChangeVisibility = ({ target: { value: visibility_type } }) => {
    this.props.updateField({ visibility_type });
  };

  render() {
    const { field, className } = this.props;

    return (
      <Select
        className={cx("TableEditor-field-visibility", className)}
        value={field.visibility_type}
        onChange={this.handleChangeVisibility}
        options={MetabaseCore.field_visibility_types}
        optionValueFn={o => o.id}
        placeholder={t`Select a field visibility`}
      />
    );
  }
}

export class SemanticTypeAndTargetPicker extends Component {
  handleChangeSemanticType = async ({ target: { value: semantic_type } }) => {
    const { field, updateField } = this.props;

    // If we are changing the field from a FK to something else, we should delete any FKs present
    if (
      field.target &&
      field.target.id != null &&
      isTypeFK(field.semantic_type)
    ) {
      await updateField({
        semantic_type,
        fk_target_field_id: null,
      });
    } else {
      await updateField({ semantic_type });
    }

    MetabaseAnalytics.trackStructEvent(
      "Data Model",
      "Update Field Special-Type",
      semantic_type,
    );
  };

  handleChangeCurrency = async ({ target: { value: currency } }) => {
    const { field, updateField } = this.props;
    await updateField({
      settings: {
        ...(field.settings || {}),
        currency,
      },
    });
    MetabaseAnalytics.trackStructEvent(
      "Data Model",
      "Update Currency Type",
      currency,
    );
  };

  handleChangeTarget = async ({ target: { value: fk_target_field_id } }) => {
    await this.props.updateField({ fk_target_field_id });
    MetabaseAnalytics.trackStructEvent("Data Model", "Update Field Target");
  };

  render() {
    const { field, className, selectSeparator } = this.props;
    let { idfields } = this.props;

    const semanticTypes = [
      ...MetabaseCore.field_semantic_types,
      {
        id: null,
        name: t`No semantic type`,
        section: t`Other`,
      },
    ];

    const hasIdFields = idfields?.length > 0;
    const showFKTargetSelect = isTypeFK(field.semantic_type);
    const showCurrencyTypeSelect = isCurrency(field);

    // If all FK target fields are in the same schema (like `PUBLIC` for sample database)
    // or if there are no schemas at all, omit the schema name
    const includeSchema =
      _.uniq(idfields.map(idField => idField.table.schema_name)).length > 1;

    idfields = _.sortBy(idfields, field =>
      field.displayName({ includeTable: true, includeSchema }),
    );

    return (
      <div className={cx(selectSeparator ? "flex align-center" : null)}>
        <Select
          className={cx("TableEditor-field-semantic-type mt0", className)}
          value={field.semantic_type}
          onChange={this.handleChangeSemanticType}
          options={semanticTypes}
          optionValueFn={o => o.id}
          optionSectionFn={o => o.section}
          placeholder={t`Select a semantic type`}
          searchProp="name"
        />
        {showCurrencyTypeSelect && selectSeparator}
        {
          // TODO - now that we have multiple "nested" options like choosing a
          // FK table and a currency type we should make this more generic and
          // handle a "secondary" input more elegantly
          showCurrencyTypeSelect && (
            <Select
              className={cx(
                "TableEditor-field-target inline-block",
                selectSeparator ? "mt0" : "mt1",
                className,
              )}
              value={
                (field.settings && field.settings.currency) ||
                getGlobalSettingsForColumn(field).currency ||
                "USD"
              }
              onChange={this.handleChangeCurrency}
              placeholder={t`Select a currency type`}
              searchProp="name"
              searchCaseSensitive={false}
            >
              {currency.map(([_, c]) => (
                <Option name={c.name} value={c.code} key={c.code}>
                  <span className="flex full align-center">
                    <span>{c.name}</span>
                    <span className="text-bold text-light ml1">{c.symbol}</span>
                  </span>
                </Option>
              ))}
            </Select>
          )
        }
        {showFKTargetSelect && selectSeparator}
        {showFKTargetSelect && (
          <Select
            disabled={!hasIdFields}
            className={cx(
              "TableEditor-field-target text-wrap",
              selectSeparator ? "mt0" : "mt1",
              className,
            )}
            placeholder={getFkFieldPlaceholder(field, idfields)}
            searchProp={[
              "display_name",
              "table.display_name",
              "table.schema_name",
            ]}
            value={field.fk_target_field_id}
            onChange={this.handleChangeTarget}
            options={idfields}
            optionValueFn={field => field.id}
            optionNameFn={field =>
              field.displayName({ includeTable: true, includeSchema })
            }
            optionIconFn={field => null}
          />
        )}
      </div>
    );
  }
}
