import type { ReactNode } from "react";
import { useState } from "react";
import { t } from "ttag";

import Input from "metabase/core/components/Input/Input";
import { isNotNull } from "metabase/lib/types";
import { Button } from "metabase/ui";
import type * as Lib from "metabase-lib";
import { isExpression } from "metabase-lib/v1/expressions";
import type { Expression } from "metabase-types/api";

import { CombineColumns } from "./CombineColumns/CombineColumns";
import { ExpressionEditorTextfield } from "./ExpressionEditorTextfield";
import {
  ActionButtonsWrapper,
  Container,
  ExpressionFieldWrapper,
  FieldLabel,
  FieldWrapper,
  Footer,
  RemoveLink,
} from "./ExpressionWidget.styled";
import { ExpressionWidgetInfo } from "./ExpressionWidgetInfo";

export type ExpressionWidgetProps<Clause = Lib.ExpressionClause> = {
  query: Lib.Query;
  stageIndex: number;
  /**
   * expression should not be present in components migrated to MLv2
   */
  expression?: Expression | undefined;
  /**
   * Presence of this prop is not enforced due to backwards-compatibility
   * with ExpressionWidget usages outside of GUI editor.
   */
  clause?: Clause | undefined;
  name?: string;
  withName?: boolean;
  startRule?: string;
  reportTimezone?: string;
  header?: ReactNode;
  expressionPosition?: number;

  onChangeExpression?: (name: string, expression: Expression) => void;
  onChangeClause?: (
    name: string,
    clause: Clause | Lib.ExpressionClause,
  ) => void;
  onRemoveExpression?: (name: string) => void;
  onClose?: () => void;
};

export const ExpressionWidget = <Clause extends object = Lib.ExpressionClause>(
  props: ExpressionWidgetProps<Clause>,
): JSX.Element => {
  const {
    query,
    stageIndex,
    name: initialName,
    expression: initialExpression,
    clause: initialClause,
    withName = false,
    startRule,
    reportTimezone,
    header,
    expressionPosition,
    onChangeExpression,
    onChangeClause,
    onRemoveExpression,
    onClose,
  } = props;

  const [name, setName] = useState(initialName || "");
  const [expression, setExpression] = useState<Expression | null>(
    initialExpression ?? null,
  );
  const [clause, setClause] = useState<Clause | Lib.ExpressionClause | null>(
    initialClause ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCombiningColumns, setIsCombiningColumns] = useState(false);

  const isValidName = withName ? name.trim().length > 0 : true;
  const isValidExpression = isNotNull(expression) && isExpression(expression);
  const isValidExpressionClause = isNotNull(clause);
  const isValid =
    !error && isValidName && (isValidExpression || isValidExpressionClause);

  const handleCommit = (
    expression: Expression | null,
    clause: Clause | Lib.ExpressionClause | null,
  ) => {
    const isValidExpression = isNotNull(expression) && isExpression(expression);
    const isValidExpressionClause = isNotNull(clause);
    const isValid =
      !error && isValidName && (isValidExpression || isValidExpressionClause);

    if (!isValid) {
      return;
    }

    if (isValidExpression) {
      onChangeExpression?.(name, expression);
      onClose?.();
    }

    if (isValidExpressionClause) {
      onChangeClause?.(name, clause);
      onClose?.();
    }
  };

  const handleExpressionChange = (
    expression: Expression | null,
    clause: Lib.ExpressionClause | null,
  ) => {
    setExpression(expression);
    setClause(clause);
    setError(null);
  };

  if (isCombiningColumns) {
    const handleSubmit = (name: string, clause: Lib.ExpressionClause) => {
      setIsCombiningColumns(false);
      setClause(clause);
      setName(name);
      setError(null);
    };

    const handleCancel = () => {
      setIsCombiningColumns(false);
    };

    return (
      <CombineColumns
        query={query}
        stageIndex={stageIndex}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <Container data-testid="expression-editor">
      {header}
      <ExpressionFieldWrapper>
        <FieldLabel htmlFor="expression-content">
          {t`Expression`}
          <ExpressionWidgetInfo />
        </FieldLabel>
        <ExpressionEditorTextfield
          expression={expression}
          expressionPosition={expressionPosition}
          clause={clause}
          startRule={startRule}
          name={name}
          query={query}
          stageIndex={stageIndex}
          reportTimezone={reportTimezone}
          textAreaId="expression-content"
          onChange={handleExpressionChange}
          onCommit={handleCommit}
          onError={(errorMessage: string) => setError(errorMessage)}
        />
      </ExpressionFieldWrapper>
      {withName && (
        <FieldWrapper>
          <FieldLabel htmlFor="expression-name">{t`Name`}</FieldLabel>
          <Input
            id="expression-name"
            type="text"
            value={name}
            placeholder={t`Something nice and descriptive`}
            fullWidth
            onChange={event => setName(event.target.value)}
            onKeyPress={e => {
              if (e.key === "Enter") {
                handleCommit(expression, clause);
              }
            }}
          />
        </FieldWrapper>
      )}

      <Footer>
        <ActionButtonsWrapper>
          <Button onClick={() => setIsCombiningColumns(true)}>
            Combine {/* TODO: use the dropdown suggestions for this */}
          </Button>
          {onClose && <Button onClick={onClose}>{t`Cancel`}</Button>}
          <Button
            variant={isValid ? "filled" : "default"}
            disabled={!isValid}
            onClick={() => handleCommit(expression, clause)}
          >
            {initialName ? t`Update` : t`Done`}
          </Button>

          {initialName && onRemoveExpression ? (
            <RemoveLink
              onlyText
              onClick={() => {
                onRemoveExpression(initialName);
                onClose && onClose();
              }}
            >{t`Remove`}</RemoveLink>
          ) : null}
        </ActionButtonsWrapper>
      </Footer>
    </Container>
  );
};
