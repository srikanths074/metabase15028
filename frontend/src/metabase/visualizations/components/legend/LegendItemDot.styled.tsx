import styled from "@emotion/styled";

export const OuterCircle = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--mb-color-border);
  transition: all 0.2s;
`;

export const InnerCircle = styled.div<{ isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  color-adjust: exact;
  background-color: ${props =>
    props.isVisible ? props.color : "var(--mb-color-background)"};
  border: 2px solid
    ${props => (props.isVisible ? props.color : "var(--mb-color-text-medium)")};
  transition: all 0.2s;
`;

export const Button = styled.button`
  position: relative;
  width: 12px;
  height: 12px;
  cursor: ${({ onClick }) => (onClick ? "pointer" : "")};

  ${props =>
    props.onClick &&
    `&:hover {
      ${InnerCircle} {
        transform: scale(0.8);
      }
      ${OuterCircle} {
        transform: scale(1.3);
      }
    }`}
`;
