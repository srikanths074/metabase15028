import { jt } from "ttag";

import { coerceCollectionId } from "metabase/collections/utils";

import type { CollectionId } from "metabase-types/api";
import type Question from "metabase-lib/Question";

import {
  CollectionLink,
  StyledIcon,
  ToastRoot,
} from "./QuestionMoveToast.styled";

interface QuestionMoveToastProps {
  question: Question;
  collectionId: CollectionId;
}

const getMessage = (question: Question, collectionLink: JSX.Element) => {
  const type = question.type() ?? "question";

  if (type === "question") {
    return jt`Question moved to ${collectionLink}`;
  }

  if (type === "model") {
    return jt`Model moved to ${collectionLink}`;
  }

  if (type === "metric") {
    return jt`Metric moved to ${collectionLink}`;
  }

  throw new Error(`Unknown question.type(): ${type}`);
};

function QuestionMoveToast({ question, collectionId }: QuestionMoveToastProps) {
  const id = coerceCollectionId(collectionId);
  const collectionLink = <CollectionLink key="collection-link" id={id} />;
  return (
    <ToastRoot>
      <StyledIcon name="collection" />
      {getMessage(question, collectionLink)}
    </ToastRoot>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default QuestionMoveToast;
