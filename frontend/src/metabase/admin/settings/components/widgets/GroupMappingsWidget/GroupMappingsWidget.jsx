/* eslint-disable react/prop-types */
import React, { useState, useEffect } from "react";

import { t } from "ttag";
import _ from "underscore";
import AdminContentTable from "metabase/components/AdminContentTable";
import { PermissionsApi, SettingsApi } from "metabase/services";
import { isDefaultGroup } from "metabase/lib/groups";

import Icon from "metabase/components/Icon";
import Tooltip from "metabase/core/components/Tooltip";
import SettingToggle from "../SettingToggle";
import AddMappingRow from "./AddMappingRow";
import {
  GroupMappingsWidgetRoot as Root,
  GroupMappingsWidgetHeader as Header,
  GroupMappingsWidgetToggleRoot as ToggleRoot,
  GroupMappingsWidgetAbout as About,
  GroupMappingsWidgetAboutContentRoot as AboutContentRoot,
  AddMappingButton,
} from "./GroupMappingsWidget.styled";
import MappingRow from "./MappingRow";

const groupIsMappable = group => !isDefaultGroup(group);

function GroupMappingsWidget({ mappingSetting, ...props }) {
  const [showAddRow, setShowAddRow] = useState(false);
  const [groups, setGroups] = useState(null);
  const [mappings, setMappings] = useState({});
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const setting = _.findWhere(await SettingsApi.list(), {
        key: mappingSetting,
      });

      setMappings(setting?.value || {});

      PermissionsApi.groups().then(groups =>
        setGroups(groups.filter(groupIsMappable)),
      );
    }

    fetchData();
  }, [mappingSetting]);

  const handleShowAddRow = e => {
    e.preventDefault();
    setShowAddRow(true);
  };

  const handleHideAddRow = () => {
    setShowAddRow(false);
  };

  const handleAddMapping = dn => {
    const mappingsPlusNewMapping = { ...mappings, [dn]: [] };

    SettingsApi.put({
      key: mappingSetting,
      value: mappingsPlusNewMapping,
    }).then(
      () => {
        props.onChangeSetting(mappingSetting, mappingsPlusNewMapping);
        setMappings(mappingsPlusNewMapping);

        setShowAddRow(false);
        setSaveError(null);
      },
      e => setSaveError(e),
    );
  };

  const handleChangeMapping = dn => (group, selected) => {
    const updatedMappings = selected
      ? { ...mappings, [dn]: [...mappings[dn], group.id] }
      : {
          ...mappings,
          [dn]: mappings[dn].filter(id => id !== group.id),
        };

    SettingsApi.put({
      key: mappingSetting,
      value: updatedMappings,
    }).then(
      () => {
        props.onChangeSetting(mappingSetting, updatedMappings);
        setMappings(updatedMappings);

        setSaveError(null);
      },
      e => setSaveError(e),
    );
  };

  const handleDeleteMapping = (dn, onSuccess) => {
    const mappingsMinusDeletedMapping = _.omit(mappings, dn);

    SettingsApi.put({
      key: mappingSetting,
      value: mappingsMinusDeletedMapping,
    }).then(
      () => {
        props.onChangeSetting(mappingSetting, mappingsMinusDeletedMapping);
        setMappings(mappingsMinusDeletedMapping);

        onSuccess();

        setSaveError(null);
      },
      e => setSaveError(e),
    );
  };

  return (
    <Root>
      <Header>
        <ToggleRoot>
          <span>{t`Synchronize Group Memberships`}</span>
          <SettingToggle {...props} hideLabel />
        </ToggleRoot>
        <About>
          <Tooltip
            tooltip={t`Mappings allow Metabase to automatically add and remove users from groups based on the membership information provided by the directory server. If a group isn‘t mapped, its membership won‘t be synced.`}
            placement="top"
          >
            <AboutContentRoot>
              <Icon name="info" />
              <span>{t`About mappings`}</span>
            </AboutContentRoot>
          </Tooltip>
        </About>
      </Header>

      <div>
        <div>
          {!showAddRow && (
            <AddMappingButton primary small onClick={handleShowAddRow}>
              {t`New mapping`}
            </AddMappingButton>
          )}
          <AdminContentTable columnTitles={[props.groupHeading, t`Groups`, ""]}>
            {showAddRow && (
              <AddMappingRow
                mappings={mappings}
                placeholder={props.groupPlaceholder}
                onCancel={handleHideAddRow}
                onAdd={handleAddMapping}
                onDeleteMapping={handleDeleteMapping}
              />
            )}
            {Object.keys(mappings).length === 0 && !showAddRow && (
              <tr>
                <td>&nbsp;</td>
                <td> {t`No mappings yet`}</td>
                <td>&nbsp;</td>
              </tr>
            )}
            {Object.entries(mappings).map(([dn, selectedGroupIds]) => (
              <MappingRow
                key={dn}
                dn={dn}
                groups={groups || []}
                selectedGroupIds={selectedGroupIds}
                onChange={handleChangeMapping(dn)}
                onDeleteMapping={handleDeleteMapping}
              />
            ))}
          </AdminContentTable>
        </div>
        <div>
          {saveError?.data?.message && (
            <span className="text-error text-bold">
              {saveError.data.message}
            </span>
          )}
        </div>
      </div>
    </Root>
  );
}

export default GroupMappingsWidget;
