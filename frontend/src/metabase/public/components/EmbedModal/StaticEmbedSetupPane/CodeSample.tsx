import type { ChangeEvent } from "react";
import Select, { Option } from "metabase/core/components/Select";
import CopyButton from "metabase/components/CopyButton";
import AceEditor from "metabase/components/TextEditor";
import type { CodeSampleOption } from "metabase/public/lib/types";

import { CopyButtonContainer } from "./CodeSample.styled";

interface CodeSampleProps {
  selectedOptionName: CodeSampleOption["name"];
  source: string;
  languageOptions: CodeSampleOption["name"][];
  title: string;
  textHighlightMode: string;
  highlightedText?: string;
  isHighlightedTextAccent?: boolean;

  dataTestId?: string;
  className?: string;

  onChangeOption: (optionName: string) => void;
}

export const CodeSample = ({
  selectedOptionName,
  source,
  title,
  languageOptions,
  dataTestId,
  textHighlightMode,
  highlightedText,
  isHighlightedTextAccent,
  className,
  onChangeOption,
}: CodeSampleProps): JSX.Element => {
  return (
    <div className={className}>
      {(title || languageOptions.length > 1) && (
        <div className="flex align-center">
          <h4>{title}</h4>
          {languageOptions.length > 1 ? (
            <Select
              className="AdminSelect--borderless ml-auto"
              value={selectedOptionName}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onChangeOption(e.target.value)
              }
              buttonProps={{
                dataTestId,
              }}
            >
              {languageOptions.map(option => (
                <Option key={option} value={option}>
                  {option}
                </Option>
              ))}
            </Select>
          ) : null}
        </div>
      )}
      <div className="bordered rounded shadowed relative mt2">
        <AceEditor
          className="z1"
          value={source}
          mode={textHighlightMode}
          theme="ace/theme/metabase"
          sizeToFit
          readOnly
          highlightedText={highlightedText}
          isHighlightedTextAccent={isHighlightedTextAccent}
        />
        {source && (
          <CopyButtonContainer>
            <CopyButton className="p1" value={source} />
          </CopyButtonContainer>
        )}
      </div>
    </div>
  );
};
