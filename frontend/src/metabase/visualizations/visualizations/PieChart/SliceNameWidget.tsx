import { Box } from "metabase/ui";
import type { PieRow } from "metabase/visualizations/echarts/pie/model/types";

import { SliceNameInput } from "./SliceNameWidget.styled";

export function SliceNameWidget({
  initialKey,
  pieRows,
  updateRowName,
}: {
  initialKey: string;
  pieRows: PieRow[];
  updateRowName: (newName: string, key: string) => void;
}) {
  const row = pieRows.find(row => row.key === initialKey);
  if (row == null) {
    throw Error(`Could not find pieRow with key ${initialKey}`);
  }

  return (
    // Bottom padding is needed since the popover has 1.5rem top padding, but
    // only 1rem bottom padding
    <Box w="100%" px="2rem" pb="0.5rem">
      <SliceNameInput
        value={row.name}
        subtitle={row.key !== row.name ? row.key : undefined}
        onBlurChange={event => updateRowName(event.target.value, initialKey)}
      />
    </Box>
  );
}
