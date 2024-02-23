import { t } from "ttag";

import { PLUGIN_MODERATION } from "metabase/plugins";
import { hasPremiumFeature } from "metabase-enterprise/settings";

import ModerationReviewBanner from "./components/ModerationReviewBanner";
import { ModerationStatusIcon } from "./components/ModerationStatusIcon";
import QuestionModerationButton from "./components/QuestionModerationButton";
import QuestionModerationIcon from "./components/QuestionModerationIcon";
import QuestionModerationSection from "./components/QuestionModerationSection";
import {
  MODERATION_STATUS,
  getStatusIcon,
  getModerationTimelineEvents,
  verifyItem,
  removeReview,
  isItemVerified,
  getLatestModerationReview,
} from "./service";

if (hasPremiumFeature("content_verification")) {
  Object.assign(PLUGIN_MODERATION, {
    isEnabled: () => true,
    QuestionModerationIcon,
    QuestionModerationSection,
    QuestionModerationButton,
    ModerationReviewBanner,
    ModerationStatusIcon,
    getStatusIcon,
    getModerationTimelineEvents,
    getMenuItems: (model, isModerator, reload) => {
      const id = model.id();
      const isDataset = model.isDataset();
      const { name: verifiedIconName } = getStatusIcon(
        MODERATION_STATUS.verified,
      );
      const latestModerationReview = getLatestModerationReview(
        model.getModerationReviews(),
      );
      const isVerified = isItemVerified(latestModerationReview);

      if (isModerator) {
        return [
          {
            title: isVerified
              ? t`Remove verification`
              : isDataset
              ? t`Verify this model`
              : t`Verify this question`,
            icon: isVerified ? "close" : verifiedIconName,
            action: async () => {
              if (isVerified) {
                await removeReview({ itemId: id, itemType: "card" });
              } else {
                await verifyItem({ itemId: id, itemType: "card" });
              }
              reload();
            },
            testId: isVerified
              ? "moderation-remove-verification-action"
              : "moderation-verify-action",
          },
        ];
      }

      return [];
    },
  });
}
