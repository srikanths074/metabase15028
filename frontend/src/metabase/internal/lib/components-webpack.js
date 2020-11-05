// get all the jsx (component) files in the main components directory
const allComponents = require.context("metabase/components", true, /\.(jsx)$/);

// import modules with .info.js in /components (http://stackoverflow.com/a/31770875)
const documentedComponents = require.context(
  "metabase/components",
  true,
  // only match files that have .info.js
  /^(.*\.info\.(js$))[^.]*$/im,
);

const documentedContainers = require.context(
  "metabase/containers",
  true,
  // only match files that have .info.js
  /^(.*\.info\.(js$))[^.]*$/im,
);

function getComponents(req) {
  return req
    .keys()
    .map(key => Object.assign({}, req(key), { showExample: true }));
}

const guideComponents = [
  ...getComponents(documentedComponents),
  ...getComponents(documentedContainers),
];

// we'll consider all containers and components with .info.js files to be "documented" in some form
const documented = getComponents(documentedComponents).length;

const total = getComponents(allComponents).length;

export const stats = {
  total,
  documented,
  ratio: documented / total,
};

export default guideComponents;
