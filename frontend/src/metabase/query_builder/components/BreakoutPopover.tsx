import React from "react";

import type { ConcreteField } from "metabase-types/types/Query";
import type Breakout from "metabase-lib/queries/structured/Breakout";
import type DimensionOptions from "metabase-lib/DimensionOptions";
import type StructuredQuery from "metabase-lib/queries/StructuredQuery";

import { BreakoutFieldList } from "./BreakoutPopover.styled";

interface BreakoutPopoverProps {
  className?: string;
  query: StructuredQuery;
  breakout?: Breakout;
  breakoutOptions?: DimensionOptions;
  width?: number;
  maxHeight?: number;
  alwaysExpanded?: boolean;
  renderItemIcon?: (item: DimensionOptions) => React.ReactNode;
  renderItemWrapper?: (
    content: React.ReactNode,
    item: DimensionOptions,
  ) => JSX.Element;
  onChangeBreakout: (breakout: ConcreteField) => void;
  onClose?: () => void;
}

const BreakoutPopover = ({
  className,
  query,
  breakout,
  onChangeBreakout,
  breakoutOptions,
  onClose,
  maxHeight,
  alwaysExpanded,
  renderItemIcon,
  renderItemWrapper,
  width = 400,
}: BreakoutPopoverProps) => {
  const fieldOptions = breakoutOptions || query.breakoutOptions(breakout);

  return (
    <BreakoutFieldList
      field={breakout}
      query={query}
      metadata={query.metadata()}
      fieldOptions={fieldOptions}
      onFieldChange={(field: ConcreteField) => {
        onChangeBreakout(field);
        if (onClose) {
          onClose();
        }
      }}
      // forward AccordionList props
      className={className}
      maxHeight={maxHeight}
      width={width}
      alwaysExpanded={alwaysExpanded}
      renderItemIcon={renderItemIcon}
      renderItemWrapper={renderItemWrapper}
      // forward DimensionList props
      enableSubDimensions
    />
  );
};

export default BreakoutPopover;
