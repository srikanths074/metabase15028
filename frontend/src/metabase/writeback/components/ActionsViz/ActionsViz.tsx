import React, { useMemo } from "react";
import { t } from "ttag";
import { connect } from "react-redux";

import Button from "metabase/core/components/Button";
import Modal from "metabase/components/Modal";

import { useConfirmation } from "metabase/hooks/use-confirmation";
import { useToggle } from "metabase/hooks/use-toggle";

// TODO ActionsViz should ideally be independent from dashboard
import { getCardData } from "metabase/dashboard/selectors";

import { useDataAppContext } from "metabase/writeback/containers/DataAppContext";
import WritebackModalForm from "metabase/writeback/containers/WritebackModalForm";

// TODO This should better be extracted to metabase/lib/somewhere
import { getObjectName } from "metabase/visualizations/components/ObjectDetail/utils";

import { getMetadata } from "metabase/selectors/metadata";

import Metadata from "metabase-lib/lib/metadata/Metadata";
import Question from "metabase-lib/lib/Question";

import { State } from "metabase-types/store";
import { SavedCard } from "metabase-types/types/Card";
import { DashboardWithCards, DashCard } from "metabase-types/types/Dashboard";
import { Dataset, DatasetData } from "metabase-types/types/Dataset";
import { VisualizationProps } from "metabase-types/types/Visualization";

import {
  DeleteRowFromDataAppPayload,
  InsertRowFromDataAppPayload,
  UpdateRowFromDataAppPayload,
  BulkDeleteFromDataAppPayload,
  deleteRowFromDataApp,
  createRowFromDataApp,
  updateRowFromDataApp,
  deleteManyRowsFromDataApp,
} from "metabase/dashboard/writeback-actions";

import { HorizontalAlignmentValue } from "./types";
import { Root } from "./ActionsViz.styled";

const ACTIONS_VIZ_DEFINITION = {
  uiName: t`Actions`,
  identifier: "actions",
  iconName: "bolt",

  noHeader: true,
  supportsSeries: false,
  hidden: true,
  supportPreviewing: false,

  minSize: { width: 3, height: 1 },

  checkRenderable: () => true,
  isSensible: () => false,

  settings: {
    "card.title": {
      dashboard: false,
    },
    "card.description": {
      dashboard: false,
    },
    "actions.create_enabled": {
      section: t`Default actions`,
      title: t`Create enabled`,
      widget: "toggle",
      default: true,
    },
    "actions.update_enabled": {
      section: t`Default actions`,
      title: t`Update enabled`,
      widget: "toggle",
      default: true,
    },
    "actions.delete_enabled": {
      section: t`Default actions`,
      title: t`Delete enabled`,
      widget: "toggle",
      default: true,
    },
    "actions.linked_card": {
      section: t`Default actions`,
      title: t`Linked card`,
    },
    "actions.align_horizontal": {
      section: t`Display`,
      title: t`Horizontal Alignment`,
      widget: "select",
      props: {
        options: [
          { name: t`Left`, value: "left" },
          { name: t`Center`, value: "center" },
          { name: t`Right`, value: "right" },
        ],
      },
      default: "right",
    },
  },
};

// { [dashCardId]: { [cardId]: <dataset> } }
type DashCardData = Record<number, Record<number, Dataset | undefined>>;

interface ActionVizOwnProps extends VisualizationProps {
  dashboard: DashboardWithCards;
  dashCardData?: DashCardData;
  metadata?: Metadata;
}

interface ActionWizStateProps {
  dashCardData?: DashCardData;
}

interface ActionWizDispatchProps {
  deleteRow: (payload: DeleteRowFromDataAppPayload) => void;
  insertRow: (payload: InsertRowFromDataAppPayload) => void;
  updateRow: (payload: UpdateRowFromDataAppPayload) => void;

  deleteManyRows: (payload: BulkDeleteFromDataAppPayload) => void;
}

type ActionsVizProps = ActionVizOwnProps &
  ActionWizStateProps &
  ActionWizDispatchProps;

function mapStateToProps(state: State) {
  return {
    dashCardData: getCardData(state),
    metadata: getMetadata(state),
  };
}

const mapDispatchToProps = {
  deleteRow: deleteRowFromDataApp,
  insertRow: createRowFromDataApp,
  updateRow: updateRowFromDataApp,

  deleteManyRows: deleteManyRowsFromDataApp,
};

function getObjectDetailViewData(
  dashCardData: DashCardData,
  dashCard: DashCard<SavedCard>,
): DatasetData | undefined {
  const cardQueryResult = dashCardData[dashCard.id][dashCard.card_id];
  return cardQueryResult?.data;
}

function ActionsViz({
  dashboard,
  dashCardData,
  metadata,
  settings,
  deleteRow,
  insertRow,
  updateRow,
  deleteManyRows,
}: ActionsVizProps) {
  const [isModalOpen, { turnOn: showModal, turnOff: hideModal }] =
    useToggle(false);
  const { modalContent: confirmationModalContent, show: requestConfirmation } =
    useConfirmation();

  const { bulkActions } = useDataAppContext();

  const connectedDashCardId = settings["actions.linked_card"];
  const connectedDashCard = dashboard.ordered_cards.find(
    dashCard => dashCard.id === connectedDashCardId,
  );

  const question = useMemo(
    () =>
      connectedDashCard
        ? new Question(connectedDashCard?.card, metadata)
        : null,
    [connectedDashCard, metadata],
  );

  const isObjectDetailView = question?.display() === "object";
  const table = question?.table();
  const connectedCardData =
    connectedDashCard && isObjectDetailView && dashCardData
      ? getObjectDetailViewData(
          dashCardData,
          connectedDashCard as DashCard<SavedCard>,
        )
      : undefined;
  const row = connectedCardData?.rows[0];

  const isBulkSelectActive = bulkActions.cardId === connectedDashCard?.card_id;

  const hasCreateButton =
    settings["actions.create_enabled"] &&
    (!isObjectDetailView || !connectedDashCardId);
  const canCreate = !!question;

  const hasUpdateButton = settings["actions.update_enabled"];
  const canUpdate = useMemo(() => {
    if (!question) {
      return false;
    }
    if (isObjectDetailView) {
      return true;
    }
    return isBulkSelectActive && bulkActions.selectedRowIndexes.length > 0;
  }, [question, isObjectDetailView, isBulkSelectActive, bulkActions]);

  const hasDeleteButton = settings["actions.delete_enabled"];
  const canDelete = useMemo(() => {
    if (!question) {
      return false;
    }
    if (isObjectDetailView) {
      return true;
    }
    return isBulkSelectActive && bulkActions.selectedRowIndexes.length > 0;
  }, [question, isObjectDetailView, isBulkSelectActive, bulkActions]);

  const horizontalAlignment = settings[
    "actions.align_horizontal"
  ] as HorizontalAlignmentValue;

  function handleInsert(values: Record<string, unknown>) {
    if (table && connectedDashCard) {
      return insertRow({
        table,
        values,
        dashCard: connectedDashCard,
      });
    }
  }

  function handleUpdate(values: Record<string, unknown>) {
    if (!table || !connectedDashCard || !connectedCardData || !row) {
      return;
    }
    const pkColumnIndex = connectedCardData.cols.findIndex(
      col => col.semantic_type === "type/PK",
    );
    const pkValue = row[pkColumnIndex];
    if (typeof pkValue === "string" || typeof pkValue === "number") {
      return updateRow({
        id: pkValue,
        table,
        values,
        dashCard: connectedDashCard,
      });
    }
  }

  async function handleBulkDelete() {
    if (!table || !connectedDashCard) {
      return;
    }

    const rowCount = bulkActions.selectedRowIndexes.length;
    const objectName = table?.displayName();

    requestConfirmation({
      title: t`Delete ${rowCount} ${objectName}?`,
      message: t`This can't be undone`,
      onConfirm: async () => {
        await deleteManyRows({
          table,
          dashCard: connectedDashCard,
          rowIndexes: bulkActions.selectedRowIndexes,
        });
      },
    });
  }

  function handleDelete() {
    if (
      !question ||
      !table ||
      !connectedCardData ||
      !connectedDashCard ||
      !row
    ) {
      return;
    }

    const pkColumnIndex = connectedCardData.cols.findIndex(
      col => col.semantic_type === "type/PK",
    );
    const pkValue = row[pkColumnIndex];

    if (typeof pkValue !== "string" && typeof pkValue !== "number") {
      return;
    }

    const objectName = getObjectName({
      table,
      question,
      cols: connectedCardData.cols,
      zoomedRow: row,
    });

    requestConfirmation({
      title: t`Delete ${objectName}?`,
      message: t`This can't be undone.`,
      onConfirm: async () => {
        deleteRow({
          id: pkValue,
          table,
          dashCard: connectedDashCard,
        });
      },
    });
  }

  function onDeleteClick() {
    if (isBulkSelectActive) {
      handleBulkDelete();
    } else {
      handleDelete();
    }
  }

  return (
    <>
      <Root horizontalAlignment={horizontalAlignment}>
        {hasCreateButton && (
          <Button disabled={!canCreate} onClick={showModal}>{t`New`}</Button>
        )}
        {hasUpdateButton && (
          <Button disabled={!canUpdate} onClick={showModal}>{t`Edit`}</Button>
        )}
        {hasDeleteButton && (
          <Button
            disabled={!canDelete}
            onClick={onDeleteClick}
            danger
          >{t`Delete`}</Button>
        )}
      </Root>
      {!!table && (
        <Modal isOpen={isModalOpen} onClose={hideModal}>
          <WritebackModalForm
            table={table}
            row={row}
            onSubmit={row ? handleUpdate : handleInsert}
            onClose={hideModal}
          />
        </Modal>
      )}
      {confirmationModalContent}
    </>
  );
}

const ConnectedActionsViz = connect<
  ActionWizStateProps,
  ActionWizDispatchProps,
  ActionVizOwnProps,
  State
>(
  mapStateToProps,
  mapDispatchToProps,
)(ActionsViz);

export default Object.assign(ConnectedActionsViz, ACTIONS_VIZ_DEFINITION);
