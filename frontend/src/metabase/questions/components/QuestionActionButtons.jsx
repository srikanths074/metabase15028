import React from "react";
import PropTypes from "prop-types";
import { t } from "ttag";

import Button from "metabase/components/Button";
import Tooltip from "metabase/components/Tooltip";

function QuestionActionButtons({ canWrite, onOpenModal }) {
  return (
    <div className="flex align-center">
      <div className="my1 pr2">
        {canWrite && (
          <Tooltip tooltip={t`Edit details`}>
            <Button
              className="mr1"
              onlyIcon
              icon="pencil"
              iconSize={18}
              onClick={() => onOpenModal("edit")}
              data-testid="edit-details-button"
            />
          </Tooltip>
        )}
        <Tooltip tooltip={t`Add to dashboard`}>
          <Button
            onlyIcon
            icon="add_to_dash"
            iconSize={18}
            onClick={() => onOpenModal("add-to-dashboard")}
            data-testid="add-to-dashboard-button"
          />
        </Tooltip>
      </div>
      <div className="border-left pl2">
        {canWrite && (
          <Tooltip tooltip={t`Move`}>
            <Button
              className="mr1 text-light"
              onlyIcon
              icon="move"
              iconSize={18}
              onClick={() => onOpenModal("move")}
              data-testid="move-button"
            />
          </Tooltip>
        )}
        {canWrite && (
          <Tooltip tooltip={t`Duplicate this question`}>
            <Button
              className="mr1 text-light"
              onlyIcon
              icon="segment"
              iconSize={18}
              onClick={() => onOpenModal("clone")}
              data-testid="clone-button"
            />
          </Tooltip>
        )}
        {canWrite && (
          <Tooltip tooltip={t`Archive`}>
            <Button
              className="text-light"
              onlyIcon
              icon="archive"
              iconSize={18}
              onClick={() => onOpenModal("archive")}
              data-testid="archive-button"
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}

QuestionActionButtons.propTypes = {
  canWrite: PropTypes.bool,
  onOpenModal: PropTypes.func,
};

export default QuestionActionButtons;
