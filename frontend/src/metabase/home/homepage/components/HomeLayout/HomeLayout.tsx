import React, { ReactNode } from "react";
import {
  LayoutBody,
  LayoutRoot,
  LayoutScene,
  LayoutSceneImage,
} from "./HomeLayout.styled";

export interface HomeLayoutProps {
  showScene?: boolean;
  children?: ReactNode;
}

const HomeLayout = ({ showScene, children }: HomeLayoutProps): JSX.Element => {
  return (
    <LayoutRoot>
      {showScene && (
        <LayoutScene>
          <LayoutSceneImage
            src="app/img/bridge.png"
            srcSet="app/img/bridge.png 1x, app/img/bridge@2x.png 2x, app/img/bridge@3x.png 3x"
          />
        </LayoutScene>
      )}
      <LayoutBody>{children}</LayoutBody>
    </LayoutRoot>
  );
};

export default HomeLayout;
