import React, { useMemo, useState } from "react";
import { connect } from "react-redux";
import _ from "underscore";
import { checkNotNull } from "metabase/core/utils/types";
import ExplicitSize from "metabase/components/ExplicitSize";
import NativeQueryEditor from "metabase/query_builder/components/NativeQueryEditor";
import { State } from "metabase-types/store";
import Question from "metabase-lib/Question";
import NativeQuery from "metabase-lib/queries/NativeQuery";
import { cancelQuery, runQuestionQuery, updateQuestion } from "../../actions";
import { getQuestion } from "../../selectors";

interface OwnProps {
  height: number;
}

interface StateProps {
  question: Question;
}

interface DispatchProps {
  onRunQuery: () => void;
  onCancelQuery: () => void;
  onChangeQuery: (question: Question) => void;
}

type MetabotQueryEditorProps = OwnProps & StateProps & DispatchProps;

const mapStateToProps = (state: State): StateProps => ({
  question: checkNotNull(getQuestion(state)),
});

const mapDispatchToProps: DispatchProps = {
  onRunQuery: runQuestionQuery,
  onChangeQuery: updateQuestion,
  onCancelQuery: cancelQuery,
};

const MetabotQueryEditor = ({
  question,
  height,
  onRunQuery,
  onCancelQuery,
  onChangeQuery,
}: MetabotQueryEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleChange = (query: NativeQuery) => onChangeQuery(query.question());

  const sidebarFeatures = useMemo(
    () => ({
      dataReference: false,
      variables: false,
      snippets: false,
    }),
    [],
  );

  return (
    <NativeQueryEditor
      question={question}
      query={question.query()}
      viewHeight={height}
      resizable={false}
      hasParametersList={false}
      canChangeDatabase={false}
      isRunnable={true}
      isInitiallyOpen={false}
      isNativeEditorOpen={isOpen}
      runQuestionQuery={onRunQuery}
      cancelQuery={onCancelQuery}
      setDatasetQuery={handleChange}
      setIsNativeEditorOpen={setIsOpen}
      sidebarFeatures={sidebarFeatures}
    />
  );
};

export default _.compose(
  ExplicitSize(),
  connect(mapStateToProps, mapDispatchToProps),
)(MetabotQueryEditor);
