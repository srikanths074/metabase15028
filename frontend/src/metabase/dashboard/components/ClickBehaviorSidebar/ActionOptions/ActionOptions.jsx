/* eslint-disable react/prop-types */
import React, { useCallback } from "react";
import { t } from "ttag";

import Actions from "metabase/entities/actions";

import ClickMappings from "metabase/dashboard/components/ClickMappings";

import { SidebarItem } from "../SidebarItem";
import { Heading, SidebarContent } from "../ClickBehaviorSidebar.styled";
import {
  ActionSidebarItem,
  ActionSidebarItemIcon,
  ActionDescription,
} from "./ActionOptions.styled";

const ActionOption = ({ name, description, isSelected, onClick }) => {
  return (
    <ActionSidebarItem
      onClick={onClick}
      isSelected={isSelected}
      hasDescription={!!description}
    >
      <ActionSidebarItemIcon name="bolt" />
      <div>
        <SidebarItem.Name>{name}</SidebarItem.Name>
        {description && <ActionDescription>{description}</ActionDescription>}
      </div>
    </ActionSidebarItem>
  );
};

function ActionOptions({ dashcard, clickBehavior, updateSettings }) {
  const handleActionSelected = useCallback(
    action => {
      updateSettings({
        type: clickBehavior.type,
        emitter_id: clickBehavior.emitter_id,
        action: action.id,
      });
    },
    [clickBehavior, updateSettings],
  );

  return (
    <SidebarContent>
      <Heading className="text-medium">{t`Pick an action`}</Heading>
      <Actions.ListLoader>
        {({ actions }) => {
          const selectedAction = actions.find(
            action => action.id === clickBehavior.action,
          );
          return (
            <>
              {actions.map(action => (
                <ActionOption
                  key={action.id}
                  name={action.name}
                  description={action.description}
                  isSelected={clickBehavior.action === action.id}
                  onClick={() => handleActionSelected(action)}
                />
              ))}
              {selectedAction && (
                <ClickMappings
                  isAction
                  object={selectedAction}
                  dashcard={dashcard}
                  clickBehavior={clickBehavior}
                  updateSettings={updateSettings}
                />
              )}
            </>
          );
        }}
      </Actions.ListLoader>
    </SidebarContent>
  );
}

export default ActionOptions;
