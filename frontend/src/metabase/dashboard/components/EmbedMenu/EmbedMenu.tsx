import { useState } from "react";
import { PublicLinkPopover } from "metabase/dashboard/components/PublicLinkPopover";
import { DashboardEmbedHeaderButton } from "metabase/dashboard/components/DashboardEmbedHeaderButton";
import { DashboardEmbedHeaderMenu } from "metabase/dashboard/components/DashboardEmbedHeaderMenu";
import { useSelector } from "metabase/lib/redux";
import { getSetting } from "metabase/selectors/settings";
import { getUserIsAdmin } from "metabase/selectors/user";

export type EmbedMenuModes =
  | "embed-menu"
  | "embed-modal"
  | "public-link-popover"
  | null;

const getEmbedMenuMode = ({
  isAdmin,
  isPublicSharingEnabled,
  hasPublicLink,
}: {
  isAdmin: boolean;
  isPublicSharingEnabled: boolean;
  hasPublicLink: boolean;
}): EmbedMenuModes => {
  if (isAdmin) {
    return isPublicSharingEnabled ? "embed-menu" : "embed-modal";
  }

  if (isPublicSharingEnabled && hasPublicLink) {
    return "public-link-popover";
  }

  return null;
};

export const EmbedMenu = ({
  resource_uuid,
  onModalOpen,
  onModalClose,
}: {
  resource_uuid?: string | null;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}) => {
  const isPublicSharingEnabled = useSelector(state =>
    getSetting(state, "enable-public-sharing"),
  );
  const isAdmin = useSelector(getUserIsAdmin);

  const hasPublicLink = !!resource_uuid;

  const initialMenuMode: EmbedMenuModes = getEmbedMenuMode({
    isAdmin,
    isPublicSharingEnabled,
    hasPublicLink,
  });
  const [isOpen, setIsOpen] = useState(true);
  const [menuMode, setMenuMode] = useState(initialMenuMode);

  // console.log(menuMode)

  const onMenuSelect = (menuMode?: EmbedMenuModes) => {
    setIsOpen(true);
    if (menuMode) {
      setMenuMode(menuMode);
    }
  };

  const onClose = () => {
    setIsOpen(false);
    setMenuMode(initialMenuMode);
  };

  const targetButton = ({
    onClick = undefined,
  }: { onClick?: () => void } = {}) => {
    return (
      <DashboardEmbedHeaderButton
        onClick={() => {
          onClick?.();
        }}
      />
    );
  };

  const renderEmbedMenu = () => (
    <DashboardEmbedHeaderMenu
      hasPublicLink={hasPublicLink}
      /* TODO: Change to `onMenuSelect("public-link-popover")}` when public link popover is implemented */
      openPublicLinkPopover={() => onMenuSelect("public-link-popover")}
      openEmbedModal={() => {
        onModalOpen && onModalOpen();
        setIsOpen(false);
        setMenuMode(initialMenuMode);
      }}
      target={<div>{targetButton()}</div>}
    />
  );

  const renderPublicLinkPopover = () => {
    return (
      <PublicLinkPopover
        isOpen={isOpen}
        onClose={onClose}
        target={targetButton({
          onClick: isOpen ? onClose : () => setIsOpen(true),
        })}
        resource_uuid={resource_uuid}
      />
    );
  };

  const renderEmbedModalTrigger = () =>
    targetButton({
      onClick: () => {
        onModalOpen?.();
        setIsOpen(false);
      },
    });

  const getEmbedContent = (menuMode: EmbedMenuModes) => {
    // if (menuMode === "embed-menu") {
    //   return renderEmbedMenu();
    // } else if (menuMode === "embed-modal") {
    //   return renderEmbedModalTrigger();
    // } else if (menuMode === "public-link-popover") {
    //   return renderPublicLinkPopover();
    // }
    //
    // return null;
    return renderPublicLinkPopover();
  };

  return getEmbedContent(menuMode);
};
