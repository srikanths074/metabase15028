import React, { useCallback } from "react";
import { connect } from "react-redux";
import _ from "underscore";
import Actions from "metabase/entities/actions";
import ModalContent from "metabase/components/ModalContent";
import {
  ActionFormSubmitResult,
  ParametersForActionExecution,
  WritebackAction,
  WritebackActionId,
} from "metabase-types/api";
import { State } from "metabase-types/store";
import { executeAction, ExecuteActionOpts } from "../../actions";
import { getFormTitle } from "../../utils";
import ActionParametersInputForm from "../ActionParametersInputForm";

interface OwnProps {
  actionId: WritebackActionId;
  onSubmit: (opts: ExecuteActionOpts) => Promise<ActionFormSubmitResult>;
  onClose?: () => void;
}

interface ActionLoaderProps {
  action: WritebackAction;
}

type ActionRunModalProps = OwnProps & ActionLoaderProps;

const ActionRunModal = ({ action, onSubmit, onClose }: ActionRunModalProps) => {
  const title = getFormTitle(action);

  const handleSubmit = useCallback(
    (parameters: ParametersForActionExecution) => {
      return onSubmit({ action, parameters });
    },
    [action, onSubmit],
  );

  return (
    <ModalContent title={title} onClose={onClose}>
      <ActionParametersInputForm
        action={action}
        onCancel={onClose}
        onSubmit={handleSubmit}
        onSubmitSuccess={onClose}
      />
    </ModalContent>
  );
};

const mapDispatchToProps = {
  onSubmit: executeAction,
};

export default _.compose(
  Actions.load({
    id: (state: State, props: OwnProps) => props.actionId,
  }),
  connect(null, mapDispatchToProps),
)(ActionRunModal);
