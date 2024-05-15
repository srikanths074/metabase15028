import { useEffect, useMemo, useState } from "react";
import type { InjectedRouter, Route } from "react-router";
import { withRouter } from "react-router";
import { t } from "ttag";
import { findWhere } from "underscore";

import { useListDatabasesQuery } from "metabase/api";
import { DelayedLoadingAndErrorWrapper } from "metabase/components/LoadingAndErrorWrapper/DelayedLoadingAndErrorWrapper";
import { PLUGIN_CACHING } from "metabase/plugins";
import { Box, Stack } from "metabase/ui";
import type { CacheableModel } from "metabase-types/api";
import { DurationUnit } from "metabase-types/api";

import { useCacheConfigs } from "../hooks/useCacheConfigs";
import { useConfirmIfFormIsDirty } from "../hooks/useConfirmIfFormIsDirty";
import { useSaveStrategy } from "../hooks/useSaveStrategy";
import { useVerticallyOverflows } from "../hooks/useVerticallyOverflows";
import type { UpdateTargetId } from "../strategies";
import { rootId } from "../strategies";

import { Panel, TabWrapper } from "./StrategyEditorForDatabases.styled";
import { StrategyForm } from "./StrategyForm";

const StrategyEditorForDatabases_Base = ({
  router,
  route,
}: {
  router: InjectedRouter;
  route?: Route;
}) => {
  const { canOverrideRootStrategy } = PLUGIN_CACHING;

  const [
    // The targetId is the id of the model that is currently being edited
    targetId,
    setTargetId,
  ] = useState<number | null>(null);

  const configurableModels: CacheableModel[] = useMemo(() => {
    const ret: CacheableModel[] = ["root"];
    if (canOverrideRootStrategy) {
      ret.push("database");
    }
    return ret;
  }, [canOverrideRootStrategy]);

  const {
    configs,
    setConfigs,
    rootStrategyOverriddenOnce,
    rootStrategyRecentlyOverridden,
    error: configsError,
    loading: areConfigsLoading,
  } = useCacheConfigs({ configurableModels });

  const databasesResult = useListDatabasesQuery();
  const databases = databasesResult.data?.data ?? [];

  const shouldShowResetButton =
    rootStrategyOverriddenOnce || rootStrategyRecentlyOverridden;

  /** The config for the model currently being edited */
  const targetConfig = findWhere(configs, {
    model_id: targetId ?? undefined,
  });
  const savedStrategy = targetConfig?.strategy;

  if (savedStrategy?.type === "duration") {
    savedStrategy.unit = DurationUnit.Hours;
  }

  const {
    askBeforeDiscardingChanges,
    confirmationModal,
    isStrategyFormDirty,
    setIsStrategyFormDirty,
  } = useConfirmIfFormIsDirty(router, route);

  /** Update the targetId (the id of the currently edited model) but confirm if the form is unsaved */
  const updateTargetId: UpdateTargetId = (newTargetId, isFormDirty) => {
    if (targetId !== newTargetId) {
      const update = () => setTargetId(newTargetId);
      isFormDirty ? askBeforeDiscardingChanges(update) : update();
    }
  };

  useEffect(() => {
    if (!canOverrideRootStrategy && targetId === null) {
      setTargetId(rootId);
    }
  }, [canOverrideRootStrategy, targetId]);

  const targetDatabase = databases.find(db => db.id === targetId);

  const {
    verticallyOverflows: formPanelVerticallyOverflows,
    ref: formPanelRef,
  } = useVerticallyOverflows();

  const shouldAllowInvalidation = useMemo(() => {
    if (
      targetId === null ||
      targetId === rootId ||
      savedStrategy?.type === "nocache"
    ) {
      return false;
    }
    const inheritingRootStrategy = ["inherit", undefined].includes(
      savedStrategy?.type,
    );
    const rootConfig = findWhere(configs, { model_id: rootId });
    const inheritingDoNotCache =
      inheritingRootStrategy && !rootConfig?.strategy;
    return !inheritingDoNotCache;
  }, [configs, savedStrategy?.type, targetId]);

  const saveStrategy = useSaveStrategy(
    targetId,
    configs,
    setConfigs,
    "database",
  );

  const error = configsError || databasesResult.error;
  const loading = areConfigsLoading || databasesResult.isLoading;
  if (error || loading) {
    return <DelayedLoadingAndErrorWrapper error={error} loading={loading} />;
  }

  return (
    <TabWrapper role="region" aria-label={t`Data caching settings`}>
      <Stack spacing="xl" lh="1.5rem" maw="32rem" mb="1.5rem">
        <aside>
          <Stack spacing="xl">
            {t`Cache the results of queries to have them display instantly. Here you can choose when cached results should be invalidated.`}
            <PLUGIN_CACHING.GranularControlsExplanation />
          </Stack>
        </aside>
      </Stack>
      {confirmationModal}
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(5rem, 30rem) minmax(5rem, auto)",
          overflow: "hidden",
        }}
        w="100%"
        mx="0"
        mb="1rem"
      >
        {canOverrideRootStrategy && (
          <PLUGIN_CACHING.StrategyFormLauncherPanel
            configs={configs}
            setConfigs={setConfigs}
            targetId={targetId}
            updateTargetId={updateTargetId}
            databases={databases}
            isStrategyFormDirty={isStrategyFormDirty}
            shouldShowResetButton={shouldShowResetButton}
          />
        )}
        <Panel
          ref={formPanelRef}
          verticallyOverflows={formPanelVerticallyOverflows}
        >
          {targetId !== null && (
            <StrategyForm
              targetId={targetId}
              targetModel="database"
              targetName={targetDatabase?.name || t`Untitled database`}
              setIsDirty={setIsStrategyFormDirty}
              saveStrategy={saveStrategy}
              savedStrategy={savedStrategy}
              shouldAllowInvalidation={shouldAllowInvalidation}
              formStyle={{ overflow: "auto" }}
              shouldShowName={targetId !== rootId}
            />
          )}
        </Panel>
      </Box>
    </TabWrapper>
  );
};

export const StrategyEditorForDatabases = withRouter(
  StrategyEditorForDatabases_Base,
);
