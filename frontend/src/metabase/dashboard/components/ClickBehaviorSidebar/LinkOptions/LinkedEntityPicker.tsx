import { useCallback } from "react";
import { t } from "ttag";

import { useDashboardQuery } from "metabase/common/hooks";
import { Icon } from "metabase/core/components/Icon";
import ModalContent from "metabase/components/ModalContent";
import ModalWithTrigger from "metabase/components/ModalWithTrigger";

import Dashboards from "metabase/entities/dashboards";
import Questions from "metabase/entities/questions";

import DashboardPicker from "metabase/containers/DashboardPicker";
import QuestionPicker from "metabase/containers/QuestionPicker";

import ClickMappings, {
  clickTargetObjectType,
} from "metabase/dashboard/components/ClickMappings";

import type {
  Dashboard,
  DashboardId,
  DashboardCard,
  CardId,
  ClickBehavior,
  EntityCustomDestinationClickBehavior,
  DashboardTab,
} from "metabase-types/api";
import type Question from "metabase-lib/Question";

import { SidebarItem } from "../SidebarItem";
import { Heading } from "../ClickBehaviorSidebar.styled";
import {
  LinkTargetEntityPickerContent,
  SelectedEntityPickerIcon,
  SelectedEntityPickerContent,
} from "./LinkOptions.styled";
import { DashboardTabSelect } from "./LinkedEntityPicker.styled";

const LINK_TARGETS = {
  question: {
    Entity: Questions,
    PickerComponent: QuestionPicker,
    pickerIcon: "bar" as const,
    getModalTitle: () => t`Pick a question to link to`,
    getPickerButtonLabel: () => t`Pick a question…`,
  },
  dashboard: {
    Entity: Dashboards,
    PickerComponent: DashboardPicker,
    pickerIcon: "dashboard" as const,
    getModalTitle: () => t`Pick a dashboard to link to`,
    getPickerButtonLabel: () => t`Pick a dashboard…`,
  },
};

const NO_DASHBOARD_TABS: DashboardTab[] = [];

function PickerControl({
  clickBehavior,
  onCancel,
}: {
  clickBehavior: EntityCustomDestinationClickBehavior;
  onCancel: () => void;
}) {
  const { Entity, pickerIcon, getPickerButtonLabel } =
    LINK_TARGETS[clickBehavior.linkType];

  const renderLabel = useCallback(() => {
    const hasSelectedTarget = clickBehavior.targetId != null;
    if (hasSelectedTarget) {
      return <Entity.Name id={clickBehavior.targetId} />;
    }
    return getPickerButtonLabel();
  }, [Entity, clickBehavior.targetId, getPickerButtonLabel]);

  return (
    <SidebarItem.Selectable isSelected padded={false}>
      <LinkTargetEntityPickerContent>
        <SelectedEntityPickerIcon name={pickerIcon} />
        <SelectedEntityPickerContent>
          {renderLabel()}
          <Icon name="chevrondown" size={12} className="ml-auto" />
        </SelectedEntityPickerContent>
      </LinkTargetEntityPickerContent>
      <SidebarItem.CloseIcon onClick={onCancel} />
    </SidebarItem.Selectable>
  );
}

function getTargetClickMappingsHeading(entity: Question | Dashboard) {
  return {
    dashboard: t`Pass values to this dashboard's filters (optional)`,
    native: t`Pass values to this question's variables (optional)`,
    gui: t`Pass values to filter this question (optional)`,
  }[clickTargetObjectType(entity)];
}

function TargetClickMappings({
  isDash,
  clickBehavior,
  dashcard,
  updateSettings,
}: {
  isDash: boolean;
  clickBehavior: EntityCustomDestinationClickBehavior;
  dashcard: DashboardCard;
  updateSettings: (settings: Partial<ClickBehavior>) => void;
}) {
  const Entity = isDash ? Dashboards : Questions;
  return (
    <Entity.Loader id={clickBehavior.targetId}>
      {({ object }: { object: Question | Dashboard }) => (
        <div className="pt1">
          <Heading>{getTargetClickMappingsHeading(object)}</Heading>
          <ClickMappings
            object={object}
            dashcard={dashcard}
            isDash={isDash}
            clickBehavior={clickBehavior}
            updateSettings={updateSettings}
          />
        </div>
      )}
    </Entity.Loader>
  );
}

function LinkedEntityPicker({
  dashcard,
  clickBehavior,
  updateSettings,
}: {
  dashcard: DashboardCard;
  clickBehavior: EntityCustomDestinationClickBehavior;
  updateSettings: (settings: Partial<ClickBehavior>) => void;
}) {
  const { linkType, targetId } = clickBehavior;
  const isDash = linkType === "dashboard";
  const hasSelectedTarget = clickBehavior.targetId != null;
  const { PickerComponent, getModalTitle } = LINK_TARGETS[linkType];

  const handleSelectLinkTargetEntityId = useCallback(
    targetId => {
      const nextSettings = { ...clickBehavior, targetId };
      const isNewTargetEntity = targetId !== clickBehavior.targetId;
      if (isNewTargetEntity) {
        // For new target entity, parameter mappings for the previous link target
        // don't make sense and have to be reset
        nextSettings.parameterMapping = {};
      }
      updateSettings(nextSettings);
    },
    [clickBehavior, updateSettings],
  );

  const handleResetLinkTargetType = useCallback(() => {
    updateSettings({
      type: clickBehavior.type,

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      linkType: null,
    });
  }, [clickBehavior, updateSettings]);

  const { data: dashboard } = useDashboardQuery({
    enabled: isDash,
    id: targetId,
  });
  const dashboardTabs = dashboard?.tabs ?? NO_DASHBOARD_TABS;
  const dashboardTabsOptions = dashboardTabs.map(tab => ({
    label: tab.name,
    value: String(tab.id),
  }));
  const defaultDashboardTabId: number | undefined = dashboardTabs[0]?.id;
  const dashboardTabId = isDash
    ? clickBehavior.tabId ?? defaultDashboardTabId
    : undefined;

  const handleDashboardTabChange = (value: string) => {
    if (!isDash) {
      throw new Error("This should never happen");
    }

    updateSettings({ ...clickBehavior, tabId: Number(value) });
  };

  return (
    <div>
      <div className="pb1">
        <ModalWithTrigger
          triggerElement={
            <PickerControl
              clickBehavior={clickBehavior}
              onCancel={handleResetLinkTargetType}
            />
          }
          isInitiallyOpen={!hasSelectedTarget}
        >
          {({ onClose }: { onClose: () => void }) => (
            <ModalContent
              title={getModalTitle()}
              onClose={hasSelectedTarget ? onClose : undefined}
            >
              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
              {/* @ts-ignore */}
              <PickerComponent
                value={clickBehavior.targetId}
                onChange={(targetId: CardId | DashboardId) => {
                  handleSelectLinkTargetEntityId(targetId);
                  onClose();
                }}
              />
            </ModalContent>
          )}
        </ModalWithTrigger>
      </div>

      {isDash && dashboardTabs.length > 1 && (
        <DashboardTabSelect
          data={dashboardTabsOptions}
          label={t`Select a dashboard tab`}
          value={String(dashboardTabId)}
          onChange={handleDashboardTabChange}
        />
      )}

      {hasSelectedTarget && (
        <TargetClickMappings
          isDash={isDash}
          clickBehavior={clickBehavior}
          dashcard={dashcard}
          updateSettings={updateSettings}
        />
      )}
    </div>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default LinkedEntityPicker;
