export interface Tool {
  name: string;
  description: string;
  parameters: object;
  strict: boolean;
}

export function getToolSpec() {
  return [
    {
      "name": "hideShowColumns",
      "description": "Show or hide columns in a table",
      "parameters": {
        "type": "object",
        "properties": {
          "columns": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "title": "Column Name",
                  "description": "The name of the column (not the display name)",
                  "type": "string"
                },
                "enabled": {
                  "title": "Enabled",
                  "type": "boolean"
                }
              },
              "required": [
                "name",
                "enabled"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": ["columns"],
        "additionalProperties": false
      },
      "strict": true
    },
    {
      "name": "moveColumns",
      "description": "Move columns in a table",
      "parameters": {
        "additionalProperties": false,
        "properties": {
          "oldIndex": {
            "title": "Old Index",
            "type": "integer"
          },
          "newIndex": {
            "title": "New Index",
            "type": "integer"
          }
        },
        "required": [
          "oldIndex",
          "newIndex"
        ],
        "title": "Parameters",
        "type": "object"
      },
      "strict": true
    },
    {
      "name": "applyVisualization",
      "description": "Apply visualization settings including display type, filters, summarizations, and groupings. Leave the field null to keep the setting unchanged.",
      "parameters": {
        "type": "object",
        "properties": {
          "display": {
            "title": "Visualization Display Type",
            "type": ["string", "null"],
            "enum": [
              "pie",
              "table",
              "bar",
              "line",
              "row",
              "area",
              "scalar"
            ]
          },
          "filters": {
            "type": ["array", "null"],
            "items": {
              "type": "object",
              "properties": {
                "comparator": {
                  "type": "string",
                  "enum": ["=", "<", ">"],
                  "title": "FilterOperator"
                },
                "fieldName": {
                  "title": "Field Name",
                  "type": "string"
                },
                "value": {
                  "title": "Value",
                  "type": "string"
                }
              },
              "required": ["comparator", "fieldName", "value"],
              "additionalProperties": false,
              "title": "Filter"
            }
          },
          "summarizations": {
            "type": ["array", "null"],
            "items": {
              "type": "object",
              "properties": {
                "fieldName": {
                  "title": "Field Name",
                  "description": "The name of the field to summarize",
                  "type": ["string", "null"]
                },
                "metrics": {
                  "title": "Summarization Metric",
                  "description": "The type of summarization to apply. COUNT does not require a field name.",
                  "type": "string",
                  "enum": ["sum", "count", "average"]
                }
              },
              "required": ["fieldName", "metrics"],
              "additionalProperties": false
            }
          },
          "groups": {
            "type": ["array", "null"],
            "items": {
              "type": "object",
              "properties": {
                "fieldName": {
                  "title": "Field Name",
                  "description": "The name of the field to group by",
                  "type": "string"
                },
                "granularity": {
                  "title": "Granularity",
                  "description": "The granularity of grouping for date fields",
                  "type": ["string", "null"],
                  "enum": ["day", "week", "month", "year"]
                }
              },
              "required": ["fieldName", "granularity"],
              "additionalProperties": false
            }
          }
        },
        "required": ["display", "filters", "summarizations", "groups"],
        "additionalProperties": false
      },
      "strict": true
    }
  ] as const satisfies Tool[];
}
