import fetchMock from "fetch-mock";

import {
  uploadFile,
  UPLOAD_FILE_TO_COLLECTION_CLEAR,
  UPLOAD_FILE_TO_COLLECTION_END,
  UPLOAD_FILE_TO_COLLECTION_ERROR,
  UPLOAD_FILE_TO_COLLECTION_START,
} from "./uploads";

const now = Date.now();

const mockUploadCSV = (valid = true) => {
  fetchMock.post(
    "path:/api/card/from-csv",
    valid
      ? {
          model_id: 3,
        }
      : {
          throws: { data: { message: "It's dead Jim" } },
        },
  );
};

describe("csv uploads", () => {
  describe("actions", () => {
    let dispatch;
    const file = new File(
      [new Blob(["col1, col2 \n val1, val2"])],
      "test.csv",
      {
        type: "text/csv",
      },
    );

    beforeEach(() => {
      dispatch = jest.fn();
      jest.useFakeTimers().setSystemTime(now);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("should handle file upload success", async () => {
      mockUploadCSV();

      await uploadFile(file, "root")(dispatch);
      jest.advanceTimersByTime(6000);

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_START,
        payload: {
          id: now,
          name: "test.csv",
          collectionId: "root",
        },
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_END,
        payload: {
          id: now,
          modelId: 3,
        },
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_CLEAR,
        payload: {
          id: now,
        },
      });
    });

    it("should handle file upload error", async () => {
      mockUploadCSV(false);

      await uploadFile(file, "root")(dispatch);
      jest.advanceTimersByTime(6000);

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_START,
        payload: {
          id: now,
          name: "test.csv",
          collectionId: "root",
        },
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_ERROR,
        payload: {
          id: now,
          message: "It's dead Jim",
        },
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_CLEAR,
        payload: {
          id: now,
        },
      });
    });

    it("Error on oversized files", async () => {
      const bigFile = new File([""], "test.csv");
      Object.defineProperty(bigFile, "size", { value: 200 * 1024 * 1024 + 1 });
      await uploadFile(bigFile, "root")(dispatch);
      jest.advanceTimersByTime(6000);

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_START,
        payload: {
          id: now,
          name: "test.csv",
          collectionId: "root",
        },
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_ERROR,
        payload: {
          id: now,
          message: "You cannot upload files larger than 200MB",
        },
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: UPLOAD_FILE_TO_COLLECTION_CLEAR,
        payload: {
          id: now,
        },
      });
    });
  });
});
