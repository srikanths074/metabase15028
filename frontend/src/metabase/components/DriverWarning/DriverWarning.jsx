import React from "react";
import PropTypes from "prop-types";

import { jt, t } from "ttag";

import {
  allEngines,
  engineSupersedesMap,
} from "metabase/entities/databases/forms";

import Warnings from "metabase/query_builder/components/Warnings";

import {
  CardContent,
  DriverWarningContainer,
  IconContainer,
} from "./DriverWarning.styled";
import ExternalLink from "metabase/components/ExternalLink";
import MetabaseSettings from "metabase/lib/settings";

const propTypes = {
  engine: PropTypes.string.isRequired,
  onEngineChange: PropTypes.func.isRequired,
};

const driverUpgradeHelpLink = MetabaseSettings.docsUrl(
  "administration-guide/99-upgrading-drivers",
);

function getSupersedesWarningContent(
  newDriver,
  supersedesDriver,
  onEngineChange,
) {
  return (
    <div>
      <p className="text-medium m0">
        {t`This is our new ${
          allEngines[newDriver]["driver-name"]
        } driver, which is faster and more reliable.`}
      </p>
      <p>{jt`The old driver has been deprecated and will be removed in the next release. If you really
      need to use it, you can ${(
        <a className="link" onClick={() => onEngineChange(supersedesDriver)}>
          find it here
        </a>
      )}.`}</p>
    </div>
  );
}

function getSupersededByWarningContent(engine) {
  return (
    <div>
      <p className="text-medium m0">
        {t`This driver has been deprecated and will be removed in the next release.`}
      </p>
      <p className="text-medium m0">
        {t`We recommend that you upgrade to the new ${
          allEngines[engine]["driver-name"]
        } driver, which is faster and more reliable.`}
      </p>
      <ExternalLink
        href={driverUpgradeHelpLink}
        className="text-brand text-bold"
      >
        {t`How to upgrade a driver (TODO: fix link)`}
      </ExternalLink>
    </div>
  );
}

function DriverWarning({ engine, onEngineChange, ...props }) {
  const supersededBy = engineSupersedesMap["superseded_by"][engine];
  const supersedes = engineSupersedesMap["supersedes"][engine];

  if (!supersedes && !supersededBy) {
    return null;
  }

  const tooltipWarning = supersedes ? t`New driver` : t`Driver deprecated`;
  const warningContent = supersedes
    ? getSupersedesWarningContent(engine, supersedes, onEngineChange)
    : getSupersededByWarningContent(supersededBy);

  return (
    <DriverWarningContainer p={2} {...props}>
      <IconContainer>
        <Warnings
          className="mx2 text-gold"
          warnings={[tooltipWarning]}
          size={20}
        />
      </IconContainer>
      <CardContent flexDirection="column" justify="center" className="ml2">
        {warningContent}
      </CardContent>
    </DriverWarningContainer>
  );
}

DriverWarning.propTypes = propTypes;

export default DriverWarning;
