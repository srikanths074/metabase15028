import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Flex } from "grid-styled";
import { t } from "ttag";
import _ from "underscore";

import { color } from "metabase/lib/colors";
import { capitalize, inflect } from "metabase/lib/formatting";
import { dismissUndo, performUndo } from "metabase/redux/undo";
import { getUndos } from "metabase/selectors/undo";

import BodyComponent from "metabase/components/BodyComponent";
import Card from "metabase/components/Card";
import Icon from "metabase/components/Icon";
import Link from "metabase/components/Link";

import { UndoList } from "./UndoListing.styled";

const mapStateToProps = (state, props) => ({
  undos: getUndos(state, props),
});

const mapDispatchToProps = {
  dismissUndo,
  performUndo,
};

DefaultMessage.propTypes = {
  undo: PropTypes.object.isRequired,
};

function DefaultMessage({
  undo: { verb = t`modified`, count = 1, subject = t`item` },
}) {
  return (
    <div>
      {count > 1
        ? `${capitalize(verb)} ${count} ${inflect(subject, count)}`
        : `${capitalize(verb)} ${subject}`}
    </div>
  );
}

UndoListing.propTypes = {
  undos: PropTypes.array.isRequired,
  performUndo: PropTypes.func.isRequired,
  dismissUndo: PropTypes.func.isRequired,
};

function UndoListing({ undos, performUndo, dismissUndo }) {
  return (
    <UndoList m={2} className="fixed left bottom zF">
      {undos.map(undo => (
        <Card key={undo._domId} dark p={2} mt={1}>
          <Flex align="center">
            <Icon
              name={(undo.icon && undo.icon) || "check"}
              color="white"
              mr={1}
            />
            {typeof undo.message === "function" ? (
              undo.message(undo)
            ) : undo.message ? (
              undo.message
            ) : (
              <DefaultMessage undo={undo || {}} />
            )}

            {undo.actions && undo.actions.length > 0 && (
              <Link
                ml={1}
                onClick={() => performUndo(undo.id)}
                className="link text-bold"
              >{t`Undo`}</Link>
            )}
            <Icon
              ml={1}
              color={color("text-light")}
              hover={{ color: color("text-medium") }}
              name="close"
              onClick={() => dismissUndo(undo.id)}
            />
          </Flex>
        </Card>
      ))}
    </UndoList>
  );
}

export default _.compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
  ),
  BodyComponent,
)(UndoListing);
