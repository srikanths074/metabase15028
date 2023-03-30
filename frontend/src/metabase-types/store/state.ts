import { User } from "metabase-types/api";
import { AdminState } from "./admin";
import { AppState } from "./app";
import { DashboardState } from "./dashboard";
import { EmbedState } from "./embed";
import { EntitiesState } from "./entities";
import { QueryBuilderState } from "./qb";
import { ParametersState } from "./parameters";
import { SettingsState } from "./settings";
import { SetupState } from "./setup";

export interface State {
  admin: AdminState;
  app: AppState;
  currentUser: User | null;
  dashboard: DashboardState;
  embed: EmbedState;
  entities: EntitiesState;
  qb: QueryBuilderState;
  parameters: ParametersState;
  settings: SettingsState;
  setup: SetupState;
  upload: any;
}

export type Dispatch<T = any> = (action: T) => void;

export type GetState = () => State;

export type ReduxAction<Type = string, Payload = any> = {
  type: Type;
  payload: Payload;
  error?: string;
};
