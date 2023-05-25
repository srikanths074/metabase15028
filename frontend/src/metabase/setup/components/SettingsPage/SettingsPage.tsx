import React, { useEffect } from "react";
import LogoIcon from "metabase/components/LogoIcon";
import MigrationHelp from "metabase/setup/containers/CloudMigrationHelp";
import LanguageStep from "../../containers/LanguageStep";
import { PreferencesStep } from "../PreferencesStep";
import { UserStep } from "../UserStep";
import { SetupHelp } from "../SetupHelp";
import DatabaseStep from "../../containers/DatabaseStep";
import DatabaseHelp from "../../containers/DatabaseHelp";
import CompletedStep from "../../containers/CompletedStep";
import { PageHeader, PageBody } from "./SettingsPage.styled";

export interface SettingsPageProps {
  step: number;
  onStepShow: (step: number) => void;
}

const SettingsPage = ({
  step,
  onStepShow,
  ...props
}: SettingsPageProps): JSX.Element => {
  useEffect(() => {
    onStepShow(step);
  }, [step, onStepShow]);

  return (
    <div>
      <PageHeader>
        <LogoIcon height={51} />
      </PageHeader>
      <PageBody>
        <LanguageStep {...props} />
        <UserStep />
        <DatabaseStep {...props} />
        <DatabaseHelp {...props} />
        <PreferencesStep />
        <CompletedStep {...props} />
        <MigrationHelp {...props} />
        <SetupHelp />
      </PageBody>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default SettingsPage;
