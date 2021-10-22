/* eslint-disable react/prop-types */
import React from "react";
import { connect } from "react-redux";
import { createSelector } from "reselect";
import _ from "underscore";

import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";

import entityType from "./EntityType";

export type Props = {
  // Entity ID, such as a database ID
  entityId: any,
  // Entity type name (e.x. "databases", "questions", etc)
  entityType: string,
  // Reload the object when the component is mounted (or entityId changes)
  reload?: boolean,
  // Wrap the object in the a class that contains helper functions
  wrapped?: boolean,
  // List of required properties, if the object is loaded and they are all
  // present don't bother loading as the object has been loaded by some other means
  properties?: string[],
  // Wrap the children in LoadingAndErrorWrapper to display loading and error states
  // When true (default) the children render prop won't be called until loaded
  loadingAndErrorWrapper: boolean,
  // selectorName overrides the default getObject selector
  selectorName?: string,
  // Children render prop
  children?: (props: RenderProps) => ?React.Element,
};

export type RenderProps = {
  // the loaded objecvt itself
  object: ?any,
  // data was loaded at least once
  fetched: boolean,
  // data is loaded and no pending requests
  loaded: boolean,
  //  request is pending
  loading: boolean,
  // error occured
  error: ?any,
  remove: () => Promise<void>,
};

// props that shouldn't be passed to children in order to properly stack
const CONSUMED_PROPS: string[] = [
  "entityType",
  "entityId",
  // "reload", // Masked by `reload` function. Should we rename that?
  "wrapped",
  "properties",
  "loadingAndErrorWrapper",
  "selectorName",
];

@entityType()
@connect(
  (state, { entityDef, entityId, selectorName = "getObject", ...props }) => {
    if (typeof entityId === "function") {
      entityId = entityId(state, props);
    }

    return {
      entityId,
      object: entityDef.selectors[selectorName](state, { entityId }),
      fetched: entityDef.selectors.getFetched(state, { entityId }),
      loading: entityDef.selectors.getLoading(state, { entityId }),
      error: entityDef.selectors.getError(state, { entityId }),
    };
  },
)
export default class EntityObjectLoader extends React.Component {
  props: Props;

  static defaultProps = {
    loadingAndErrorWrapper: true,
    reload: false,
    wrapped: false,
  };

  _getWrappedObject: ?(props: Props) => any;

  constructor(props: Props) {
    super(props);

    this._getWrappedObject = createSelector(
      [
        props => props.object,
        props => props.dispatch,
        props => props.entityDef,
      ],
      (object, dispatch, entityDef) =>
        object && entityDef.wrapEntity(object, dispatch),
    );
  }

  UNSAFE_componentWillMount() {
    const { entityId, fetch } = this.props;
    if (entityId != null) {
      fetch(
        { id: entityId },
        { reload: this.props.reload, properties: this.props.properties },
      );
    }
  }
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (
      nextProps.entityId !== this.props.entityId &&
      nextProps.entityId != null
    ) {
      nextProps.fetch(
        { id: nextProps.entityId },
        { reload: nextProps.reload, properties: nextProps.properties },
      );
    }
  }
  renderChildren = () => {
    let { children, entityDef, wrapped, object, ...props } = this.props; // eslint-disable-line no-unused-vars

    if (wrapped) {
      object = this._getWrappedObject(this.props);
    }

    return children({
      ..._.omit(props, ...CONSUMED_PROPS),
      object,
      // alias the entities name:
      [entityDef.nameOne]: object,
      reload: this.reload,
      remove: this.remove,
    });
  };
  render() {
    const { entityId, fetched, error, loadingAndErrorWrapper } = this.props;
    return loadingAndErrorWrapper ? (
      <LoadingAndErrorWrapper
        loading={!fetched && entityId != null}
        error={error}
        noWrapper
      >
        {this.renderChildren}
      </LoadingAndErrorWrapper>
    ) : (
      this.renderChildren()
    );
  }

  reload = () => {
    return this.props.fetch(
      { id: this.props.entityId },
      { reload: true, properties: this.props.properties },
    );
  };

  remove = () => {
    return this.props.delete(this.props.object);
  };
}

export const entityObjectLoader = (eolProps: Props) =>
  // eslint-disable-line react/display-name
  (ComposedComponent: any) =>
    // eslint-disable-next-line react/display-name
    (props: Props) => (
      <EntityObjectLoader {...props} {...eolProps}>
        {childProps => (
          <ComposedComponent
            {..._.omit(props, ...CONSUMED_PROPS)}
            {...childProps}
          />
        )}
      </EntityObjectLoader>
    );
