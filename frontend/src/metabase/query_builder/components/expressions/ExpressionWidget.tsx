import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { t } from "ttag";
import { isNotNull } from "metabase/lib/types";
import Button from "metabase/core/components/Button";
import Input from "metabase/core/components/Input/Input";
import Tooltip from "metabase/core/components/Tooltip";
import MetabaseSettings from "metabase/lib/settings";
import type { Expression } from "metabase-types/api";
import type * as Lib from "metabase-lib";
import { useSelector } from "metabase/lib/redux";
import { getShowMetabaseLinks } from "metabase/selectors/whitelabel";
import { Box } from "metabase/ui";
import { isExpression } from "metabase-lib/expressions";

import { ExpressionEditorTextfield } from "./ExpressionEditorTextfield";
import {
  ActionButtonsWrapper,
  Container,
  ExpressionFieldWrapper,
  FieldLabel,
  FieldWrapper,
  Footer,
  InfoLink,
  RemoveLink,
  StyledFieldTitleIcon,
} from "./ExpressionWidget.styled";

const EXPRESSIONS_DOCUMENTATION_URL = MetabaseSettings.docsUrl(
  "questions/query-builder/expressions",
);

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

  const helpTextTargetRef = useRef(null);

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

  const showMetabaseLinks = useSelector(getShowMetabaseLinks);

  return (
    <Container>
      {header}
      <ExpressionFieldWrapper>
        <FieldLabel htmlFor="expression-content">
          {t`Expression`}
          {showMetabaseLinks ? (
            <Tooltip
              tooltip={t`You can reference columns here in functions or equations, like: floor([Price] - [Discount]). Click for documentation.`}
              placement="right"
              maxWidth={332}
            >
              <InfoLink
                target="_blank"
                href={EXPRESSIONS_DOCUMENTATION_URL}
                aria-label={t`Open expressions documentation`}
              >
                <StyledFieldTitleIcon name="info" />
              </InfoLink>
            </Tooltip>
          ) : (
            <Tooltip
              tooltip={t`You can reference columns here in functions or equations, like: floor([Price] - [Discount]).`}
              placement="right"
              maxWidth={332}
            >
              <Box ml="0.25rem">
                <StyledFieldTitleIcon name="info" />
              </Box>
            </Tooltip>
          )}
        </FieldLabel>
        <div ref={helpTextTargetRef}>
          <ExpressionEditorTextfield
            helpTextTarget={helpTextTargetRef.current}
            expression={expression}
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
        </div>
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
          {onClose && <Button onClick={onClose}>{t`Cancel`}</Button>}
          <Button
            primary={isValid}
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
