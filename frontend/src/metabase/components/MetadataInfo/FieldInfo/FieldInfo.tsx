import { t } from "ttag";
import type { DatasetColumn } from "metabase-types/api";
import * as Lib from "metabase-lib";
import type Field from "metabase-lib/metadata/Field";
import { Description, EmptyDescription } from "../MetadataInfo.styled";
import {
  InfoContainer,
  SemanticTypeLabel,
  FieldFingerprintInfo,
} from "./FieldInfo.styled";

export type FieldInfoProps = FieldInfoFieldProps | FieldInfoQueryProps;

export function FieldInfo(props: FieldInfoProps) {
  if ("field" in props) {
    return <FieldInfoField {...props} />;
  }

  return <FieldInfoQuery {...props} />;
}

// eslint-disable-next-line import/no-default-export
export default FieldInfo;

type FieldInfoFieldProps = {
  className?: string;
  /**
   * @deprecated prefer to use the MLv2 query props
   */
  field: Field | DatasetColumn;
  timezone?: string;
  showAllFieldValues?: boolean;
  showFingerprintInfo?: boolean;
};

export function FieldInfoField({
  className,
  field,
  timezone,
  showAllFieldValues,
  showFingerprintInfo,
}: FieldInfoFieldProps) {
  return (
    <FieldInfoBase
      className={className}
      description={field.description}
      semanticType={field.semantic_type}
    >
      {showFingerprintInfo && (
        <FieldFingerprintInfo
          field={field}
          timezone={timezone}
          showAllFieldValues={showAllFieldValues}
        />
      )}
    </FieldInfoBase>
  );
}

type FieldInfoQueryProps = {
  className?: string;
  query: Lib.Query;
  stageIndex: number;
  column: Lib.ColumnMetadata;
};

// TODO: support fingerprint info
export function FieldInfoQuery({
  className,
  query,
  stageIndex,
  column,
}: FieldInfoQueryProps) {
  const { description, semanticType } = Lib.displayInfo(
    query,
    stageIndex,
    column,
  );

  return (
    <FieldInfoBase
      className={className}
      description={description}
      semanticType={semanticType}
    />
  );
}

type BaseProps = {
  className?: string;
  description?: string | null;
  semanticType?: string | null;
  children?: React.ReactNode;
};

function FieldInfoBase({
  className,
  description,
  semanticType,
  children,
}: BaseProps) {
  return (
    <InfoContainer className={className}>
      {description ? (
        <Description>{description}</Description>
      ) : (
        <EmptyDescription>{t`No description`}</EmptyDescription>
      )}
      <SemanticTypeLabel semanticType={semanticType} />
      {children}
    </InfoContainer>
  );
}
