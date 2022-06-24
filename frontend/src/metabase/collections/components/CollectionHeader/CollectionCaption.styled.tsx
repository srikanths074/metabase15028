import styled from "@emotion/styled";
import EditableText from "metabase/core/components/EditableText";

export const CaptionContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const CaptionTitle = styled(EditableText)`
  font-size: 1.75rem;
  font-weight: 900;
`;

export const CaptionDescription = styled(EditableText)`
  max-width: 25rem;
`;
