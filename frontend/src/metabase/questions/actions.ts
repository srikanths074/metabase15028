import { loadMetadataForDependentItems } from "metabase/redux/metadata";
import { getMetadata } from "metabase/selectors/metadata";

import type { Card } from "metabase-types/api";
import type { Dispatch, GetState } from "metabase-types/store";
import * as Lib from "metabase-lib";
import Question from "metabase-lib/Question";

export interface LoadMetadataOptions {
  reload?: boolean;
}

export const loadMetadataForCard =
  (card: Card, options?: LoadMetadataOptions) => async (dispatch: Dispatch) => {
    await dispatch(loadMetadata(card, options));
    // load entities referenced by previously loaded metadata without reloading
    await dispatch(loadMetadata(card));
  };

const loadMetadata =
  (card: Card, options?: LoadMetadataOptions) =>
  (dispatch: Dispatch, getState: GetState) => {
    const question = new Question(card, getMetadata(getState()));
    const dependencies = [
      ...question.dependentMetadata(),
      ...Lib.dependentMetadata(question.composeDataset().query()),
    ];
    return dispatch(loadMetadataForDependentItems(dependencies, options));
  };
