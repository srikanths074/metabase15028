/* @flow weak */

// Database Edit
export const getEditingDatabase = state =>
  state.admin.databases.editingDatabase;
export const getDatabaseCreationStep = state =>
  state.admin.databases.databaseCreationStep;

// Database List
export const getDeletes = state => state.admin.databases.deletes;
export const getDeletionError = state => state.admin.databases.deletionError;

export const getIsFetchingSampleDataset = state =>
  state.admin.databases.fetchingSampleDataset;
