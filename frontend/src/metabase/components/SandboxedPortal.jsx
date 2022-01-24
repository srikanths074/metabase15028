import React from "react";
import ReactDOM from "react-dom";

import EventSandbox from "./EventSandbox";

// Prevent DOM events from bubbling through the React component tree
// See https://reactjs.org/docs/portals.html#event-bubbling-through-portals
function SandboxedPortal({ children, container, enableMouseEvents = false }) {
  return ReactDOM.createPortal(
    <EventSandbox enableMouseEvents={enableMouseEvents}>
      {children}
    </EventSandbox>,
    container,
  );
}

export default SandboxedPortal;
