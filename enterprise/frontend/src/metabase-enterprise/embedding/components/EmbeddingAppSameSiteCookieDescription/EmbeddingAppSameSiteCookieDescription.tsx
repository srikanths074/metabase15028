import { jt, t } from "ttag";
import { useSelector } from "metabase/lib/redux";
import { alpha, color } from "metabase/lib/colors";
import { getDocsUrl, getSetting } from "metabase/selectors/settings";
import { Center, Stack, Text } from "metabase/ui";
import ExternalLink from "metabase/core/components/ExternalLink";
import { isEmpty } from "metabase/lib/utils";
import { isSameOrigin } from "metabase/lib/dom";

export const EmbeddingAppSameSiteCookieDescription = () => {
  const docsUrl = useSelector(state =>
    getDocsUrl(state, {
      page: "embedding/interactive-embedding#embedding-metabase-in-a-different-domain",
    }),
  );

  const embeddingSameSiteCookieSetting = useSelector(state =>
    getSetting(state, "session-cookie-samesite"),
  );
  const embeddingAuthorizedOrigins = useSelector(state =>
    getSetting(state, "embedding-app-origin"),
  );

  const shouldDisplayNote =
    embeddingSameSiteCookieSetting !== "none" &&
    authorizedOriginsContainsNonInstanceDomain(embeddingAuthorizedOrigins);

  return (
    <Stack mb="1rem" spacing="sm">
      <Text fw="bold">{t`SameSite cookie setting`}</Text>
      {shouldDisplayNote && <AuthorizedOriginsNote />}
      <Text>{t`Determines whether or not cookies are allowed to be sent on cross-site requests. You’ll likely need to change this to None if your embedding application is hosted under a different domain than Metabase. Otherwise, leave it set to Lax, as it's more secure.`}</Text>
      <Text>{jt`If you set this to None, you'll have to use HTTPS (unless you're just embedding locally), or browsers will reject the request. ${(
        <ExternalLink key="learn-more" href={docsUrl}>
          {t`Learn more`}
        </ExternalLink>
      )}`}</Text>
    </Stack>
  );
};

function AuthorizedOriginsNote() {
  return (
    <Center
      data-testid="authorized-origins-note"
      bg={alpha("warning", 0.1)}
      w="22rem"
      p="0.75rem"
      style={{
        border: `1px solid ${color("warning")}`,
        borderRadius: `0.5rem`,
      }}
    >
      <Text>{jt`You should probably change this setting to ${(
        <Text span fw="bold">
          {t`None`}
        </Text>
      )}.`}</Text>
    </Center>
  );
}

function authorizedOriginsContainsNonInstanceDomain(
  authorizedOriginsString: string,
): boolean {
  if (isEmpty(authorizedOriginsString)) {
    return false;
  }

  const origins = authorizedOriginsString.split(" ");
  return origins.some(origin => !isSameOrigin(origin));
}
