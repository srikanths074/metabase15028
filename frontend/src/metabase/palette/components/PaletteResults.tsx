import { useKBar, useMatches } from "kbar";
import { useMemo } from "react";
import { useKeyPressEvent } from "react-use";
import _ from "underscore";

import { color } from "metabase/lib/colors";
import { Flex, Box } from "metabase/ui";

import { useCommandPalette } from "../hooks/useCommandPalette";
import type { PaletteAction } from "../types";
import { processResults, findClosesestActionIndex } from "../utils";

import { PaletteResultItem } from "./PaletteResultItem";
import { PaletteResultList } from "./PaletteResultsList";

const PAGE_SIZE = 4;

export const PaletteResults = () => {
  // Used for finding actions within the list
  const { query } = useKBar();

  useCommandPalette();

  const { results } = useMatches();

  const processedResults = useMemo(() => processResults(results), [results]);

  useKeyPressEvent("End", () => {
    const lastIndex = processedResults.length - 1;
    query.setActiveIndex(lastIndex);
  });

  useKeyPressEvent("Home", () => {
    query.setActiveIndex(1);
  });

  useKeyPressEvent("PageDown", () => {
    query.setActiveIndex(i =>
      findClosesestActionIndex(processedResults, i, PAGE_SIZE),
    );
  });

  useKeyPressEvent("PageUp", () => {
    query.setActiveIndex(i =>
      findClosesestActionIndex(processedResults, i, -PAGE_SIZE),
    );
  });

  return (
    <Flex align="stretch" direction="column" p="0.75rem 0">
      <PaletteResultList
        items={processedResults} // items needs to be a stable reference, otherwise the activeIndex will constantly be hijacked
        maxHeight={530}
        onRender={({
          item,
          active,
        }: {
          item: string | PaletteAction;
          active: boolean;
        }) => {
          const isFirst = processedResults[0] === item;

          return (
            <Flex lh="1rem" pb="2px">
              {typeof item === "string" ? (
                <Box
                  px="1.5rem"
                  fz="14px"
                  pt="1rem"
                  pb="0.5rem"
                  style={
                    isFirst
                      ? undefined
                      : {
                          borderTop: `1px solid ${color("border")}`,
                          marginTop: "1rem",
                        }
                  }
                  w="100%"
                >
                  {item}
                </Box>
              ) : (
                <PaletteResultItem item={item} active={active} />
              )}
            </Flex>
          );
        }}
      />
    </Flex>
  );
};
