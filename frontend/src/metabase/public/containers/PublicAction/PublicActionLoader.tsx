import { useCallback, useState } from "react";
import { connect } from "react-redux";
import { useMount } from "react-use";

import { useSafeAsyncFunction } from "metabase/hooks/use-safe-async-function";
import { SyncedEmbedFrame } from "metabase/public/components/EmbedFrame";
import { setErrorPage } from "metabase/redux/app";
import { PublicApi } from "metabase/services";
import type { WritebackAction } from "metabase-types/api";
import type { AppErrorDescriptor } from "metabase-types/store";

import PublicAction from "./PublicAction";
import { ContentContainer, Loading } from "./PublicAction.styled";

interface OwnProps {
  params: { uuid: string };
}

interface DispatchProps {
  setErrorPage: (error: AppErrorDescriptor) => void;
}

type Props = OwnProps & DispatchProps;

const mapDispatchToProps = {
  setErrorPage,
};

function PublicActionLoader({ params, setErrorPage }: Props) {
  const [action, setAction] = useState<WritebackAction | null>(null);
  const fetchAction = useSafeAsyncFunction(PublicApi.action);

  useMount(() => {
    async function loadAction() {
      try {
        const action = await fetchAction({ uuid: params.uuid });
        setAction(action);
      } catch (error) {
        setErrorPage(error as AppErrorDescriptor);
      }
    }
    loadAction();
  });

  const renderContent = useCallback(() => {
    if (!action) {
      return null;
    }
    return (
      <ContentContainer>
        <PublicAction
          action={action}
          publicId={params.uuid}
          onError={setErrorPage}
        />
      </ContentContainer>
    );
  }, [action, params.uuid, setErrorPage]);

  return (
    <SyncedEmbedFrame footerVariant="large">
      <Loading loading={!action}>{renderContent}</Loading>
    </SyncedEmbedFrame>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default connect(null, mapDispatchToProps)(PublicActionLoader);
