import { useState } from "react";

import { useEmbedTheme } from "metabase/dashboard/hoc/controls/hooks/use-embed-theme";
import type {
  EmbedDisplayControls,
  EmbedDisplayParams,
} from "metabase/dashboard/hoc/controls/types";
import { isWithinIframe } from "metabase/lib/dom";

export const DEFAULT_EMBED_DISPLAY_OPTIONS: EmbedDisplayParams = {
  bordered: false,
  titled: true,
  hideDownloadButton: null,
  hideParameters: null,
  font: null,
  theme: null,
};

export const useEmbedDisplayOptions = (): EmbedDisplayControls => {
  const [bordered, setBordered] = useState(
    isWithinIframe() || DEFAULT_EMBED_DISPLAY_OPTIONS.bordered,
  );
  const [titled, setTitled] = useState(DEFAULT_EMBED_DISPLAY_OPTIONS.titled);
  const [hideDownloadButton, setHideDownloadButton] = useState(
    DEFAULT_EMBED_DISPLAY_OPTIONS.hideDownloadButton,
  );
  const [font, setFont] = useState(DEFAULT_EMBED_DISPLAY_OPTIONS.font);
  const [hideParameters, setHideParameters] = useState(
    DEFAULT_EMBED_DISPLAY_OPTIONS.hideParameters,
  );
  const {
    hasNightModeToggle,
    isNightMode,
    onNightModeChange,
    setTheme,
    theme,
  } = useEmbedTheme();

  return {
    bordered,
    setBordered,
    titled,
    setTitled,
    hideDownloadButton,
    setHideDownloadButton,
    hideParameters,
    setHideParameters,
    font,
    setFont,
    hasNightModeToggle,
    isNightMode,
    onNightModeChange,
    setTheme,
    theme,
  };
};
