import { DEFAULT_METABASE_COMPONENT_THEME } from "embedding-sdk/lib/theme";
import { color } from "metabase/lib/colors";
import type { MantineThemeOther } from "metabase/ui";
import { getSizeInPx } from "metabase/visualizations/shared/utils/size-in-px";
import type { VisualizationTheme } from "metabase/visualizations/types";

function getPieBorderColor(
  options: MantineThemeOther,
  isDashboard: boolean | undefined,
  isNightMode: boolean | undefined,
) {
  if (isDashboard && isNightMode) {
    return "var(--mb-color-bg-night)";
  }
  if (isDashboard) {
    return options.dashboard.card.backgroundColor;
  }
  if (options.question.backgroundColor === "transparent") {
    return "var(--mb-color-bg-white)";
  }
  return options.question.backgroundColor;
}

/**
 * Computes the visualization style from the Mantine theme.
 */
export function getVisualizationTheme({
  theme,
  isDashboard,
  isNightMode,
  isStaticViz,
}: {
  theme: MantineThemeOther;
  isDashboard?: boolean;
  isNightMode?: boolean;
  isStaticViz?: boolean;
}): VisualizationTheme {
  const { cartesian } = theme;

  // This allows sdk users to set the base font size,
  // which scales the visualization's font sizes.
  const baseFontSize = getSizeInPx(theme.fontSize);

  // ECharts requires font sizes in px for offset calculations.
  const px = (value: string) =>
    getSizeInPx(value, baseFontSize) ?? baseFontSize ?? 14;

  return {
    cartesian: {
      label: { fontSize: px(cartesian.label.fontSize) },
      goalLine: {
        label: { fontSize: px(cartesian.goalLine.label.fontSize) },
      },
    },
    pie: {
      borderColor: isStaticViz
        ? color("text-white")
        : getPieBorderColor(theme, isDashboard, isNightMode),
    },
  };
}

export const DEFAULT_VISUALIZATION_THEME = getVisualizationTheme({
  theme: DEFAULT_METABASE_COMPONENT_THEME,
  isStaticViz: true,
});
