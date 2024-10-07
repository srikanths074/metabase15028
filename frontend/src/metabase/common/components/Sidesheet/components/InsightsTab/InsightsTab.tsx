import { t } from "ttag";

import { UpsellWrapper } from "metabase/admin/upsells/components/UpsellWrapper";
import type { LinkProps } from "metabase/core/components/Link";
import { Tabs } from "metabase/ui";
import type Question from "metabase-lib/v1/Question";
import type { Dashboard } from "metabase-types/api";

export type InsightsTabOrLinkProps = (
  | {
      question: Pick<Question, "id" | "collection">;
      dashboard?: never;
    }
  | {
      question?: never;
      dashboard: Pick<Dashboard, "id" | "collection">;
    }
) &
  Omit<LinkProps, "to">;

/** This tab just shows the Insights upsell */
const _InsightsTab = (_: InsightsTabOrLinkProps) => {
  return <Tabs.Tab value="insights">{t`Insights`}</Tabs.Tab>;
};

export const InsightsTab = UpsellWrapper(_InsightsTab);
