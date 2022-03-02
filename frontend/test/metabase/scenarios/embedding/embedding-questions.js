import { SAMPLE_DATABASE } from "__support__/e2e/cypress_sample_database";

const { ORDERS, ORDERS_ID } = SAMPLE_DATABASE;

export const regularQuestion = {
  name: "Orders4t#7 t3",
  description: "Foo",
  query: {
    "source-table": ORDERS_ID,
    limit: 5,
    expressions: { Math: ["+", 1, 1] },
  },
  visualization_settings: {
    column_settings: {
      [`["ref",["field",${ORDERS.CREATED_AT},null]]`]: {
        date_abbreviate: true,
        date_style: "dddd, MMMM D, YYYY",
        time_enabled: "seconds",
        time_style: "HH:mm",
      },
      [`["ref",["field",${ORDERS.TOTAL},null]]`]: {
        column_title: "Billed",
        number_style: "currency",
        currency_in_header: false,
        currency: "EUR",
        currency_style: "symbol",
      },
      [`["ref",["field",${ORDERS.TAX},null]]`]: { show_mini_bar: true },
    },
  },
};
