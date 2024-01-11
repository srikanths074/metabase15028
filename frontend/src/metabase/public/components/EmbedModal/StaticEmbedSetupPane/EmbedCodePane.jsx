/* eslint-disable react/prop-types */
import { Component } from "react";
import { t, jt } from "ttag";
import ExternalLink from "metabase/core/components/ExternalLink";
import {
  getSignedEmbedOptions,
  getSignTokenOptions,
} from "metabase/public/lib/code";

import "ace/mode-clojure";
import "ace/mode-javascript";
import "ace/mode-ruby";
import "ace/mode-html";
import "ace/mode-jsx";
import { trackStaticEmbedCodeCopied } from "metabase/public/lib/analytics";
import CodeSample from "./CodeSample";
import { EMBED_MODAL_TABS } from "./tabs";

const getEmbedModalTabLocation = tab => {
  if (tab === EMBED_MODAL_TABS.Overview) {
    return "code_overview";
  }
  if (tab === EMBED_MODAL_TABS.Appearance) {
    return "code_appearance";
  }
  if (tab === EMBED_MODAL_TABS.Parameters) {
    return "code_params";
  }
};

export default class EmbedCodePane extends Component {
  render() {
    const {
      className,
      iframeUrl,
      siteUrl,
      secretKey,
      resource,
      resourceType,
      params,
      displayOptions,
      withExamplesLink,
      embedModalLocation,
    } = this.props;
    return (
      <div className={className}>
        <CodeSample
          title={t`Insert this code snippet in your server code to generate the signed embedding URL `}
          options={getSignTokenOptions({
            siteUrl,
            secretKey,
            resourceType,
            resourceId: resource.id,
            params,
            displayOptions,
          })}
          onChangeOption={option => {
            if (
              option &&
              option.embedOption &&
              this._embedSample &&
              this._embedSample.setOption
            ) {
              this._embedSample.setOption(option.embedOption);
            }
          }}
          onCopy={({ name: codeLanguage }) => {
            trackStaticEmbedCodeCopied({
              artifact: resourceType,
              language: codeLanguage,
              location: getEmbedModalTabLocation(embedModalLocation),
              appearance: {
                border: displayOptions.bordered,
                title: displayOptions.titled,
                font: displayOptions.font ? "custom" : "instance",
                theme: displayOptions.theme ?? "light",
              },
            });
          }}
          dataTestId="embed-backend"
        />
        <CodeSample
          className="mt2"
          ref={embedSample => (this._embedSample = embedSample)}
          title={t`Then insert this code snippet in your HTML template or single page app.`}
          options={getSignedEmbedOptions({ iframeUrl })}
          dataTestId="embed-frontend"
        />

        {withExamplesLink && (
          <div className="text-centered mt4">
            <h4>{jt`More ${(
              <ExternalLink
                key="examples"
                href="https://github.com/metabase/embedding-reference-apps"
              >
                {t`examples on GitHub`}
              </ExternalLink>
            )}`}</h4>
          </div>
        )}
      </div>
    );
  }
}
