import React from "react";
import { t, jt } from "ttag";

import { duration } from "metabase/lib/formatting";

import {
  Root,
  ShortMessage,
  Duration,
  SlowQueryMessageContainer,
  StyledLoadingSpinner,
} from "./LoadingView.styled";

interface Props {
  isSlow: "usually-slow" | boolean;
  expectedDuration: number;
}

function SlowQueryView({ expectedDuration, isSlow }: Props) {
  return (
    <SlowQueryMessageContainer>
      <ShortMessage>{t`Still Waiting…`}</ShortMessage>
      {isSlow === "usually-slow" ? (
        <div>
          {jt`This usually takes an average of ${(
            <Duration>{duration(expectedDuration)}</Duration>
          )}.`}
          <br />
          {t`(This is a bit long for a dashboard)`}
        </div>
      ) : (
        <div>
          {t`This is usually pretty fast but seems to be taking a while right now.`}
        </div>
      )}
    </SlowQueryMessageContainer>
  );
}

function LoadingView({ expectedDuration, isSlow }: Props) {
  return (
    <Root>
      {isSlow ? (
        <SlowQueryView expectedDuration={expectedDuration} isSlow={isSlow} />
      ) : (
        <StyledLoadingSpinner />
      )}
    </Root>
  );
}

export default LoadingView;
