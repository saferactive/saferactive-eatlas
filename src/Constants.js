function define(name, value) {
  Object.defineProperty(exports, name, {
    value: value,
    enumerable: true
  });
}

// TODO: change to domain name 
define("PRD_URL", 'https://map.saferactive.org');
define("DEV_URL", 'http://localhost:8000');
define("UI_LIST", [
  "checkbox",
  "radio",
  "buttongroups",
  "dropdown",
  "slider"]) 
define("LAYERSTYLES", [
  // "geojson",
  "grid",
  "heatmap",
  "hex",
  "icon",
  // "line",
  // "path",
  // "scatterplot",
  "sgrid"
])     
