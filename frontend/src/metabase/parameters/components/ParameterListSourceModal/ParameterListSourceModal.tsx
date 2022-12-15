import React, { ChangeEvent, useCallback, useState } from "react";
import { t } from "ttag";
import Button from "metabase/core/components/Button";
import ModalContent from "metabase/components/ModalContent";
import { getSourceOptions } from "metabase/parameters/utils/dashboards";
import {
  ParameterSourceOptions,
  ParameterSourceType,
} from "metabase-types/api";
import { UiParameter } from "metabase-lib/parameters/types";
import { ModalMessage, ModalTextArea } from "./ParameterListSourceModal.styled";

const NEW_LINE = "\n";
const PLACEHOLDER = [t`banana`, t`orange`].join(NEW_LINE);

export interface ParameterListSourceModalProps {
  parameter: UiParameter;
  onChangeSourceType: (sourceType: ParameterSourceType) => void;
  onChangeSourceOptions: (sourceOptions: ParameterSourceOptions) => void;
  onClose?: () => void;
}

const ParameterListSourceModal = ({
  parameter,
  onChangeSourceType,
  onChangeSourceOptions,
  onClose,
}: ParameterListSourceModalProps): JSX.Element => {
  const options = getSourceOptions(parameter);
  const [value, setValue] = useState(options.values?.join(NEW_LINE) ?? "");
  const isValid = value.length > 0;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const values = value.split(NEW_LINE);
    onChangeSourceType("static-list");
    onChangeSourceOptions({ values });
    onClose?.();
  }, [value, onChangeSourceType, onChangeSourceOptions, onClose]);

  return (
    <ModalContent
      title={t`Create a custom list`}
      footer={[
        <Button key="cancel" onClick={onClose}>{t`Cancel`}</Button>,
        <Button
          key="submit"
          primary
          disabled={!isValid}
          onClick={handleSubmit}
        >{t`Done`}</Button>,
      ]}
      onClose={onClose}
    >
      <div>
        <ModalMessage>{t`Enter one value per line.`}</ModalMessage>
        <ModalTextArea
          value={value}
          placeholder={PLACEHOLDER}
          autoFocus
          fullWidth
          onChange={handleChange}
        />
      </div>
    </ModalContent>
  );
};

export default ParameterListSourceModal;
