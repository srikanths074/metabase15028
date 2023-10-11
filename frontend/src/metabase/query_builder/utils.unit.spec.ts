import { createMockLocation } from "__support__/location";
import { createMockMetadata } from "__support__/metadata";
import { getNextId } from "__support__/utils";
import {
  createMockCard,
  createMockNativeDatasetQuery,
} from "metabase-types/api/mocks";
import { checkNotNull } from "metabase/core/utils/types";

import { isNavigationAllowed } from "./utils";

const notebookCard = createMockCard({
  id: getNextId(),
});

const nativeCard = createMockCard({
  id: getNextId(),
  dataset_query: createMockNativeDatasetQuery(),
});

const notebookModelCard = createMockCard({
  id: getNextId(),
  dataset: true,
});

const nativeModelCard = createMockCard({
  id: getNextId(),
  dataset: true,
  dataset_query: createMockNativeDatasetQuery(),
});

const cards = [notebookCard, nativeCard, notebookModelCard, nativeModelCard];

const metadata = createMockMetadata({ questions: cards });

const notebookQuestion = checkNotNull(metadata.question(notebookCard.id));

const nativeQuestion = checkNotNull(metadata.question(nativeCard.id));

const notebookModelQuestion = checkNotNull(
  metadata.question(notebookModelCard.id),
);

const nativeModelQuestion = checkNotNull(metadata.question(nativeModelCard.id));

const questions = [
  notebookQuestion,
  nativeQuestion,
  notebookModelQuestion,
  nativeModelQuestion,
];

const anyLocation = createMockLocation();

const newModelQueryTabLocation = createMockLocation({
  pathname: `/model/query`,
});

const newModelMetadataTabLocation = createMockLocation({
  pathname: `/model/metadata`,
});

const modelQueryTabLocation = createMockLocation({
  pathname: `/model/${notebookModelCard.id}/query`,
});

const modelMetadataTabLocation = createMockLocation({
  pathname: `/model/${notebookModelCard.id}/metadata`,
});

const runQuestionLocation = createMockLocation({
  pathname: "/question",
  hash: `#${window.btoa(JSON.stringify(nativeCard))}`,
});

const locations = [
  anyLocation,
  modelQueryTabLocation,
  modelMetadataTabLocation,
  runQuestionLocation,
];

describe("isNavigationAllowed", () => {
  describe("when there is no destination (i.e. it's a beforeunload event)", () => {
    const destination = undefined;
    const testQuestions = [...questions, undefined];

    it("always allows navigating away from creating new question", () => {
      const isNewQuestion = true;

      for (const question of testQuestions) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(true);
      }
    });

    it("always allows navigating away from editing question", () => {
      const isNewQuestion = false;

      for (const question of questions) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(true);
      }
    });
  });

  describe("when creating new question", () => {
    const isNewQuestion = true;

    it("always allows navigating away from creating new question", () => {
      const questions = [notebookQuestion, nativeQuestion, undefined];
      const destinations = [...locations, undefined];

      for (const question of questions) {
        for (const destination of destinations) {
          expect(
            isNavigationAllowed({ destination, question, isNewQuestion }),
          ).toBe(true);
        }
      }
    });
  });

  describe("when editing notebook question", () => {
    const isNewQuestion = false;
    const question = notebookQuestion;
    const destinations = [...locations, undefined];

    it("always allows navigating away from editing notebook question", () => {
      for (const destination of destinations) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(true);
      }
    });
  });

  describe("when editing native question", () => {
    const isNewQuestion = false;
    const question = nativeQuestion;

    it("allows to run the question", () => {
      const destination = runQuestionLocation;

      expect(
        isNavigationAllowed({ destination, question, isNewQuestion }),
      ).toBe(true);
    });

    it("disallows all other navigation", () => {
      const destination = anyLocation;

      expect(
        isNavigationAllowed({ destination, question, isNewQuestion }),
      ).toBe(false);
    });
  });

  describe("when creating new model", () => {
    const isNewQuestion = true;
    const question = notebookModelQuestion;

    it("does not allow navigating away from creating new model", () => {
      const destinations = [...locations];

      for (const destination of destinations) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(false);
      }
    });

    it("allows navigating between model query & metadata tabs", () => {
      const destinations = [
        newModelQueryTabLocation,
        newModelMetadataTabLocation,
      ];

      for (const destination of destinations) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(true);
      }
    });
  });

  describe("when editing notebook model", () => {
    const isNewQuestion = false;
    const question = notebookModelQuestion;

    it("allows navigating between model query & metadata tabs", () => {
      const destinations = [modelQueryTabLocation, modelMetadataTabLocation];

      for (const destination of destinations) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(true);
      }
    });

    it("disallows all other navigation", () => {
      const destination = anyLocation;

      expect(
        isNavigationAllowed({ destination, question, isNewQuestion }),
      ).toBe(false);
    });
  });

  describe("when editing native-query model", () => {
    const isNewQuestion = false;
    const question = nativeModelQuestion;

    it("allows navigating between model query & metadata tabs", () => {
      const destinations = [modelQueryTabLocation, modelMetadataTabLocation];

      for (const destination of destinations) {
        expect(
          isNavigationAllowed({ destination, question, isNewQuestion }),
        ).toBe(true);
      }
    });

    it("disallows all other navigation", () => {
      const destination = anyLocation;

      expect(
        isNavigationAllowed({ destination, question, isNewQuestion }),
      ).toBe(false);
    });
  });
});
