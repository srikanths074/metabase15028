import { b64url_to_utf8 } from "metabase/lib/encoding";
import { CardApi, CollectionsApi, DashboardApi } from "metabase/services";

import type { ReportableEntityName, ErrorPayload } from "./types";

export function downloadObjectAsJson(
  exportObj: ErrorPayload,
  exportName: string,
) {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportObj, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export const getEntityDetails = ({ entity, id }: any) => {
  const isAdHoc = entity === "question" && window.location.href.includes("#");
  if (!id) {
    return Promise.resolve(null);
  }

  switch (entity) {
    case "question":
    case "model":
      if (isAdHoc) {
        try {
          const adhocQuestion = JSON.parse(b64url_to_utf8(id));
          return Promise.resolve(adhocQuestion);
        } catch (e) {
          return Promise.resolve("unable to decode ad-hoc question");
        }
      }
      return CardApi.get({ cardId: id });
    case "dashboard":
      return DashboardApi.get({ id });
    case "collection":
      return CollectionsApi.get({ id });
    default:
      return Promise.resolve(null);
  }
};

export const hasQueryData = (
  entityName?: ReportableEntityName | null,
): boolean => !!entityName && ["question", "model"].includes(entityName);
