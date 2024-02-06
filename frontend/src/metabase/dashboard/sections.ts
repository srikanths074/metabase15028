import { t } from "ttag";
import { GRID_WIDTH } from "metabase/lib/dashboard_grid";
import type {
  DashboardCardLayoutAttrs,
  VirtualCard,
  VirtualDashboardCard,
} from "metabase-types/api";
import { createVirtualCard } from "./utils";

type Position = Pick<DashboardCardLayoutAttrs, "col" | "row">;

type SectionDashboardCardAttrs = Partial<VirtualDashboardCard> &
  DashboardCardLayoutAttrs & {
    card: VirtualCard;
    visualization_settings: { virtual_card: VirtualCard };
  };

type LayoutFn = (position: Position) => Array<SectionDashboardCardAttrs>;

export type SectionLayout = {
  id: string;
  label: string;
  getLayout: LayoutFn;
};

const HEADING_HEIGHT = 1;

function createHeadingDashCard({
  size_x = GRID_WIDTH,
  size_y = HEADING_HEIGHT,
  ...opts
}: Partial<VirtualDashboardCard> &
  DashboardCardLayoutAttrs): SectionDashboardCardAttrs {
  const card = createVirtualCard("heading");
  return {
    ...opts,
    card,
    visualization_settings: {
      "dashcard.background": false,
      virtual_card: card,
    },
    size_x,
    size_y,
  };
}

function createPlaceholderDashCard(
  opts: Partial<VirtualDashboardCard> & DashboardCardLayoutAttrs,
): SectionDashboardCardAttrs {
  const card = createVirtualCard("placeholder");
  return {
    ...opts,
    card,
    visualization_settings: { virtual_card: card },
  };
}

const getKpiGridLayout: LayoutFn = position => {
  const heading = createHeadingDashCard({
    ...position,
    size_x: GRID_WIDTH,
    size_y: HEADING_HEIGHT,
  });

  const row = position.row + HEADING_HEIGHT;
  const scalarCardWidth = GRID_WIDTH / 2;
  const scalarCardHeight = 5;

  const row1 = [
    createPlaceholderDashCard({
      col: 0,
      row,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
    createPlaceholderDashCard({
      col: scalarCardWidth,
      row,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
  ];

  const row2 = [
    createPlaceholderDashCard({
      col: 0,
      row: row + scalarCardHeight,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
    createPlaceholderDashCard({
      col: scalarCardWidth,
      row: row + scalarCardHeight,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
  ];

  return [heading, ...row1, ...row2];
};

const getLargeChartKpiColLayout: LayoutFn = position => {
  const heading = createHeadingDashCard({
    ...position,
    size_x: GRID_WIDTH,
    size_y: HEADING_HEIGHT,
  });

  const row = position.row + HEADING_HEIGHT;
  const scalarCardWidth = 7;
  const scalarCardHeight = 3;
  const largeCardWidth = GRID_WIDTH - scalarCardWidth;

  const scalarCardsColumn = [
    createPlaceholderDashCard({
      col: largeCardWidth,
      row: row,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
    createPlaceholderDashCard({
      col: largeCardWidth,
      row: row + scalarCardHeight,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
    createPlaceholderDashCard({
      col: largeCardWidth,
      row: row + scalarCardHeight * 2,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
  ];

  const largeCard = createPlaceholderDashCard({
    col: position.col,
    row,
    size_x: largeCardWidth,
    size_y: scalarCardHeight * scalarCardsColumn.length,
  });

  return [heading, largeCard, ...scalarCardsColumn];
};

export const getKpiLargeChartBelowLayout: LayoutFn = position => {
  const heading = createHeadingDashCard({
    ...position,
    size_x: GRID_WIDTH,
    size_y: HEADING_HEIGHT,
  });

  const row = position.row + HEADING_HEIGHT;
  const scalarCardWidth = GRID_WIDTH / 3;
  const scalarCardHeight = 3;

  const largeCardWidth = GRID_WIDTH;
  const largeCardHeight = 9;

  const scalarCardsRow = [
    createPlaceholderDashCard({
      col: 0,
      row: row,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
    createPlaceholderDashCard({
      col: scalarCardWidth,
      row: row,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
    createPlaceholderDashCard({
      col: scalarCardWidth * 2,
      row: row,
      size_x: scalarCardWidth,
      size_y: scalarCardHeight,
    }),
  ];

  const largeCard = createPlaceholderDashCard({
    col: position.col,
    row: row + scalarCardHeight,
    size_x: largeCardWidth,
    size_y: largeCardHeight,
  });

  return [heading, ...scalarCardsRow, largeCard];
};

export const layoutOptions: SectionLayout[] = [
  {
    id: "kpi-grid",
    label: t`KPI grid`,
    getLayout: getKpiGridLayout,
  },
  {
    id: "lg-chart-kpi-col",
    label: t`Large chart w/ KPIs to the right`,
    getLayout: getLargeChartKpiColLayout,
  },
  {
    id: "kpi-lg-chart-below",
    label: t`KPIs w/ large chart below`,
    getLayout: getKpiGridLayout,
  },
];
