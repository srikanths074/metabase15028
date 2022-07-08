import React from "react";
import { render, screen } from "@testing-library/react";
import Question from "metabase-lib/lib/Question";
import { createMockCard } from "metabase-types/api/mocks";
import QuestionCacheSection, {
  QuestionCacheSectionProps,
} from "./QuestionCacheSection";

describe("QuestionCacheSection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 0, 10));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should show the time of the last cached query", () => {
    const props = getProps({
      question: new Question(
        createMockCard({
          last_query_start: "2020-01-05T00:00:00Z",
        }),
      ),
    });

    render(<QuestionCacheSection {...props} />);

    expect(
      screen.getByText("Question last cached 5 days ago"),
    ).toBeInTheDocument();
  });
});

const getProps = (
  opts?: Partial<QuestionCacheSectionProps>,
): QuestionCacheSectionProps => ({
  question: new Question(createMockCard()),
  onSave: jest.fn(),
  ...opts,
});
