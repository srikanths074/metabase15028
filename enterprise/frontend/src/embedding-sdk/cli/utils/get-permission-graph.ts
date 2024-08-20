import {
  DataPermission,
  DataPermissionValue,
} from "metabase/admin/permissions/types";
import type {
  Table,
  DatabasePermissions,
  GroupTableAccessPolicy,
  PermissionsGraph,
  FieldReference,
} from "metabase-types/api";

type Options = {
  tables: Table[];
  chosenTables: Table[];

  groupIds: number[];
  tenancyColumnNames: Record<string, string>;
};

type Sandbox = Pick<
  GroupTableAccessPolicy,
  "table_id" | "group_id" | "card_id" | "attribute_remappings"
>;

type Graph = Omit<PermissionsGraph, "revision"> & {
  sandboxes: Sandbox[];
};

const PERMISSIONS_BLOCKED: DatabasePermissions = {
  [DataPermission.CREATE_QUERIES]: DataPermissionValue.NO,
  [DataPermission.DOWNLOAD]: { schemas: DataPermissionValue.FULL },
  [DataPermission.VIEW_DATA]: DataPermissionValue.BLOCKED,
};

export function getPermissionGraph(options: Options): Graph {
  const { chosenTables = [], groupIds, tenancyColumnNames } = options;

  const groups: Graph["groups"] = {};
  const sandboxes: Sandbox[] = [];

  // TODO: make these IDs dynamic
  const ALL_USERS_GROUP_ID = 1;
  const SAMPLE_DB_ID = 1;
  const CONNECTED_DB_ID = 2;

  // Block access to everything from the "All Users" group
  groups[ALL_USERS_GROUP_ID] = {
    [SAMPLE_DB_ID]: PERMISSIONS_BLOCKED,
    [CONNECTED_DB_ID]: PERMISSIONS_BLOCKED,
  };

  // Define database permissions for each table.
  const getDatabasePermission = <P extends DataPermissionValue>(
    allow: P,
    deny?: P,
  ) => {
    // Tables could be picked from multiple schemas, so we need to group them by schema.
    const schemas: Record<string, Record<string, P>> = {};

    // Deny access to all unselected tables
    for (const table of options.tables) {
      if (!schemas[table.schema]) {
        schemas[table.schema] = {};
      }

      if (deny) {
        schemas[table.schema][table.id] = deny;
      }
    }

    // Allow (sandboxed) access to selected tables
    for (const table of chosenTables) {
      schemas[table.schema][table.id] = allow;
    }

    return schemas;
  };

  for (const groupId of groupIds) {
    if (!groups[groupId]) {
      groups[groupId] = {};
    }

    groups[groupId][CONNECTED_DB_ID] = {
      [DataPermission.CREATE_QUERIES]: getDatabasePermission(
        DataPermissionValue.QUERY_BUILDER,
      ),

      [DataPermission.DOWNLOAD]: {
        schemas: getDatabasePermission(
          DataPermissionValue.FULL,
          DataPermissionValue.NONE,
        ),
      },

      [DataPermission.VIEW_DATA]: getDatabasePermission(
        DataPermissionValue.SANDBOXED,
        DataPermissionValue.UNRESTRICTED,
      ),
    };
  }

  // Add permissions sandboxing for each table
  for (const tableId in tenancyColumnNames) {
    const table = chosenTables.find(t => Number(t.id) === Number(tableId));

    const tenancyColumnName = tenancyColumnNames[tableId];

    if (!table || !tenancyColumnName) {
      continue;
    }

    for (const groupId of groupIds) {
      const tenancyField = table.fields?.find(
        f => f.name === tenancyColumnName,
      );

      if (!tenancyField) {
        continue;
      }

      // Create a field reference for sandboxing.
      // example: ["field", 243, { "base-type": "type/Integer", "source-field": 263 }]
      const fieldRef: FieldReference = [
        "field",
        Number(tenancyField.id),
        {
          "base-type": tenancyField.base_type,

          // If the tenancy field is a foreign key, we need to reference the source field.
          ...(tenancyField.target?.id && {
            "source-field": tenancyField.target.id,
          }),
        },
      ];

      sandboxes.push({
        group_id: groupId,
        table_id: parseInt(tableId, 10),
        attribute_remappings: {
          [tenancyField.name]: ["dimension", fieldRef],
        },
        card_id: null,
      });
    }
  }

  return { groups, sandboxes };
}
