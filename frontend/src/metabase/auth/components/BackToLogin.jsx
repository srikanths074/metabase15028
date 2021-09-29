import React from "react";
import { Link } from "react-router";
import { t } from "ttag";

const BackToLogin = () => (
  <Link to="/auth/login" className="link block">{t`Back to login`}</Link>
);

export default BackToLogin;
