/*global ace*/
import { Component, createRef } from "react";
import PropTypes from "prop-types";

import "ace/ace";
import "ace/mode-plain_text";
import "ace/mode-javascript";
import "ace/mode-json";
import { TextEditorRoot } from "./TextEditor.styled";

const SCROLL_MARGIN = 8;
const LINE_HEIGHT = 16;
const HIGHLIGHTED_CODE_ROW_CLASSNAME = "highlighted-code-marker";
const HIGHLIGHTED_CODE_ROW_NUMBER_CLASSNAME =
  "highlighted-code-marker-row-number";
const HIGHLIGHTED_CODE_ROW_CLASSNAME_ACCENT = "highlighted-code-marker-accent";
const HIGHLIGHTED_CODE_ROW_NUMBER_CLASSNAME_ACCENT =
  "highlighted-code-marker-row-number-accent";

export default class TextEditor extends Component {
  static propTypes = {
    mode: PropTypes.string,
    theme: PropTypes.string,
    value: PropTypes.string,
    defaultValue: PropTypes.string,
    readOnly: PropTypes.bool,
    highlightedText: PropTypes.string,
    isHighlightedTextAccent: PropTypes.bool,
    onChange: PropTypes.func,
    className: PropTypes.string,
  };

  static defaultProps = {
    mode: "ace/mode/plain_text",
    theme: null,
  };

  editorRef = createRef();

  highlightedTextValue = null;
  highlightedTextMarkerId = null;

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      this._editor &&
      nextProps.value != null &&
      nextProps.value !== this._editor.getValue()
    ) {
      this._editor.setValue(nextProps.value);
      this._editor.clearSelection();
    }
  }

  _update() {
    const element = this.editorRef.current;

    if (this._editor == null) {
      return; // _editor is undefined when ace isn't loaded in tests
    }

    this._updateValue();

    this._editor.getSession().setMode(this.props.mode);
    this._editor.setTheme(this.props.theme);

    // read only
    this._editor.setReadOnly(this.props.readOnly);
    element.classList[this.props.readOnly ? "add" : "remove"]("read-only");

    // highlightedText
    if (
      this.highlightedTextValue !== this.props.highlightedText &&
      this.props.highlightedText != null
    ) {
      this._addTextHighlight();
      this.highlightedTextValue = this.props.highlightedText;
    }

    if (this.props.highlightedText == null) {
      this._removeTextHighlight();
      this.highlightedTextValue = null;
    }

    this._updateSize();
  }

  _updateValue() {
    if (this._editor) {
      this.value = this._editor.getValue();
    }
  }

  _updateSize() {
    const doc = this._editor.getSession().getDocument();
    const element = this.editorRef.current;
    element.style.height =
      2 * SCROLL_MARGIN + LINE_HEIGHT * doc.getLength() + "px";
    this._editor.resize();
  }

  _addTextHighlight() {
    const textRange = this._editor.find(this.props.highlightedText);
    this._editor.selection.clearSelection();

    if (textRange) {
      this._removeTextHighlight();

      this.highlightedTextMarkerId = this._editor.session.addMarker(
        textRange,
        this.props.isHighlightedTextAccent
          ? HIGHLIGHTED_CODE_ROW_CLASSNAME_ACCENT
          : HIGHLIGHTED_CODE_ROW_CLASSNAME,
        "fullLine",
        true,
      );

      for (let i = textRange.start.row; i <= textRange.end.row; i++) {
        this._editor.session.addGutterDecoration(
          i,
          this.props.isHighlightedTextAccent
            ? HIGHLIGHTED_CODE_ROW_NUMBER_CLASSNAME_ACCENT
            : HIGHLIGHTED_CODE_ROW_NUMBER_CLASSNAME,
        );
      }
    }
  }

  _removeTextHighlight() {
    if (this.highlightedTextMarkerId) {
      this._editor.session.removeMarker(this.highlightedTextMarkerId);
    }

    for (let i = 0; i <= this._editor.session.getLength(); i++) {
      this._editor.session.removeGutterDecoration(
        i,
        this.props.isHighlightedTextAccent
          ? HIGHLIGHTED_CODE_ROW_NUMBER_CLASSNAME_ACCENT
          : HIGHLIGHTED_CODE_ROW_NUMBER_CLASSNAME,
      );
    }
  }

  onChange = e => {
    this._update();
    if (this.props.onChange) {
      this.props.onChange(this.value);
    }
  };

  componentDidMount() {
    if (typeof ace === "undefined" || !ace || !ace.edit) {
      // fail gracefully-ish if ace isn't available, e.x. in integration tests
      return;
    }

    const element = this.editorRef.current;
    this._editor = ace.edit(element);

    window.editor = this._editor;

    // listen to onChange events
    this._editor.getSession().on("change", this.onChange);

    // misc options, copied from NativeQueryEditor
    this._editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true,
      showPrintMargin: false,
      highlightActiveLine: false,
      highlightGutterLine: false,
      showLineNumbers: true,
      // wrap: true
    });
    this._editor.renderer.setScrollMargin(SCROLL_MARGIN, SCROLL_MARGIN);

    // initialize the content
    this._editor.setValue(
      (this.props.value != null ? this.props.value : this.props.defaultValue) ||
        "",
    );

    // clear the editor selection, otherwise we start with the whole editor selected
    this._editor.clearSelection();

    // hmmm, this could be dangerous
    // this._editor.focus();

    this._update();
  }

  componentDidUpdate() {
    this._update();
  }

  render() {
    const { className } = this.props;

    return <TextEditorRoot ref={this.editorRef} className={className} />;
  }
}
