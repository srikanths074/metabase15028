import type Database from "metabase-lib/metadata/Database";
import { Radio, Text } from "metabase/ui";
import { useState } from "react";
import { t } from "ttag";
import {
  isValidCacheStrategy,
  type CacheConfig,
  CacheStrategies,
} from "../types";
import {
  ClearOverridesButton,
  ClearSpecialRuleButton,
  ConfigPanel,
  ConfigPanelSection,
  DatabaseRuleIcon,
  Explanation,
  GeneralRuleButton,
  GeneralRuleValue,
  RuleEditor,
  RuleEditorPanel,
  SpecialRule,
  SpecialRuleValue,
  TabWrapper,
} from "./Data.styled";

export const Data = ({
  databases,
  databaseConfigurations,
  setDatabaseConfiguration,
  clearOverrides,
}: {
  databases: Database[];
  databaseConfigurations: Map<number, CacheConfig>;
  setDatabaseConfiguration: (
    databaseId: number,
    config: CacheConfig | null,
  ) => void;
  clearOverrides: () => void;
}) => {
  // Note that an id of zero is a special case that means that we're setting the general rule for all databases
  const [idOfDatabaseBeingConfigured, setIdOfDatabaseBeingConfigured] =
    useState<number | null>(null);
  const currentConfig =
    idOfDatabaseBeingConfigured !== null
      ? databaseConfigurations.get(idOfDatabaseBeingConfigured)
      : null;

  databases = [...databases, ...databases];
  databases = [...databases, ...databases, ...databases];
  databases = [...databases, ...databases, ...databases];

  const generalStrategy = databaseConfigurations.get(0)?.strategy;
  const generalStrategyLabel = generalStrategy
    ? CacheStrategies[generalStrategy]
    : null;

  return (
    <TabWrapper role="region" aria-label="Data caching settings">
      <Explanation>
        {t`Cache the results of queries to have them display instantly. Here you can choose when cached results should be invalidated. You can set up one rule for all your databases, or apply more specific settings to each database.`}
      </Explanation>
      <RuleEditor role="form">
        <RuleEditorPanel role="group">
          <GeneralRuleButton>
            <DatabaseRuleIcon name="database" />
            {t`Databases`}
            <GeneralRuleValue onClick={() => setIdOfDatabaseBeingConfigured(0)}>
              {generalStrategyLabel}
            </GeneralRuleValue>
          </GeneralRuleButton>
        </RuleEditorPanel>
        <RuleEditorPanel role="group">
          {databases.map(({ id, name }) => {
            const specificStrategy = databaseConfigurations.get(id);
            console.log("specificStrategy", specificStrategy);
            const strategy = (specificStrategy ?? databaseConfigurations.get(0))
              ?.strategy;
            if (!strategy) throw new Error("Invalid strategy");
            const strategyLabel = CacheStrategies[strategy];
            if (!strategyLabel)
              throw new Error("Could not find label for strategy " + strategy);
            return (
              <SpecialRule key={id}>
                <DatabaseRuleIcon name="database" />
                {name}
                <SpecialRuleValue
                  // TODO: use variant={specificStrategy ? "filled" : "outline"} if possible
                  isOverride={Boolean(specificStrategy)}
                  onClick={() => {
                    setIdOfDatabaseBeingConfigured(id);
                  }}
                >
                  {strategyLabel}
                  <ClearSpecialRuleButton
                    variant="subtle"
                    onClick={() => {
                      setDatabaseConfiguration(id, null);
                    }}
                  >
                    x
                  </ClearSpecialRuleButton>
                </SpecialRuleValue>
              </SpecialRule>
            );
          })}
          <ClearOverridesButton
            onClick={() => {
              clearOverrides();
            }}
          >{t`Clear all overrides`}</ClearOverridesButton>
        </RuleEditorPanel>
        {idOfDatabaseBeingConfigured !== null && (
          <ConfigPanel role="group">
            <ConfigPanelSection>
              {/* Make the radio button group name specific to the object whose strategy is being modified? */}
              <Radio.Group
                value={currentConfig?.strategy}
                name={`caching-strategy-for-database-${idOfDatabaseBeingConfigured}`}
                onChange={strategy => {
                  if (!isValidCacheStrategy(strategy)) {
                    console.error("invalid strategy", strategy);
                    return;
                  }
                  console.log("currentConfig", currentConfig);
                  console.log(
                    "idOfDatabaseBeingConfigured",
                    idOfDatabaseBeingConfigured,
                  );
                  console.log("strategy", strategy);
                  setDatabaseConfiguration(idOfDatabaseBeingConfigured, {
                    modelType: "database",
                    model_id: idOfDatabaseBeingConfigured,
                    strategy,
                  });
                }}
                label={
                  <Text lh="1rem">{t`When should cached query results be invalidated?`}</Text>
                }
              >
                {/*
                Add later:
                <Radio mt=".75rem" value="query" label={t`When the data updates`} />
                <Radio mt=".75rem" value="schedule" label={t`On a schedule`} />
              */}
                <Radio
                  mt=".75rem"
                  value="ttl"
                  label={t`When the TTL expires`}
                />
                {/*
            <Radio
              mt=".75rem"
              value="duration"
              label={t`On a regular duration`}
            />
            */}
                <Radio mt=".75rem" value="nocache" label={t`Don't cache`} />
              </Radio.Group>
            </ConfigPanelSection>
            {/*
          <StrategyConfig />
              Add later
          <ConfigPanelSection>
            <p>
              {jt`We’ll periodically run ${(
                <code>select max()</code>
              )} on the column selected here to check for new results.`}
            </p>
            <Select data={columns} />
             TODO: I'm not sure this string translates well
          </ConfigPanelSection>
          <ConfigPanelSection>
            <p>{t`Check for new results every...`}</p>
            <Select data={durations} />
          </ConfigPanelSection>
            */}
          </ConfigPanel>
        )}
      </RuleEditor>
    </TabWrapper>
  );
};
