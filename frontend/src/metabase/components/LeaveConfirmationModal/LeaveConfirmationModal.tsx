import type { Location } from "history";
import { useEffect, useState } from "react";
import type { InjectedRouter, Route } from "react-router";
import { withRouter } from "react-router";
import { push } from "react-router-redux";

import { LeaveConfirmation } from "metabase/components/LeaveConfirmation";
import Modal from "metabase/components/Modal";
import useBeforeUnload from "metabase/hooks/use-before-unload";
import { useDispatch } from "metabase/lib/redux";

interface Props {
  isEnabled: boolean;
  isLocationAllowed?: (location?: Location) => boolean;
  route: Route;
  router: InjectedRouter;
}

const IS_LOCATION_ALLOWED = (location?: Location) => {
  /**
   * If there is no "location" then it's beforeunload event, which is
   * handled by useBeforeUnload hook - no reason to duplicate its work.
   */
  if (!location) {
    return true;
  }

  return false;
};

const LeaveConfirmationModalBase = ({
  isEnabled,
  isLocationAllowed = IS_LOCATION_ALLOWED,
  route,
  router,
}: Props) => {
  const dispatch = useDispatch();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [nextLocation, setNextLocation] = useState<Location>();

  useBeforeUnload(isEnabled);

  useEffect(() => {
    const removeLeaveHook = router.setRouteLeaveHook(route, location => {
      if (isEnabled && !isConfirmed && !isLocationAllowed(location)) {
        setIsConfirmationVisible(true);
        setNextLocation(location);
        return false;
      }
    });

    return removeLeaveHook;
  }, [isLocationAllowed, router, route, isEnabled, isConfirmed]);

  useEffect(() => {
    if (isConfirmed && nextLocation) {
      dispatch(push(nextLocation));
    }
  }, [dispatch, isConfirmed, nextLocation]);

  const handleClose = () => {
    setIsConfirmationVisible(false);
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
  };

  return (
    <Modal
      data-testid="leave-confirmation-modal"
      isOpen={isConfirmationVisible}
      zIndex={5}
    >
      <LeaveConfirmation onAction={handleConfirm} onClose={handleClose} />
    </Modal>
  );
};

export const LeaveConfirmationModal = withRouter(LeaveConfirmationModalBase);
