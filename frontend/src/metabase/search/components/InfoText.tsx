import { t, jt } from "ttag";

import * as Urls from "metabase/lib/urls";

import { Icon } from "metabase/core/components/Icon";
import Link from "metabase/core/components/Link";

import Schema from "metabase/entities/schemas";
import Database from "metabase/entities/databases";
import Table from "metabase/entities/tables";
import { PLUGIN_COLLECTIONS } from "metabase/plugins";
import { getTranslatedEntityName } from "metabase/nav/utils";

import type { Collection } from "metabase-types/api";
import type TableType from "metabase-lib/metadata/Table";

import { CollectionBadge } from "./CollectionBadge";
import type { WrappedResult } from "./types";

function getInfoText(result: WrappedResult) {
  switch (result.model) {
    case "card":
      return jt`Saved question in ${formatCollection(
        result,
        result.getCollection(),
      )}`;
    case "dataset":
      return jt`Model in ${formatCollection(result, result.getCollection())}`;
    case "collection":
      return getCollectionInfoText(result.collection);
    case "database":
      return t`Database`;
    case "table":
      return <TablePath result={result} />;
    case "segment":
      return jt`Segment of ${(<TableLink result={result} />)}`;
    case "metric":
      return jt`Metric for ${(<TableLink result={result} />)}`;
    case "action":
      return jt`for ${result.model_name}`;
    case "indexed-entity":
      return jt`in ${result.model_name}`;
    default:
      return jt`${getTranslatedEntityName(result.model)} in ${formatCollection(
        result,
        result.getCollection(),
      )}`;
  }
}

export function InfoText({ result }: { result: WrappedResult }) {
  return <>{getInfoText(result)}</>;
}

function formatCollection(
  result: WrappedResult,
  collection: Partial<Collection>,
) {
  return (
    collection.id && (
      <CollectionBadge key={result.model} collection={collection} />
    )
  );
}

function getCollectionInfoText(collection: Partial<Collection>) {
  if (
    PLUGIN_COLLECTIONS.isRegularCollection(collection) ||
    !collection.authority_level
  ) {
    return t`Collection`;
  }
  const level = PLUGIN_COLLECTIONS.AUTHORITY_LEVEL[collection.authority_level];
  return `${level.name} ${t`Collection`}`;
}

function TablePath({ result }: { result: WrappedResult }) {
  return (
    <>
      {jt`Table in ${(
        <span key="table-path">
          <Database.Link id={result.database_id} />{" "}
          {result.table_schema && (
            <Schema.ListLoader
              query={{ dbId: result.database_id }}
              loadingAndErrorWrapper={false}
            >
              {({ list }: { list: typeof Schema[] }) =>
                list?.length > 1 ? (
                  <span>
                    <Icon name="chevronright" size={10} />
                    {/* we have to do some {} manipulation here to make this look like the table object that browseSchema was written for originally */}
                    <Link
                      to={Urls.browseSchema({
                        db: { id: result.database_id },
                        schema_name: result.table_schema,
                      } as TableType)}
                    >
                      {result.table_schema}
                    </Link>
                  </span>
                ) : null
              }
            </Schema.ListLoader>
          )}
        </span>
      )}`}
    </>
  );
}

function TableLink({ result }: { result: WrappedResult }) {
  return (
    <Link to={Urls.tableRowsQuery(result.database_id, result.table_id)}>
      <Table.Loader id={result.table_id} loadingAndErrorWrapper={false}>
        {({ table }: { table: TableType }) =>
          table ? <span>{table.display_name}</span> : null
        }
      </Table.Loader>
    </Link>
  );
}
