import React, { MouseEvent, useCallback, useContext } from "react";
import { LinkProps } from "metabase/core/components/Link";
import { TabContext } from "./TabContext";
import { TabLinkRoot, TabLabel } from "./Tab.styled";
import { getTabId, getTabPanelId } from "./utils";

export interface TabLinkProps<T> extends LinkProps {
  value?: T;
}

function TabLink<T>({ value, children, onClick, ...props }: TabLinkProps<T>) {
  const { value: selectedValue, idPrefix, onChange } = useContext(TabContext);
  const tabId = getTabId(idPrefix, value);
  const panelId = getTabPanelId(idPrefix, value);
  const isSelected = value === selectedValue;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      onChange?.(value);
    },
    [value, onClick, onChange],
  );

  return (
    <TabLinkRoot
      {...props}
      id={tabId}
      role="tab"
      isSelected={isSelected}
      aria-selected={isSelected}
      aria-controls={panelId}
      onClick={handleClick}
    >
      <TabLabel>{children}</TabLabel>
    </TabLinkRoot>
  );
}

export default Object.assign(TabLink, {
  Root: TabLinkRoot,
});
