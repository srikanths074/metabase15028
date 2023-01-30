import React from "react";
import { t } from "ttag";

import Tab from "metabase/core/components/Tab";
import TabContent from "metabase/core/components/TabContent";

import * as Urls from "metabase/lib/urls";

import type { Collection } from "metabase-types/api";
import type Question from "metabase-lib/Question";
import type Table from "metabase-lib/metadata/Table";

import ModelActionDetails from "./ModelActionDetails";
import ModelDetailHeader from "./ModelDetailHeader";
import ModelInfoSidePanel from "./ModelInfoSidePanel";
import ModelSchemaDetails from "./ModelSchemaDetails";
import ModelUsageDetails from "./ModelUsageDetails";
import {
  RootLayout,
  ModelMain,
  TabList,
  TabPanel,
  TabPanelContent,
} from "./ModelDetailPage.styled";

interface Props {
  model: Question;
  mainTable?: Table | null;
  tab: string;
  hasActionsTab: boolean;
  onChangeName: (name?: string) => void;
  onChangeDescription: (description?: string | null) => void;
  onChangeCollection: (collection: Collection) => void;
}

function ModelDetailPage({
  model,
  tab,
  mainTable,
  hasActionsTab,
  onChangeName,
  onChangeDescription,
  onChangeCollection,
}: Props) {
  const modelCard = model.card();

  return (
    <RootLayout>
      <ModelMain>
        <ModelDetailHeader
          model={model}
          onChangeName={onChangeName}
          onChangeCollection={onChangeCollection}
        />
        <TabContent value={tab}>
          <TabList>
            <Tab.Link
              value="usage"
              to={Urls.modelDetail(modelCard, "usage")}
            >{t`Used by`}</Tab.Link>
            <Tab.Link
              value="schema"
              to={Urls.modelDetail(modelCard, "schema")}
            >{t`Schema`}</Tab.Link>
            {hasActionsTab && (
              <Tab.Link
                value="actions"
                to={Urls.modelDetail(modelCard, "actions")}
              >{t`Actions`}</Tab.Link>
            )}
          </TabList>
          <TabPanel value="usage">
            <TabPanelContent>
              <ModelUsageDetails model={model} />
            </TabPanelContent>
          </TabPanel>
          <TabPanel value="schema">
            <TabPanelContent>
              <ModelSchemaDetails model={model} />
            </TabPanelContent>
          </TabPanel>
          {hasActionsTab && (
            <TabPanel value="actions">
              <TabPanelContent>
                <ModelActionDetails model={model} />
              </TabPanelContent>
            </TabPanel>
          )}
        </TabContent>
      </ModelMain>
      <ModelInfoSidePanel
        model={model}
        mainTable={mainTable}
        onChangeDescription={onChangeDescription}
      />
    </RootLayout>
  );
}

export default ModelDetailPage;
