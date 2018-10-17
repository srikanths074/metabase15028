/* eslint "react/prop-types": "warn" */
import React from "react";
import PropTypes from "prop-types";
import { t } from "c-3po";
import cx from "classnames";
import pure from "recompose/pure";
import { connect } from "react-redux";

import { getXraysEnabled } from "metabase/selectors/settings";

import Breadcrumbs from "metabase/components/Breadcrumbs";
import SidebarItem from "metabase/components/SidebarItem";

import S from "metabase/components/Sidebar.css";

const SegmentSidebar = ({ segment, user, style, className, xraysEnabled }) => (
  <div className={cx(S.sidebar, className)} style={style}>
    <ul>
      <div className={S.breadcrumbs}>
        <Breadcrumbs
          className="py4"
          crumbs={[[t`Segments`, "/reference/segments"], [segment.name]]}
          inSidebar={true}
          placeholder={t`Data Reference`}
        />
      </div>
      <SidebarItem
        key={`/reference/segments/${segment.id}`}
        href={`/reference/segments/${segment.id}`}
        icon="document"
        name={t`Details`}
      />
      <SidebarItem
        key={`/reference/segments/${segment.id}/fields`}
        href={`/reference/segments/${segment.id}/fields`}
        icon="fields"
        name={t`Fields in this segment`}
      />
      <SidebarItem
        key={`/reference/segments/${segment.id}/questions`}
        href={`/reference/segments/${segment.id}/questions`}
        icon="all"
        name={t`Questions about this segment`}
      />
      {xraysEnabled && (
        <SidebarItem
          key={`/auto/dashboard/segment/${segment.id}`}
          href={`/auto/dashboard/segment/${segment.id}`}
          icon="bolt"
          name={t`X-ray this segment`}
        />
      )}
      {user &&
        user.is_superuser && (
          <SidebarItem
            key={`/reference/segments/${segment.id}/revisions`}
            href={`/reference/segments/${segment.id}/revisions`}
            icon="history"
            name={t`Revision history`}
          />
        )}
    </ul>
  </div>
);

SegmentSidebar.propTypes = {
  segment: PropTypes.object,
  user: PropTypes.object,
  className: PropTypes.string,
  style: PropTypes.object,
  xraysEnabled: PropTypes.bool,
};

export default connect(state => ({
  xraysEnabled: getXraysEnabled(state),
}))(pure(SegmentSidebar));
