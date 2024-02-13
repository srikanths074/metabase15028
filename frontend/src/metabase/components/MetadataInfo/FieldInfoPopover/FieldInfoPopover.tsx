import type { HoverCardProps } from "metabase/ui";
import { HoverCard, useDelayGroup } from "metabase/ui";

import type { FieldInfoProps } from "../FieldInfo";
import {
  WidthBoundFieldInfo,
  Dropdown,
  Target,
} from "./FieldInfoPopover.styled";

export const POPOVER_DELAY: [number, number] = [1000, 300];
export const POPOVER_TRANSITION_DURATION = 150;

// When switching to another hover target in the same delay group,
// we don't closing immediatly but delay by a short amount to avoid flicker.
export const POPOVER_CLOSE_DELAY = 25;

export type FieldInfoPopoverProps = FieldInfoProps &
  Pick<HoverCardProps, "children" | "position" | "disabled"> & {
    delay?: [number, number];
  };

export function FieldInfoPopover({
  position = "bottom-start",
  disabled,
  delay = POPOVER_DELAY,
  children,
  ...rest
}: FieldInfoPopoverProps) {
  const group = useDelayGroup();

  return (
    <HoverCard
      position={position}
      disabled={disabled}
      openDelay={group.shouldDelay ? delay[0] : 0}
      closeDelay={group.shouldDelay ? delay[1] : POPOVER_CLOSE_DELAY}
      onOpen={group.onOpen}
      onClose={group.onClose}
      transitionProps={{
        duration: group.shouldDelay ? POPOVER_TRANSITION_DURATION : 0,
      }}
    >
      <HoverCard.Target>{children}</HoverCard.Target>
      <Dropdown>
        {/* HACK: adds an element between the target and the card */}
        {/* to avoid the card from disappearing */}
        <Target />
        <WidthBoundFieldInfo {...rest} />
      </Dropdown>
    </HoverCard>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default FieldInfoPopover;
