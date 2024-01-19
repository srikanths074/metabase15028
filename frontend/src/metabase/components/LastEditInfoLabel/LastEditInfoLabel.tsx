import type { MouseEventHandler } from "react";
import { connect } from "react-redux";
import { t } from "ttag";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { getUser } from "metabase/selectors/user";
import type { NamedUser } from "metabase/lib/user";
import { getFullName } from "metabase/lib/user";
import { TextButton } from "metabase/components/Button.styled";
import type { TooltipProps } from "metabase/ui";
import { Tooltip } from "metabase/ui";
import DateTime from "metabase/components/DateTime";
import type { User } from "metabase-types/api";

dayjs.extend(relativeTime);

export type ItemWithLastEditInfo = {
  "last-edit-info": {
    id?: number;
    timestamp: string;
    first_name?: string;
    last_name?: string;
    full_name?: string | null;
  };
};

export const getHowLongAgo = (timestamp: string) => {
  const date = dayjs(timestamp);
  if (timestamp && date.isValid()) {
    return date.fromNow();
  } else {
    return t`(invalid date)`;
  }
};

function mapStateToProps(state: any, props: any) {
  return {
    ...props,
    user: getUser(state),
  };
}

function formatEditorName(lastEditInfo: NamedUser) {
  const name = getFullName(lastEditInfo);
  return name || lastEditInfo.email;
}

function LastEditInfoLabel({
  item,
  user,
  onClick,
  className,
  fullName = null,
  tooltipProps,
  children,
}: {
  item: ItemWithLastEditInfo;
  user: User;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  fullName: string | null;
  tooltipProps?: TooltipProps;
  children?: React.ReactNode;
}) {
  const lastEditInfo = item["last-edit-info"];
  const editorId = lastEditInfo?.id;
  const timestamp = lastEditInfo?.timestamp;
  const timeLabel = getHowLongAgo(timestamp);

  fullName ||= formatEditorName(lastEditInfo) || null;
  const editorFullName = editorId === user.id ? t`you` : fullName;

  tooltipProps ??= { children: null, label: null };
  tooltipProps.label ??= timestamp ? <DateTime value={timestamp} /> : null;

  return (
    <Tooltip disabled={!timeLabel} {...tooltipProps}>
      <TextButton
        size="small"
        className={className}
        onClick={onClick}
        data-testid="revision-history-button"
      >
        {children || (
          <>
            {editorFullName
              ? t`Edited ${timeLabel} by ${editorFullName}`
              : null}
          </>
        )}
      </TextButton>
    </Tooltip>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default connect(mapStateToProps)(LastEditInfoLabel);
