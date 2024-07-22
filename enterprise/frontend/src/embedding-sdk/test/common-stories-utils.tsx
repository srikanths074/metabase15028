import * as jose from "jose";
import type { PropsWithChildren } from "react";

import { MetabaseProvider, type SDKConfig } from "embedding-sdk";

const METABASE_INSTANCE_URL =
  (window as any).METABASE_INSTANCE_URL || "http://localhost:3000";
const METABASE_JWT_SHARED_SECRET =
  (window as any).JWT_SHARED_SECRET || "0".repeat(64);

const secret = new TextEncoder().encode(METABASE_JWT_SHARED_SECRET);

const DEFAULT_SDK_USER = {
  firstName: "Robert",
  lastName: "Tableton",
  email: "normal@metabase.test",
  password: "12341234",
};

const DEFAULT_CONFIG: SDKConfig = {
  metabaseInstanceUrl: METABASE_INSTANCE_URL,
  jwtProviderUri: `${METABASE_INSTANCE_URL}/sso/metabase`,
  fetchRequestToken: async () => {
    try {
      const signedUserData = await new jose.SignJWT({
        email: DEFAULT_SDK_USER.email,
        first_name: DEFAULT_SDK_USER.firstName,
        last_name: DEFAULT_SDK_USER.lastName,
        exp: Math.round(Date.now() / 1000) + 10 * 60, // 10 minute expiration
      })
        .setProtectedHeader({ alg: "HS256" }) // algorithm
        .setIssuedAt()
        .setExpirationTime(Math.round(Date.now() / 1000) + 10 * 60) // token expiration time, e.g., "1 day"
        .sign(secret);

      const ssoUrl = new URL("/auth/sso", METABASE_INSTANCE_URL);
      ssoUrl.searchParams.set("jwt", signedUserData);
      ssoUrl.searchParams.set("token", "true");

      const response = await fetch(ssoUrl, { method: "GET" });

      return response.json();
    } catch (e) {
      console.error("Failed to generate JWT", e);
    }
  },
};

export const CommonStoryWrapper = ({ children }: PropsWithChildren) => (
  <MetabaseProvider config={DEFAULT_CONFIG}>{children}</MetabaseProvider>
);
