import { createContext, useContext } from "react";
import _ from "underscore";

import type { ActionFormSettings, WritebackAction } from "metabase-types/api";

import { getDefaultFormSettings } from "../../../utils";
import type { ActionCreatorUIProps } from "../types";
import type { EditableActionParams, EditorBodyProps } from "./types";
import { createEmptyWritebackAction } from "./utils";

export type ActionContextType = {
  action: Partial<WritebackAction>;
  formSettings: ActionFormSettings;
  canSave: boolean;
  isNew: boolean;
  isDirty: boolean;
  ui: ActionCreatorUIProps;
  patchAction: (action: EditableActionParams) => void;
  patchFormSettings: (formSettings: ActionFormSettings) => void;
  renderEditorBody: (props: EditorBodyProps) => React.ReactNode;
  setAction: (action: WritebackAction) => void;
};

export const ActionContext = createContext<ActionContextType>({
  action: createEmptyWritebackAction(),
  formSettings: getDefaultFormSettings(),
  canSave: false,
  isNew: true,
  isDirty: false,
  ui: {
    canRename: true,
    canChangeFieldSettings: true,
  },
  patchAction: _.noop,
  patchFormSettings: _.noop,
  renderEditorBody: () => null,
  setAction: _.noop,
});

export const useActionContext = () => useContext(ActionContext);
