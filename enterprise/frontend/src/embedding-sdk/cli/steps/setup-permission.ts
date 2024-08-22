import { search } from "@inquirer/prompts";
import chalk from "chalk";
import toggle from "inquirer-toggle";

import { SANDBOXED_GROUP_NAMES } from "../constants/config";
import { NOT_ENOUGH_TENANCY_COLUMN_ROWS } from "../constants/messages";
import type { CliStepMethod } from "../types/cli";
import { getCollectionPermissions } from "../utils/get-collection-permissions";
import { getPermissionsForGroups } from "../utils/get-permission-groups";
import { getTenancyIsolationSandboxes } from "../utils/get-tenancy-isolation-sandboxes";
import { printHelperText } from "../utils/print";
import {
  cliError,
  propagateErrorResponse,
} from "../utils/propagate-error-response";
import { sampleTenantIdsFromTables } from "../utils/sample-tenancy-column-values";

export const setupPermissions: CliStepMethod = async state => {
  const { cookie = "", instanceUrl = "" } = state;

  printHelperText(
    `e.g. does your table have a customer_id column to isolate tenants?`,
  );

  const hasTenancyIsolation = await toggle({
    message: `Is your tenancy isolation based on a column?`,
    default: true,
  });

  if (!hasTenancyIsolation) {
    return [{ type: "success" }, state];
  }

  if (!state.chosenTables) {
    const message = "You have not selected any tables.";

    return [{ type: "error", message }, state];
  }

  const tenancyColumnNames: Record<string, string> = {};

  for (const table of state.chosenTables) {
    const fieldChoices = [
      { name: "(no multi-tenancy column for this table)", value: null },
      ...(table.fields?.map(f => ({ name: f.name, value: f.name })) ?? []),
    ];

    const columnName = await search({
      pageSize: 10,
      message: `What is the multi-tenancy column for ${table.name}?`,
      source(term) {
        return term
          ? fieldChoices.filter(choice => choice.name.includes(term))
          : fieldChoices;
      },
    });

    if (columnName) {
      tenancyColumnNames[table.id] = columnName;
    }
  }

  if (Object.keys(tenancyColumnNames).length === 0) {
    const message = "Your tables do not have any multi-tenancy column.";

    return [{ type: "error", message }, state];
  }

  let res;
  const collectionIds: number[] = [];

  // Create new collections sequentially
  try {
    for (const groupName of SANDBOXED_GROUP_NAMES) {
      res = await fetch(`${instanceUrl}/api/collection`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          parent_id: null,
          authority_level: null,
          color: "#509EE3",
          description: null,
          name: groupName,
        }),
      });

      await propagateErrorResponse(res);

      const { id: collectionId } = (await res.json()) as { id: number };
      collectionIds.push(collectionId);
    }
  } catch (error) {
    const message = `Failed to create sandboxed collections`;

    return [cliError(message, error), state];
  }

  // Example: { "Customer A": [3], "Customer B": [4], "Customer C": [5] }
  const jwtGroupMappings: Record<string, number[]> = {};

  try {
    // Create new permission groups
    for (const groupName of SANDBOXED_GROUP_NAMES) {
      res = await fetch(`${instanceUrl}/api/permissions/group`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ name: groupName }),
      });

      await propagateErrorResponse(res);

      const { id: groupId } = (await res.json()) as { id: number };

      jwtGroupMappings[groupName] = [groupId];
    }

    // Update the JWT group mappings.
    res = await fetch(`${instanceUrl}/api/setting/jwt-group-mappings`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ value: jwtGroupMappings }),
    });

    await propagateErrorResponse(res);
  } catch (error) {
    const message = `Failed to define SSO group mappings`;

    return [cliError(message, error), state];
  }

  const groupIds: number[] = Object.values(jwtGroupMappings).flat();

  try {
    const options = {
      tables: state.tables ?? [],
      chosenTables: state.chosenTables,
      groupIds,
      tenancyColumnNames,
    };

    const permissionGraph = {
      groups: getPermissionsForGroups(options),
      sandboxes: getTenancyIsolationSandboxes(options),
      revision: 0,
      impersonations: [],
    };

    // Update the permissions graph with sandboxed permissions
    res = await fetch(`${instanceUrl}/api/permissions/graph`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(permissionGraph),
    });

    await propagateErrorResponse(res);
  } catch (error) {
    const message = "Failed to update permissions";

    return [cliError(message, error), state];
  }

  try {
    const groups = getCollectionPermissions({ groupIds, collectionIds });

    // Update the permissions for sandboxed collections
    res = await fetch(`${instanceUrl}/api/collection/graph`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        groups,
        revision: 0,
        skip_graph: true,
      }),
    });

    await propagateErrorResponse(res);
  } catch (error) {
    const message = `Failed to update collection permissions`;

    return [cliError(message, error), state];
  }

  try {
    const tenantIds = await sampleTenantIdsFromTables({
      chosenTables: state.chosenTables,
      databaseId: state.databaseId ?? 0,
      tenancyColumnNames,

      cookie,
      instanceUrl,
    });

    // The tables don't have enough tenancy column values.
    // They have to set up the "customer_id" user attribute by themselves.
    if (!tenantIds) {
      console.log(chalk.yellow(NOT_ENOUGH_TENANCY_COLUMN_ROWS));

      return [{ type: "success" }, state];
    }

    return [{ type: "success" }, { ...state, tenantIds }];
  } catch (error) {
    const message = `Failed to query tenancy column values (e.g. customer_id)`;

    return [cliError(message, error), state];
  }
};
