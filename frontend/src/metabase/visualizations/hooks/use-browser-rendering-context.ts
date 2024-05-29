import { useMemo } from "react";

import { usePalette } from "metabase/hooks/use-palette";
import { color } from "metabase/lib/colors";
import { formatValue } from "metabase/lib/formatting/value";
import { measureTextWidth } from "metabase/lib/measure-text";
import { useMantineTheme } from "metabase/ui";
import { getVisualizationStyleFromTheme } from "metabase/visualizations/shared/utils/style-from-theme";
import type { RenderingContext } from "metabase/visualizations/types";

interface RenderingOptions {
  fontFamily: string;
}

export const useBrowserRenderingContext = (
  options: RenderingOptions,
): RenderingContext => {
  const { fontFamily } = options;

  const palette = usePalette();
  const theme = useMantineTheme();

  return useMemo(() => {
    const style = getVisualizationStyleFromTheme(theme);

    return {
      getColor: name => color(name, palette),
      formatValue: (value, options) => String(formatValue(value, options)),
      measureText: measureTextWidth,
      fontFamily: `${fontFamily}, Arial, sans-serif`,
      style,
    };
  }, [fontFamily, palette, theme]);
};
