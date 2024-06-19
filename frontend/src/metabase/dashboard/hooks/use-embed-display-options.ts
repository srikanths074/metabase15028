import { useState } from "react";

import { useEmbedFont } from "metabase/dashboard/hooks/use-embed-font";
import { useEmbedTheme } from "metabase/dashboard/hooks/use-embed-theme";

import type { EmbedDisplayControls, EmbedDisplayParams } from "../types";

export const DEFAULT_EMBED_DISPLAY_OPTIONS: EmbedDisplayParams = {
  bordered: false,
  titled: true,
  cardTitled: true,
  hideDownloadButton: null,
  hideParameters: null,
  font: null,
  theme: "light",
};

export const useEmbedDisplayOptions = (): EmbedDisplayControls => {
  const [titled, setTitled] = useState(DEFAULT_EMBED_DISPLAY_OPTIONS.titled);
  const [hideDownloadButton, setHideDownloadButton] = useState(
    DEFAULT_EMBED_DISPLAY_OPTIONS.hideDownloadButton,
  );
  const [hideParameters, setHideParameters] = useState(
    DEFAULT_EMBED_DISPLAY_OPTIONS.hideParameters,
  );

  const { font, setFont } = useEmbedFont();

  const {
    hasNightModeToggle,
    isNightMode,
    onNightModeChange,
    setTheme,
    theme,
  } = useEmbedTheme();

  return {
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
