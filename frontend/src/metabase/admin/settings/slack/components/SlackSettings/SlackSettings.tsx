import React, { ComponentType, ReactNode, useState } from "react";
import { jt, t } from "ttag";
import SlackBadge from "../SlackBadge";
import SlackButton from "../SlackButton";
import {
  HeaderMessage,
  HeaderRoot,
  HeaderTitle,
  SectionBody,
  SectionCode,
  SectionHeader,
  SectionLink,
  SectionMessage,
  SectionRoot,
  SectionTitle,
  SectionToggle,
} from "./SlackSettings.styled";

export interface SlackSettingsProps {
  Form: ComponentType<SlackFormProps>;
  isBot: boolean;
  isError: boolean;
  onSubmit: () => void;
}

export interface SlackFormProps {
  onSubmit: () => void;
}

const SlackSettings = ({
  Form,
  isBot,
  isError,
  onSubmit,
}: SlackSettingsProps): JSX.Element => {
  return (
    <div>
      <SettingsHeader isBot={isBot} isError={isError} />
      <CreateAppSection />
      <CopyManifestSection />
      <ActivateAppSection Form={Form} onSubmit={onSubmit} />
    </div>
  );
};

interface SettingsHeaderProps {
  isBot: boolean;
  isError: boolean;
}

const SettingsHeader = ({
  isBot,
  isError,
}: SettingsHeaderProps): JSX.Element => {
  return (
    <HeaderRoot>
      <HeaderTitle>{t`Metabase on Slack`}</HeaderTitle>
      {isBot ? (
        <HeaderMessage>
          <SlackBadge isBot={isBot} isError={isError} />{" "}
          {jt`We recommend you ${(
            <strong key="apps">{t`upgrade to Slack Apps`}</strong>
          )}, see the instructions below:`}
        </HeaderMessage>
      ) : (
        <HeaderMessage>
          {t`Bring the power of Metabase to your Slack #channels.`}{" "}
          {t`Follow these steps to connect your bot to Slack:`}
        </HeaderMessage>
      )}
    </HeaderRoot>
  );
};

interface SettingsSectionProps {
  title: string;
  children?: ReactNode;
}

const SettingsSection = ({
  title,
  children,
}: SettingsSectionProps): JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <SectionRoot>
      <SectionHeader onClick={() => setIsExpanded(!isExpanded)}>
        <SectionTitle>{title}</SectionTitle>
        <SectionToggle
          round
          icon={isExpanded ? "chevronup" : "chevrondown"}
          aria-label={t`Setup section`}
          aria-expanded={isExpanded}
        />
      </SectionHeader>
      {isExpanded && <SectionBody>{children}</SectionBody>}
    </SectionRoot>
  );
};

const CreateAppSection = (): JSX.Element => {
  return (
    <SettingsSection title={t`1. Create your Slack App`}>
      <SectionMessage>
        {t`To create your Metabase integration on Slack you’ll need to set up some things.`}{" "}
        {jt`First, go to ${(
          <SectionLink
            key="message"
            href="https://api.slack.com/apps"
          >{t`Slack Apps`}</SectionLink>
        )}, hit “${(
          <strong key="app">{t`Create New App`}</strong>
        )}” and pick “${(
          <strong key="manifest">{t`From an app manifest`}</strong>
        )}”.`}
      </SectionMessage>
      <SlackButton />
    </SettingsSection>
  );
};

const CopyManifestSection = (): JSX.Element => {
  return (
    <SettingsSection title={t`2. Copy the Metabase manifest`}>
      <SectionMessage>
        {jt`Copy our ${(
          <strong key="manifest">{t`Slack Manifest`}</strong>
        )} below and paste it in to create the app. In the following screen, click “${(
          <strong key="install">{t`Install to workspace`}</strong>
        )}” and authorize it.`}
      </SectionMessage>
      <SectionCode />
    </SettingsSection>
  );
};

interface ActivateAppSectionProps {
  Form: ComponentType<SlackFormProps>;
  onSubmit: () => void;
}

const ActivateAppSection = ({
  Form,
  onSubmit,
}: ActivateAppSectionProps): JSX.Element => {
  return (
    <SettingsSection
      title={t`3. Activate the OAuth Token and create a new slack channel`}
    >
      <SectionMessage>{jt`Click on "${(
        <strong key="click">{t`OAuth and Permissions`}</strong>
      )}" in the sidebar, copy the “${(
        <strong key="token">{t`Bot User OAuth Token`}</strong>
      )}” and paste it here. Finally, open Slack and create a public channel named “${(
        <strong key="channel">{t`metabase_files`}</strong>
      )}”.`}</SectionMessage>
      <Form onSubmit={onSubmit} />
    </SettingsSection>
  );
};

export default SlackSettings;
