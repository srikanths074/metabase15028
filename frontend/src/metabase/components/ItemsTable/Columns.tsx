import { t } from "ttag";

import ActionMenu from "metabase/collections/components/ActionMenu";
import type { ActionMenuProps } from "metabase/collections/components/ActionMenu/ActionMenu";
import DateTime from "metabase/components/DateTime";
import EntityItem from "metabase/components/EntityItem";
import type { Edit } from "metabase/components/LastEditInfoLabel/LastEditInfoLabel";
import CheckBox from "metabase/core/components/CheckBox";
import { Ellipsified } from "metabase/core/components/Ellipsified";
import Markdown from "metabase/core/components/Markdown";
import Tooltip from "metabase/core/components/Tooltip";
import { getFullName } from "metabase/lib/user";
import { PLUGIN_MODERATION } from "metabase/plugins";
import type { IconProps } from "metabase/ui";
import type { CollectionItem } from "metabase-types/api";

import type { SortableColumnHeaderProps } from "./BaseItemsTable";
import { SortableColumnHeader } from "./BaseItemsTable";
import {
  BulkSelectWrapper,
  ColumnHeader,
  DescriptionIcon,
  EntityIconCheckBox,
  ItemCell,
  ItemLink,
  ItemNameCell,
  ModelDetailLink,
  RowActionsContainer,
  TableColumn,
} from "./BaseItemsTable.styled";

type HeaderProps = Omit<SortableColumnHeaderProps, "name">;

export const Columns = {
  Select: {
    Col: () => <col style={{ width: "70px" }} />,
    Header: ({
      selectedItems,
      hasUnselected,
      onSelectAll,
      onSelectNone,
    }: {
      selectedItems?: CollectionItem[];
      hasUnselected?: boolean;
      onSelectAll?: () => void;
      onSelectNone?: () => void;
    }) => (
      <ColumnHeader>
        <BulkSelectWrapper>
          <CheckBox
            checked={!!selectedItems?.length}
            indeterminate={!!selectedItems?.length && !!hasUnselected}
            onChange={hasUnselected ? onSelectAll : onSelectNone}
            aria-label={t`Select all items`}
          />
        </BulkSelectWrapper>
      </ColumnHeader>
    ),
    Cell: ({
      testId,
      icon,
      isPinned,
      isSelected,
      handleSelectionToggled,
    }: {
      testId: string;
      icon: IconProps;
      isPinned?: boolean;
      isSelected?: boolean;
      handleSelectionToggled: () => void;
    }) => (
      <ItemCell data-testid={`${testId}-check`}>
        <EntityIconCheckBox
          variant="list"
          icon={icon}
          pinned={isPinned}
          selected={isSelected}
          onToggleSelected={handleSelectionToggled}
          selectable
          showCheckbox
        />
      </ItemCell>
    ),
  },
  Type: {
    Col: () => <col style={{ width: "70px" }} />,
    Header: ({
      sortingOptions,
      onSortingOptionsChange,
      title = t`Type`,
    }: HeaderProps) => (
      <SortableColumnHeader
        name="model"
        sortingOptions={sortingOptions}
        onSortingOptionsChange={onSortingOptionsChange}
        style={{ marginInlineStart: 6 }}
      >
        {title}
      </SortableColumnHeader>
    ),
    Cell: ({
      testId = "table",
      icon,
      isPinned,
    }: {
      testId?: string;
      icon: IconProps;
      isPinned?: boolean;
    }) => (
      <ItemCell data-testid={`${testId}-type`}>
        <EntityIconCheckBox variant="list" icon={icon} pinned={isPinned} />
      </ItemCell>
    ),
  },
  Name: {
    Col: ({ isInDragLayer }: { isInDragLayer: boolean }) => (
      <col style={{ width: isInDragLayer ? "10rem" : undefined }} />
    ),
    Header: ({ sortingOptions, onSortingOptionsChange }: HeaderProps) => (
      <SortableColumnHeader
        name="name"
        sortingOptions={sortingOptions}
        onSortingOptionsChange={onSortingOptionsChange}
      >
        {t`Name`}
      </SortableColumnHeader>
    ),
    Cell: ({
      item,
      testId = "table",
      includeDescription = true,
    }: {
      item: CollectionItem;
      testId?: string;
      includeDescription?: boolean;
    }) => (
      <ItemNameCell data-testid={`${testId}-name`}>
        <ItemLink to={item.getUrl()}>
          <EntityItem.Name name={item.name} variant="list" />
          <PLUGIN_MODERATION.ModerationStatusIcon
            size={16}
            status={item.moderated_status}
          />
          {item.description && includeDescription && (
            <DescriptionIcon
              name="info"
              size={16}
              tooltip={
                <Markdown dark disallowHeading unstyleLinks lineClamp={8}>
                  {item.description}
                </Markdown>
              }
            />
          )}
        </ItemLink>
      </ItemNameCell>
    ),
  },
  LastEditedBy: {
    Col: () => (
      <TableColumn
        style={{ width: "140px" }}
        hideAtContainerBreakpoint="sm"
        containerName="ItemsTableContainer"
      />
    ),
    Header: ({ sortingOptions, onSortingOptionsChange }: HeaderProps) => (
      <SortableColumnHeader
        name="last_edited_by"
        sortingOptions={sortingOptions}
        onSortingOptionsChange={onSortingOptionsChange}
        hideAtContainerBreakpoint="sm"
        containerName="ItemsTableContainer"
      >
        {t`Last edited by`}
      </SortableColumnHeader>
    ),
    Cell: ({
      testId = "table",
      item,
    }: {
      testId?: string;
      item: CollectionItem;
    }) => {
      const lastEditInfo = item["last-edit-info"];
      const lastEditedBy = getLastEditedBy(lastEditInfo) ?? "";

      return (
        <ItemCell
          data-testid={`${testId}-last-edited-by`}
          hideAtContainerBreakpoint="sm"
          containerName="ItemsTableContainer"
        >
          <Ellipsified>{lastEditedBy}</Ellipsified>
        </ItemCell>
      );
    },
  },
  LastEditedAt: {
    Col: () => (
      <TableColumn
        style={{ width: "140px" }}
        hideAtContainerBreakpoint="md"
        containerName="ItemsTableContainer"
      />
    ),
    Header: ({ sortingOptions, onSortingOptionsChange }: HeaderProps) => (
      <SortableColumnHeader
        name="last_edited_at"
        sortingOptions={sortingOptions}
        onSortingOptionsChange={onSortingOptionsChange}
        hideAtContainerBreakpoint="md"
        containerName="ItemsTableContainer"
      >
        {t`Last edited at`}
      </SortableColumnHeader>
    ),
    Cell: ({ testId, item }: { testId: string; item: CollectionItem }) => {
      const lastEditInfo = item["last-edit-info"];
      return (
        <ItemCell
          data-testid={`${testId}-last-edited-at`}
          data-server-date
          hideAtContainerBreakpoint="md"
          containerName="ItemsTableContainer"
        >
          {lastEditInfo && (
            <Tooltip tooltip={<DateTime value={lastEditInfo.timestamp} />}>
              <DateTime unit="day" value={lastEditInfo.timestamp} />
            </Tooltip>
          )}
        </ItemCell>
      );
    },
  },
  ActionMenu: {
    Header: () => <th></th>,
    Col: () => <col style={{ width: "100px" }} />,
    Cell: ({
      item,
      collection,
      databases,
      bookmarks,
      onCopy,
      onMove,
      createBookmark,
      deleteBookmark,
    }: ActionMenuProps) => {
      return (
        <ItemCell>
          <RowActionsContainer>
            <ActionMenu
              item={item}
              collection={collection}
              databases={databases}
              bookmarks={bookmarks}
              onCopy={onCopy}
              onMove={onMove}
              createBookmark={createBookmark}
              deleteBookmark={deleteBookmark}
            />
            {item.model === "dataset" && <ModelDetailLink model={item} />}
          </RowActionsContainer>
        </ItemCell>
      );
    },
  },
  /** Applies a border-radius to the right edge of the table.
   * This is needed since columns can be hidden responsively,
   * and so we can't just apply the border-radius to the last column in the DOM */
  RightEdge: {
    Header: () => <th></th>,
    Col: () => <col style={{ width: "1rem" }} />,
    Cell: () => <ItemCell />,
  },
};

const getLastEditedBy = (lastEditInfo?: Edit) => {
  if (!lastEditInfo) {
    return "";
  }
  const name = getFullName(lastEditInfo);
  return name || lastEditInfo.email;
};
