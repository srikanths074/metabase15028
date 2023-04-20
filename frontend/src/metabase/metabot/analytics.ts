import { MetabotFeedbackType } from "metabase-types/api";
import { MetabotEntityType } from "metabase-types/store";
import { trackSchemaEvent } from "metabase/lib/analytics";

export type MetabotQueryRunResult = "success" | "failure" | "bad-sql";

const SCEMA_NAME = "metabot";
const TEMPLATE_VERSION = "1-0-1";

export const trackMetabotPageView = (entity_type: MetabotEntityType) => {
  trackSchemaEvent(SCEMA_NAME, TEMPLATE_VERSION, {
    event: "metabot_page_view",
    entity_type,
  });
};

export const trackMetabotQueryRun = (
  entity_type: MetabotEntityType | null,
  prompt_template_versions: string[] | null,
  result: MetabotQueryRunResult,
  visualization_type: string | null,
) => {
  trackSchemaEvent(SCEMA_NAME, TEMPLATE_VERSION, {
    event: "metabot_query_run",
    entity_type,
    prompt_template_versions,
    result,
    visualization_type,
  });
};

export const trackMetabotFeedbackReceived = (
  entity_type: MetabotEntityType | null,
  prompt_template_versions: string[] | null,
  feedback_type: MetabotFeedbackType | null,
) => {
  trackSchemaEvent(SCEMA_NAME, TEMPLATE_VERSION, {
    event: "metabot_feedback_received",
    entity_type,
    prompt_template_versions,
    feedback_type,
  });
};
