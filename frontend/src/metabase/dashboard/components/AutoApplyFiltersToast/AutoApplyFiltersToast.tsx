import React, { useEffect, useMemo } from "react";
import { t } from "ttag";
import { useUnmount } from "react-use";

import { useSelector, useDispatch } from "metabase/lib/redux";
import {
  getAutoApplyFiltersToastStateName,
  getDashboardId,
  getIsAutoApplyFilters,
  getParameterValues,
} from "metabase/dashboard/selectors";
import {
  dismissAutoApplyFiltersToast,
  saveDashboardAndCards,
  setDashboardAttributes,
  setNeverShowAutoApplyFiltersToast,
  setReadyForAutoApplyFiltersToast,
} from "metabase/dashboard/actions";
import { addUndo, dismissUndo } from "metabase/redux/undo";
import { useUniqueId } from "metabase/hooks/use-unique-id";
import { StyledToasterButton } from "./AutoApplyFiltersToast.styled";

export default function AutoApplyFilterToast() {
  const isAutoApplyFilters = useSelector(getIsAutoApplyFilters);
  const parameterValues = useSelector(getParameterValues);
  const autoApplyFiltersToastStateName = useSelector(
    getAutoApplyFiltersToastStateName,
  );
  const dashboardId = useSelector(getDashboardId);

  const hasParameterValues = useMemo(
    () =>
      Object.values(parameterValues).some(parameterValue =>
        Array.isArray(parameterValue)
          ? parameterValue.length > 0
          : parameterValue != null,
      ),
    [parameterValues],
  );
  const isReadyForToast = isAutoApplyFilters && hasParameterValues;

  const dispatch = useDispatch();

  useEffect(() => {
    if (isReadyForToast) {
      dispatch(setReadyForAutoApplyFiltersToast());
    } else {
      dispatch(setNeverShowAutoApplyFiltersToast());
    }
  }, [dispatch, isReadyForToast]);

  const autoApplyFiltersToastId = useUniqueId();

  useEffect(() => {
    if (autoApplyFiltersToastStateName === "shown") {
      const onTurnOffAutoApplyFilters = () => {
        dispatch(
          setDashboardAttributes({
            id: dashboardId,
            attributes: {
              auto_apply_filters: false,
            },
          }),
        );
        dispatch(saveDashboardAndCards());
      };

      dispatch(
        addUndo({
          id: autoApplyFiltersToastId,
          timeout: false,
          message: (
            <>
              {t`You can make this dashboard snappier by turning off auto-applying filters.`}
              <StyledToasterButton onClick={onTurnOffAutoApplyFilters}>
                {t`Turn off`}
              </StyledToasterButton>
            </>
          ),
        }),
      );

      return () => {
        dispatch(dismissAutoApplyFiltersToast());
        dispatch(dismissUndo(autoApplyFiltersToastId, false));
      };
    }
  }, [
    autoApplyFiltersToastId,
    autoApplyFiltersToastStateName,
    dashboardId,
    dispatch,
  ]);

  useUnmount(() => {
    dispatch(setNeverShowAutoApplyFiltersToast());
  });

  return null;
}
