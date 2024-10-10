export const isScrollableHorizontally = element => {
  const { clientHeight, offsetHeight } = element;
  const style = window.getComputedStyle(element);
  const borderTopWidth = parseInt(style.borderTopWidth, 10);
  const borderBottomWidth = parseInt(style.borderBottomWidth, 10);
  const borderWidth = borderTopWidth + borderBottomWidth;
  const horizontalScrollbarHeight = offsetHeight - clientHeight - borderWidth;
  const isHorizontalScrollbarVisible = horizontalScrollbarHeight > 0;

  return isHorizontalScrollbarVisible;
};

export const isScrollableVertically = element => {
  const { clientWidth, offsetWidth } = element;
  const style = window.getComputedStyle(element);
  const borderLeftWidth = parseInt(style.borderLeftWidth, 10);
  const borderRightWidth = parseInt(style.borderRightWidth, 10);
  const borderWidth = borderLeftWidth + borderRightWidth;
  const verticalScrollbarWidth = offsetWidth - clientWidth - borderWidth;
  const isVerticalScrollbarVisible = verticalScrollbarWidth > 0;

  return isVerticalScrollbarVisible;
};

export const assertDescendantNotOverflowsContainer = (
  descendant,
  container,
  message,
) => {
  const containerRect = container.getBoundingClientRect();
  const descendantRect = descendant.getBoundingClientRect();

  if (descendantRect.height === 0 || descendantRect.width === 0) {
    return;
  }

  cy.wrap(descendantRect.bottom).should("be.lte", containerRect.bottom);
  cy.wrap(descendantRect.top).should("be.gte", containerRect.top);
  cy.wrap(descendantRect.left).should("be.gte", containerRect.left);
  cy.wrap(descendantRect.right).should("be.lte", containerRect.right);
};

export const assertIsEllipsified = element => {
  expect(isEllipsified(element), "is ellipsified").to.equal(true);
};

export const assertIsNotEllipsified = element => {
  expect(isEllipsified(element), "is ellipsified").to.equal(false);
};

export const isEllipsified = element => {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
};
