import React from "react";
import useIsSmallScreen from "metabase/hooks/use-is-small-screen";
import { CollectionId, User } from "metabase-types/api";
import AppBarSmall from "./AppBarSmall";
import AppBarLarge from "./AppBarLarge";
import { AppBarRoot } from "./AppBar.styled";

export interface AppBarProps {
  currentUser: User;
  collectionId?: CollectionId;
  isNavBarOpen?: boolean;
  isNavBarEnabled?: boolean;
  isLogoVisible?: boolean;
  isSearchVisible?: boolean;
  isNewButtonVisible?: boolean;
  isProfileLinkVisible?: boolean;
  isCollectionPathVisible?: boolean;
  isQuestionLineageVisible?: boolean;
  isVisible: boolean;
  onToggleNavbar: () => void;
  onCloseNavbar: () => void;
  onLogout: () => void;
}

const AppBar = (props: AppBarProps): React.ReactNode => {
  const isSmallScreen = useIsSmallScreen();

  if (!props.currentUser) {
    return null;
  }

  return (
    <AppBarRoot data-testid="app-bar" isVisible={props.isVisible}>
      {isSmallScreen ? <AppBarSmall {...props} /> : <AppBarLarge {...props} />}
    </AppBarRoot>
  );
};

export default AppBar;
