import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { pick } from "underscore";

import { parseSearchOptions, parseHashOptions } from "metabase/lib/browser";
import type { EmbedOptions } from "metabase-types/store";

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = {
  top_nav: true,
  side_nav: "default",
  search: false,
  new_button: false,
  breadcrumbs: true,
  logo: true,
  header: true,
  additional_info: true,
  action_buttons: true,
} as const;

const allowedEmbedOptions = Object.keys(DEFAULT_EMBED_OPTIONS);
const allowedEmbedHashOptions = ["font"];

export const urlParameterToBoolean = (
  urlParameter: string | string[] | boolean | undefined,
) => {
  if (urlParameter === undefined) {
    return undefined;
  }
  if (Array.isArray(urlParameter)) {
    return Boolean(urlParameter.at(-1));
  } else {
    return Boolean(urlParameter);
  }
};

const interactiveEmbedSlice = createSlice({
  name: "interactiveEmbed",
  initialState: {
    options: {} as EmbedOptions,
    isEmbeddingSdk: false,
  },
  reducers: {
    setInitialUrlOptions: (
      state,
      action: PayloadAction<{ search: string; hash: string }>,
    ) => {
      const searchOptions = parseSearchOptions(action.payload.search);

      state.options = {
        ...DEFAULT_EMBED_OPTIONS,
        ...pick(searchOptions, allowedEmbedOptions),
        ...pick(parseHashOptions(action.payload.hash), allowedEmbedHashOptions),
      };
    },
    setOptions: (state, action: PayloadAction<Partial<EmbedOptions>>) => {
      state.options = {
        ...state.options,
        ...action.payload,
      };
    },
  },
});

export const { setInitialUrlOptions, setOptions } =
  interactiveEmbedSlice.actions;

// eslint-disable-next-line import/no-default-export
export default interactiveEmbedSlice.reducer;
