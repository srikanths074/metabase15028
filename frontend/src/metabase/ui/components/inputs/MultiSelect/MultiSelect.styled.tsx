import type { MantineThemeOverride } from "@mantine/core";

export const getMultiSelectOverrides =
  (): MantineThemeOverride["components"] => ({
    MultiSelect: {
      defaultProps: {
        dropdownComponent: "div",
        withinPortal: true,
      },
    },
  });
