import { createSelector } from "reselect";
import _ from "underscore";
import { LocaleData } from "./types";

export const getStep = (state: any) => state.setup.step;
export const getLocale = (state: any) => state.setup.locale;
export const getUser = (state: any) => state.setup.user;

export const getSettings = (state: any) => {
  return state.settings.values;
};

export const getLocales = createSelector([getSettings], settings => {
  const data = settings["available-locales"] ?? [["en", "English"]];
  const locales = data.map(([code, name]: LocaleData) => ({ code, name }));
  return _.sortBy(locales, locale => locale.name);
});
