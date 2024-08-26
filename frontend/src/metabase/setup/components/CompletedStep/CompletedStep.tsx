import cx from "classnames";
import { useState } from "react";
import { t } from "ttag";

import ButtonsS from "metabase/css/components/buttons.module.css";
import { useSelector } from "metabase/lib/redux";
import { subscribeToNewsletter } from "metabase/setup/utils";
import { Switch } from "metabase/ui";

import { getIsStepActive, getUserEmail } from "../../selectors";

import {
  StepBody,
  StepFooter,
  StepRoot,
  StepTitle,
} from "./CompletedStep.styled";

export const CompletedStep = (): JSX.Element | null => {
  const [checkboxValue, setCheckboxValue] = useState(false);
  const email = useSelector(getUserEmail);

  const isStepActive = useSelector(state =>
    getIsStepActive(state, "completed"),
  );
  if (!isStepActive) {
    return null;
  }

  const baseUrl = window.MetabaseRoot ?? "/";

  const handleClick = () => {
    if (checkboxValue && email) {
      subscribeToNewsletter(email);
    }
  };

  return (
    <StepRoot>
      <StepTitle>{t`You're all set up!`}</StepTitle>
      <StepBody>
        <Switch
          checked={checkboxValue}
          onChange={e => setCheckboxValue(e.target.checked)}
          label={t`Get infrequent emails about new releases and feature updates.`}
        />
      </StepBody>
      <StepFooter>
        <a
          onClick={handleClick}
          className={cx(
            ButtonsS.Button,
            ButtonsS.ButtonPrimary,
            ButtonsS.ButtonLarge,
          )}
          href={baseUrl}
        >
          {t`Take me to Metabase`}
        </a>
      </StepFooter>
    </StepRoot>
  );
};
