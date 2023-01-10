import { createMockParameter } from "metabase-types/api/mocks";
import { isSingleOrMultiSelectable } from "./parameter-type";

describe("isSingleOrMultiSelectable", () => {
  it("is false for parameters with types not included", () => {
    const parameter = createMockParameter({
      sectionId: "number",
    });
    expect(isSingleOrMultiSelectable(parameter)).toBe(false);
  });

  it("is false for parameters with acceptable types and rejected subTypes", () => {
    const parameter = createMockParameter({
      sectionId: "string",
    });
    expect(isSingleOrMultiSelectable(parameter)).toBe(false);
  });

  it("is true for parameters with acceptable types and corresponding subTypes", () => {
    const parameter = createMockParameter({
      sectionId: "location",
      type: "string/=",
    });
    expect(isSingleOrMultiSelectable(parameter)).toBe(true);
  });
});
