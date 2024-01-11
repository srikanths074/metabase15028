import { t } from "ttag";
import Link from "metabase/core/components/Link";
import ExternalLink from "metabase/core/components/ExternalLink";
import { Icon } from "metabase/core/components/Icon";
import { getUserIsAdmin } from "metabase/selectors/user";
import { useSelector } from "metabase/lib/redux";
import { getDocsUrl } from "metabase/selectors/settings";
import { getShowMetabaseLinks } from "metabase/selectors/whitelabel";
import { CustomMapContent } from "../Maps.styled";

export function CustomMapFooter() {
  const isAdmin = useSelector(getUserIsAdmin);
  const docsUrl = useSelector(state =>
    getDocsUrl(state, { page: "configuring-metabase/custom-maps" }),
  );
  const showMetabaseLinks = useSelector(getShowMetabaseLinks);

  const content = (
    <CustomMapContent>
      {t`Custom map`}
      <Icon name="share" />
    </CustomMapContent>
  );

  return isAdmin ? (
    <Link to="/admin/settings/maps" aria-label={t`Custom map`}>
      {content}
    </Link>
  ) : (
    showMetabaseLinks && (
      <ExternalLink aria-label={t`Custom map`} href={docsUrl}>
        {content}
      </ExternalLink>
    )
  );
}
