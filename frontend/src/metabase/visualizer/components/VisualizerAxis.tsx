// eslint-disable-next-line no-restricted-imports
import { ActionIcon } from "@mantine/core";

import { Flex, Icon, Menu, Text } from "metabase/ui";

interface VisualizerAxisProps {
  direction?: "horizontal" | "vertical";
  columns: string[];
  columnOptions: Array<{ label: string; value: string }>;
  onColumnsChange: (columns: string[]) => void;
}

export function VisualizerAxis({
  direction = "horizontal",
  columns,
  columnOptions,
  onColumnsChange,
}: VisualizerAxisProps) {
  const handleColumnChange = (column: string, nextColumn: string) => {
    const nextColumns = columns.map(c => (c === column ? nextColumn : c));
    onColumnsChange(nextColumns);
  };

  const handleColumnAdd = (column: string) => {
    const nextColumns = [...columns, column];
    onColumnsChange(nextColumns);
  };

  const flexProps =
    direction === "vertical"
      ? {
          w: "16px",
          h: "100%",
        }
      : { w: "100%" };

  return (
    <Flex
      {...flexProps}
      pos="relative"
      justify="center"
      align="center"
      gap="md"
      bg="bg-light"
    >
      {columns.map(column => (
        <ColumnPicker
          key={column}
          column={column}
          columnOptions={columnOptions}
          direction={direction}
          onChange={nextColumn => handleColumnChange(column, nextColumn)}
        />
      ))}
      <AddColumnButton
        direction={direction}
        columns={columns}
        columnOptions={columnOptions}
        onAddColumn={handleColumnAdd}
      />
    </Flex>
  );
}

interface ColumnPickerProps {
  direction?: "horizontal" | "vertical";
  column: string;
  columnOptions: Array<{ label: string; value: string }>;
  onChange: (column: string) => void;
}

function ColumnPicker({
  column,
  columnOptions,
  direction = "horizontal",
  onChange,
}: ColumnPickerProps) {
  const option = columnOptions.find(option => option.value === column);

  const containerStyle =
    direction === "vertical"
      ? {
          position: "absolute",
          width: "200px",
          height: "14px",
          textAlign: "center",
          transform: "rotate(-90deg)",
          cursor: "pointer",
        }
      : { cursor: "pointer" };

  return (
    <Menu>
      <Menu.Target>
        <Flex align="center" gap="4px" style={containerStyle}>
          <Text color="text-medium" fw="bold">
            {option?.label ?? column}
          </Text>
          <Icon name="chevrondown" size={12} />
        </Flex>
      </Menu.Target>
      <Menu.Dropdown>
        {columnOptions.map(option => (
          <Menu.Item
            key={option.value}
            value={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

interface AddColumnButtonProps {
  direction?: "horizontal" | "vertical";
  columns: string[];
  columnOptions: Array<{ label: string; value: string }>;
  onAddColumn: (column: string) => void;
}

function AddColumnButton({
  direction = "horizontal",
  columns,
  columnOptions,
  onAddColumn,
}: AddColumnButtonProps) {
  const positionAttr = direction === "vertical" ? "top" : "right";

  const filteredOptions = columnOptions.filter(
    option => !columns.includes(option.value),
  );

  return (
    <Menu>
      <Menu.Target>
        <ActionIcon pos="absolute" style={{ [positionAttr]: 0 }}>
          <Icon name="add" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {filteredOptions.map(option => (
          <Menu.Item
            key={option.value}
            value={option.value}
            onClick={() => onAddColumn(option.value)}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
