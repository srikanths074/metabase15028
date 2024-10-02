import cx from "classnames";
import { useState } from "react";
import { t } from "ttag";
import _ from "underscore";

import { UploadInfoModal } from "metabase/collections/components/CollectionHeader/CollectionUploadInfoModal";
import ExternalLink from "metabase/core/components/ExternalLink";
import Link from "metabase/core/components/Link";
import CS from "metabase/css/core/index.css";
import type { CollectionTreeItem } from "metabase/entities/collections/utils";
import { useSelector } from "metabase/lib/redux";
import { NAV_SIDEBAR_WIDTH } from "metabase/nav/constants";
import {
  MAX_UPLOAD_STRING,
  UPLOAD_DATA_FILE_TYPES,
} from "metabase/redux/uploads";
import { getLearnUrl, getSetting } from "metabase/selectors/settings";
import { getApplicationName } from "metabase/selectors/whitelabel";
import {
  Box,
  Button,
  Icon,
  type IconName,
  Menu,
  Stack,
  Text,
  Title,
} from "metabase/ui";

import { PaddedSidebarLink } from "../MainNavbar.styled";

type SidebarOnboardingProps = {
  collections: CollectionTreeItem[];
  initialState: boolean;
  isAdmin: boolean;
  isSidebarOpen: boolean;
};

export function SidebarOnboardingSection({
  collections,
  initialState,
  isAdmin,
  isSidebarOpen,
}: SidebarOnboardingProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const applicationName = useSelector(getApplicationName);

  const isUploadEnabled = useSelector(
    state => getSetting(state, "uploads-settings")?.db_id,
  );
  const rootCollection = collections.find(
    ({ id, can_write }) => (id === null || id === "root") && can_write,
  );

  return (
    <Box
      m={0}
      bottom={0}
      pos="fixed"
      w={isSidebarOpen ? NAV_SIDEBAR_WIDTH : 0}
      h={isSidebarOpen ? "auto" : 0}
      bg="bg-white"
      className={cx({ [CS.borderTop]: !initialState })}
    >
      <Box px="md" py="md">
        {/*eslint-disable-next-line no-unconditional-metabase-links-render -- This link is only temporary. It will be replaced with an internal link to a page. */}
        <ExternalLink href={getLearnUrl()} className={CS.noDecoration}>
          {/* TODO: We currently don't have a `selected` state. Will be added in MS2 when we add the onboarding page. */}
          <PaddedSidebarLink icon="learn">
            {t`How to use ${applicationName}`}
          </PaddedSidebarLink>
        </ExternalLink>
      </Box>
      <Box px="xl" pb="md" className={cx({ [CS.borderTop]: initialState })}>
        {initialState && (
          <Text
            fz="sm"
            my="md"
            lh="1.333"
          >{t`Start by adding your data. Connect to a database or upload a CSV file.`}</Text>
        )}

        <Menu position="right-end" shadow="md">
          <Menu.Target>
            <Button
              leftIcon={<Icon name="add_data" />}
              fullWidth
              // compact
            >{t`Add data`}</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {isAdmin && (
              <Link to="/admin/databases/create">
                <SidebarOnboardingMenuItem
                  icon="database"
                  title={t`Add a database`}
                  subtitle={t`PostgreSQL, MySQL, Snowflake, ...`}
                />
              </Link>
            )}
            {rootCollection && !isUploadEnabled && (
              <SidebarOnboardingMenuItem
                icon="table2"
                title={t`Upload a spreadsheet`}
                subtitle={t`${UPLOAD_DATA_FILE_TYPES.join(
                  ", ",
                )} (${MAX_UPLOAD_STRING} MB max)`}
                onClick={() => setShowInfoModal(true)}
              />
            )}
          </Menu.Dropdown>
        </Menu>
      </Box>
      {showInfoModal && (
        <UploadInfoModal
          isAdmin={isAdmin}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </Box>
  );
}

type OnboaringMenuItemProps = {
  icon: IconName;
  title: string;
  subtitle: string;
  onClick?: () => void;
};

function SidebarOnboardingMenuItem({
  icon,
  title,
  subtitle,
  onClick,
}: OnboaringMenuItemProps) {
  return (
    <Menu.Item
      icon={<Icon name={icon} />}
      style={{ alignItems: "flex-start" }}
      onClick={onClick}
    >
      <Stack spacing="xs">
        <Title c="inherit" order={4}>
          {title}
        </Title>
        <Text c="inherit" size="sm">
          {subtitle}
        </Text>
      </Stack>
    </Menu.Item>
  );
}
