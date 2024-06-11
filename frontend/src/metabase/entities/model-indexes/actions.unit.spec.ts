import type { MockCall } from "fetch-mock";
import fetchMock from "fetch-mock";

import { getStore } from "__support__/entities-store";
import { setupModelIndexEndpoints } from "__support__/server-mocks";
import { Api, listModelIndexes } from "metabase/api";
import Question from "metabase-lib/v1/Question";
import type { FieldReference, ModelIndex, Field } from "metabase-types/api";
import {
  createMockField as createBaseMockField,
  createMockCard,
  createMockModelIndex,
} from "metabase-types/api/mocks";

import type { FieldWithMaybeIndex } from "./actions";
import { updateModelIndexes, cleanIndexFlags } from "./actions";

const createMockField = (options?: Partial<FieldWithMaybeIndex>): Field => {
  return createBaseMockField(options as Partial<Field>);
};

const createModelWithResultMetadata = (fields: Field[]) => {
  return new Question(
    createMockCard({ result_metadata: fields, type: "model" }),
  );
};

const setup = () => {
  const store = getStore({ [Api.reducerPath]: Api.reducer }, {}, [
    Api.middleware,
  ]);

  const dispatchSpy = jest.spyOn(store, "dispatch");
  const getStateSpy = jest.spyOn(store, "getState");

  return {
    dispatch: store.dispatch,
    getState: store.getState,
    dispatchSpy,
    getStateSpy,
  };
};

describe("Entities > model-indexes > actions", () => {
  describe("cleanIndexFlags", () => {
    it("should remove should_index flag from fields", () => {
      const model = createModelWithResultMetadata([
        createMockField({ should_index: true }),
        createMockField({ should_index: false }),
        createMockField(),
      ]);

      const cleanedFields = cleanIndexFlags(model.getResultMetadata());

      cleanedFields.forEach((field: any) => {
        expect(field?.should_index).toBeUndefined();
      });
    });

    it("should not mutate the original question", () => {
      const model = createModelWithResultMetadata([
        createMockField({ should_index: true }),
        createMockField({ should_index: true }),
      ]);

      cleanIndexFlags(model.getResultMetadata());

      model.getResultMetadata().forEach((field: any) => {
        expect(field?.should_index).toBe(true);
      });
    });
  });
  describe("updateModelIndexes", () => {
    it("should not do anything if there are no fields with should_index flag", async () => {
      const model = createModelWithResultMetadata([
        createMockField(),
        createMockField(),
      ]);

      const { dispatch, getState, dispatchSpy, getStateSpy } = setup();
      await updateModelIndexes(model)(dispatch, getState);

      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(getStateSpy).not.toHaveBeenCalled();
    });

    it("should make a POST call for a newly-added index field", async () => {
      const pkFieldRef: FieldReference = ["field", 1, null];
      const indexFieldRef: FieldReference = ["field", 2, null];

      const model = createModelWithResultMetadata([
        createMockField({ field_ref: pkFieldRef, semantic_type: "type/PK" }),
        createMockField({ should_index: true, field_ref: indexFieldRef }),
        createMockField(),
      ]);

      setupModelIndexEndpoints(model.id(), []);

      const { dispatch, getState, dispatchSpy, getStateSpy } = setup();

      await updateModelIndexes(model)(dispatch, getState);

      expect(dispatchSpy).toHaveBeenCalled();
      expect(getStateSpy).toHaveBeenCalled();

      const [, options] = (await fetchMock.lastCall()) as MockCall;

      expect(options?.method).toBe("POST");
      // @ts-expect-error ???
      const body = JSON.parse(await options?.body) as Partial<ModelIndex>;
      expect(body.model_id).toBe(model.id());
      expect(body.pk_ref).toEqual(pkFieldRef);
      expect(body.value_ref).toEqual(indexFieldRef);
    });

    it("should make a DELETE call to remove an index field", async () => {
      const pkFieldRef: FieldReference = ["field", 1, null];
      const indexFieldRef: FieldReference = ["field", 2, null];

      const model = createModelWithResultMetadata([
        createMockField({ field_ref: pkFieldRef, semantic_type: "type/PK" }),
        createMockField({ should_index: false, field_ref: indexFieldRef }),
        createMockField(),
      ]);

      const existingModelIndex = createMockModelIndex({
        id: 99,
        model_id: 1,
        value_ref: indexFieldRef,
      });

      setupModelIndexEndpoints(1, [existingModelIndex]);

      const { dispatch, getState, dispatchSpy, getStateSpy } = setup();

      await dispatch(listModelIndexes.initiate({ model_id: 1 }));

      await updateModelIndexes(model)(dispatch, getState);

      expect(dispatchSpy).toHaveBeenCalled();
      expect(getStateSpy).toHaveBeenCalled();

      const [url, options] = (await fetchMock.lastCall(
        undefined,
        "DELETE",
      )) as MockCall;

      expect(url).toContain("/api/model-index/99");
      expect(options?.method).toBe("DELETE");
    });

    it("should not create a new index if there is already one for the field", async () => {
      const pkFieldRef: FieldReference = ["field", 1, null];
      const indexFieldRef: FieldReference = ["field", 2, null];

      const model = createModelWithResultMetadata([
        createMockField({ field_ref: pkFieldRef, semantic_type: "type/PK" }),
        createMockField({ should_index: true, field_ref: indexFieldRef }),
        createMockField(),
      ]);

      const existingModelIndex = createMockModelIndex({
        id: 99,
        value_ref: indexFieldRef,
      });

      setupModelIndexEndpoints(1, [existingModelIndex]);

      const { dispatch, getState, dispatchSpy, getStateSpy } = setup();

      await dispatch(listModelIndexes.initiate({ model_id: 1 }));

      await updateModelIndexes(model)(dispatch, getState);

      expect(dispatchSpy).toHaveBeenCalled();
      expect(getStateSpy).toHaveBeenCalled();

      const response = await fetchMock.lastCall(undefined, "POST");

      // no calls to fetch
      expect(response).toBeUndefined();
    });

    it("should not delete an index if there is no index for the field", async () => {
      const pkFieldRef: FieldReference = ["field", 1, null];
      const indexFieldRef: FieldReference = ["field", 2, null];

      const model = createModelWithResultMetadata([
        createMockField({ field_ref: pkFieldRef, semantic_type: "type/PK" }),
        createMockField({ should_index: false, field_ref: indexFieldRef }),
        createMockField(),
      ]);

      setupModelIndexEndpoints(model.id(), []);

      const { dispatch, getState, dispatchSpy, getStateSpy } = setup();

      await updateModelIndexes(model)(dispatch, getState);

      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(getStateSpy).toHaveBeenCalled();

      const response = await fetchMock.lastCall();

      // no calls to fetch
      expect(response).toBeUndefined();
    });
  });
});
