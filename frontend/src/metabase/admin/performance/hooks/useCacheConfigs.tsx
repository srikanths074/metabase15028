import { useEffect, useState } from "react";
import { useAsync } from "react-use";

import { useDatabaseListQuery } from "metabase/common/hooks";
import { CacheConfigApi } from "metabase/services";

import { rootId } from "../constants";
import type { CacheConfigAPIResponse, Config } from "../types";

import { useRecentlyTrue } from "./useRecentlyTrue";

export const useCacheConfigs = ({
  canOverrideRootStrategy,
}: {
  canOverrideRootStrategy: boolean;
}) => {
  const databasesResult = useDatabaseListQuery();
  const databases = databasesResult.data ?? [];

  const configsResult = useAsync(async () => {
    const rootConfigsFromAPI = (
      (await CacheConfigApi.list({ model: "root" })) as CacheConfigAPIResponse
    ).data;
    const rootConfig = rootConfigsFromAPI[0] ?? {
      model: "root",
      model_id: rootId,
      strategy: { type: "nocache" },
    };
    const dbConfigsFromAPI = canOverrideRootStrategy
      ? (
          (await CacheConfigApi.list({
            model: "database",
          })) as CacheConfigAPIResponse
        ).data
      : [];
    const configs = [rootConfig, ...dbConfigsFromAPI];
    return configs;
  }, []);

  const configsFromAPI = configsResult.value;

  const [configs, setConfigs] = useState<Config[]>([]);

  useEffect(() => {
    if (configsFromAPI) {
      setConfigs(configsFromAPI);
    }
  }, [configsFromAPI]);

  const rootStrategyOverriddenOnce = configs.some(
    config => config.model_id !== rootId,
  );

  const [rootStrategyRecentlyOverridden] = useRecentlyTrue(
    rootStrategyOverriddenOnce,
    3000,
  );

  const error = databasesResult.error || configsResult.error;
  const loading = databasesResult.isLoading || configsResult.loading;

  return {
    databases,
    error,
    loading,
    configs,
    setConfigs,
    configsFromAPI,
    rootStrategyOverriddenOnce,
    rootStrategyRecentlyOverridden,
  };
};
