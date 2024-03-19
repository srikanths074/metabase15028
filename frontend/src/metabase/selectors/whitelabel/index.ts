import { PLUGIN_SELECTORS } from "metabase/plugins";
import type { State } from "metabase-types/store";

export function getWhiteLabeledLoadingMessage(state: State) {
  return PLUGIN_SELECTORS.getLoadingMessage(state);
}

export function getIsWhiteLabeling(state: State) {
  return PLUGIN_SELECTORS.getIsWhiteLabeling(state);
}

export function getApplicationName(state: State) {
  return PLUGIN_SELECTORS.getApplicationName(state);
}

export function getCanWhitelabel(state: State) {
  return PLUGIN_SELECTORS.canWhitelabel(state);
}

export function getShowMetabaseLinks(state: State) {
  return PLUGIN_SELECTORS.getShowMetabaseLinks(state);
}

export function getLoginPageIllustration(state: State) {
  return PLUGIN_SELECTORS.getLoginPageIllustration(state);
}

export function getLandingPageIllustration(state: State) {
  return PLUGIN_SELECTORS.getLandingPageIllustration(state);
}

export function getNoQuestionResultsIllustration(state: State) {
  return PLUGIN_SELECTORS.getNoQuestionResultsIllustration(state);
}
