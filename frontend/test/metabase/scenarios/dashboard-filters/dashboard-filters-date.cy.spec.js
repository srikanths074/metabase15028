import {
  restore,
  popover,
  filterWidget,
  editDashboard,
  saveDashboard,
  setFilter,
  visitDashboard,
} from "__support__/e2e/helpers";

import { DASHBOARD_DATE_FILTERS } from "./helpers/e2e-dashboard-filter-data-objects";
import * as DateFilter from "../native-filters/helpers/e2e-date-filter-helpers";

describe("scenarios > dashboard > filters > date", () => {
  beforeEach(() => {
    cy.intercept("GET", "/api/table/*/query_metadata").as("metadata");

    restore();
    cy.signInAsAdmin();

    visitDashboard(1);

    editDashboard();
  });

  it(`should work when set through the filter widget`, () => {
    // Add and connect every single available date filter type
    Object.entries(DASHBOARD_DATE_FILTERS).forEach(([filter]) => {
      setFilter("Time", filter);

      cy.findByText("Select…").click();
      popover().contains("Created At").first().click();
    });

    saveDashboard();

    // Go through each of the filters and make sure they work individually
    Object.entries(DASHBOARD_DATE_FILTERS).forEach(
      ([filter, { value, representativeResult }], index) => {
        filterWidget().eq(index).click();

        dateFilterSelector({
          filterType: filter,
          filterValue: value,
        });

        cy.get(".Card").within(() => {
          cy.findByText(representativeResult);
        });

        clearFilter(index);
      },
    );
  });

  // Rather than going through every single filter type,
  // make sure the default filter works for just one of the available options
  it(`should work when set as the default filter`, () => {
    setFilter("Time", "Month and Year");
    cy.findByText("Default value").next().click();

    DateFilter.setMonthAndYear({
      month: "November",
      year: "2016",
    });

    cy.findByText("Select…").click();
    popover().contains("Created At").first().click();

    saveDashboard();

    // The default value should immediately be applied
    cy.get(".Card").within(() => {
      cy.findByText("85.88");
    });

    // Make sure we can override the default value
    cy.findByText("November, 2016").click();
    popover().contains("June").click();
    cy.findByText("33.9");
  });
});

function dateFilterSelector({ filterType, filterValue } = {}) {
  switch (filterType) {
    case "Month and Year":
      DateFilter.setMonthAndYear(filterValue);
      break;

    case "Quarter and Year":
      DateFilter.setQuarterAndYear(filterValue);
      break;

    case "Single Date":
      DateFilter.setSingleDate(filterValue);
      cy.findByText("Update filter").click();
      break;

    case "Date Range":
      DateFilter.setDateRange(filterValue);
      cy.findByText("Update filter").click();
      break;

    case "Relative Date":
      DateFilter.setRelativeDate(filterValue);
      break;

    case "All Options":
      DateFilter.setAdHocFilter(filterValue);
      break;

    default:
      throw new Error("Wrong filter type!");
  }
}

function clearFilter(index) {
  filterWidget().eq(index).find(".Icon-close").click();
  cy.wait("@dashcardQuery1");
}
