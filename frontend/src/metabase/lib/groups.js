import { t } from "ttag";
import { color } from "metabase/lib/colors";

const SPECIAL_GROUP_NAMES = new Map([
  ["All Users", t`All Users`],
  ["Administrators", t`Administrators`],
]);

export function isDefaultGroup(group) {
  return group.name === "All Users";
}

export function isAdminGroup(group) {
  return group.name === "Administrators";
}

export function canEditPermissions(group) {
  return !isAdminGroup(group);
}

export function canEditMembership(group) {
  return !isDefaultGroup(group);
}

export function getGroupColor(group) {
  return isAdminGroup(group)
    ? color("filter")
    : isDefaultGroup(group)
    ? color("text-medium")
    : color("brand");
}

export function getGroupNameLocalized(group) {
  if (SPECIAL_GROUP_NAMES.has(group.name)) {
    return SPECIAL_GROUP_NAMES.get(group.name);
  } else {
    return group.name;
  }
}
