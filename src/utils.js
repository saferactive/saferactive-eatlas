import React from 'react';
import {
  ScatterplotLayer, HexagonLayer, GeoJsonLayer,
  ScreenGridLayer, GridLayer, LineLayer,
  HeatmapLayer,
  TextLayer
} from 'deck.gl';
import {
  interpolateOrRd, // schemeBlues
} from 'd3-scale-chromatic';

import qs from 'qs'; // warning: importing it otherways would cause minificatino issue.

import mapping from './location-icon-mapping.json';
import Constants from './Constants';
import { isString, isNumber } from './JSUtils.js';
import IconClusterLayer from './icon-cluster-layer';
import { ArcLayer, PathLayer } from '@deck.gl/layers';

const getResultsFromGoogleMaps = (string, callback) => {

  if (typeof (string) === 'string' && typeof (callback) === 'function') {
    let fullURL = "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      string
      + "&key=WRONG_KEY";
    // console.log(fullURL);
    fetch(fullURL)
      .then((response) => {
        if (response.status !== 200) {
          console.log('Looks like there was a problem. Status Code: ' +
            response.status);
          return;
        }
        // Examine the text in the response
        response.json()
          .then((data) => {
            //rouch search results will do.
            if (data.results.length === 0 || response.status === 'ZERO_RESULTS') {
              callback(response.status);
            } else {
              callback(data.results[0].geometry.location)
            }
          });
      })
      .catch((err) => {
        console.log('Fetch Error :-S', err);
      });

  }
  //ignore
};

const fetchData = (url, callback) => {
  fetch(url) // [0] => "", [1] => roads and [2] => qfactor
    .then((response) => response.text())
    .then((response) => {
      try {
        const json = JSON.parse(response);
        // console.log(json);
        callback(json)
      } catch (error) {
        callback(undefined, error)
      }
    })
    .catch((error) => {
      console.error(error);
      callback(null, error)
    });

}

/**
 * Function to count frequency of values of `property` given.
 * 
 * TODO: Double check to see if it is slightly different
 * version of propertyCount
 * 
 * 
 * @param {Object} data 
 * @param {String} property 
 * @param {Boolean} noNulls 
 */
const xyObjectByProperty = (data, property, noNulls = true) => {
  if (!data || !property) return;
  //data = [{...data = 12/12/12}]       
  const map = new Map()
  data.forEach(feature => {
    let value = feature.properties[property];
    if (typeof (value) === 'string' && value.split("/")[2]) {
      value = value.split("/")[2]
    }
    if (noNulls && value !== null) { // remove nulls here
      if (map.get(value)) {
        map.set(value, map.get(value) + 1)
      } else {
        map.set(typeof value === 'number' ? +(value) : value, 1)
      }
    }
  });
  const sortedMap = typeof Array.from(map.keys())[0] === 'number' ?
    Array.from(map.keys()).sort() : Array.from(map.keys())

  return sortedMap.map(key => {
    return (
      {
        x: key,
        y: +(map.get(key))
      }
    )
  })
}

const generateDeckLayer = (name, data, renderTooltip, options) => {
  const addOptionsToObject = (opt, obj) => {
    Object.keys(opt).forEach(key =>
      obj[key] = opt[key]
    )
  }
  if (name === 'hex') {
    const hexObj = {
      id: 'hexagon-layer',
      data: data,
      pickable: true,
      extruded: true,
      radius: 100,
      elevationScale: 1,
      getPosition: d => d.geometry.coordinates,
      onHover: renderTooltip
    }
    addOptionsToObject(options, hexObj)
    return (new HexagonLayer(hexObj))
  } else if (name === 'hex') {
    const scatterObj = {
      id: 'scatterplot-layer',
      data,
      pickable: true,
      opacity: 0.8,
      radiusScale: 6,
      radiusMinPixels: 1,
      radiusMaxPixels: 100,
      getPosition: d => d.geometry.coordinates,
      getRadius: d => Math.sqrt(d.exits),
      getColor: d => [255, 140, 0],
      onHover: renderTooltip
    }
    addOptionsToObject(options, scatterObj)
    return (new ScatterplotLayer(scatterObj))
  } else if (name === 'geojson') {
    const geojsonObj = {
      id: 'geojson-layer',
      data,
      pickable: true,
      stroked: false,
      filled: true,
      extruded: true,
      lineWidthScale: 20,
      lineWidthMinPixels: 2,
      getFillColor: [160, 160, 180, 200],
      getLineColor: [255, 160, 180, 200],
      getRadius: 100,
      getLineWidth: 1,
      getElevation: 30,
      onHover: renderTooltip
    }
    addOptionsToObject(options, geojsonObj)
    return (new GeoJsonLayer(geojsonObj))
  } else if (name === 'icon') {
    // console.log(data);

    //icon from https://github.com/uber/deck.gl/blob/8d5b4df9e4ad41eaa1d06240c5fddb922576ee21/website/src/static/images/icon-atlas.png
    const iconObj = {
      id: 'icon-layer',
      data,
      pickable: true,
      iconAtlas: 'location-icon-atlas.png',
      iconMapping: mapping,
      sizeScale: 60,
      getPosition: d => d.geometry.coordinates,
      wrapLongitude: true,
      // getIcon: d => 'marker-1',
      // getSize: d => 5,
      // getColor: d => [Math.sqrt(d.exits), 140, 0],
      onHover: renderTooltip
    }
    addOptionsToObject(options, iconObj)
    return (new IconClusterLayer(iconObj))
  } else if (name === 'sgrid') {
    const sgridObject = {
      id: 'screen_grid',
      data,
      getPosition: d => d.geometry.coordinates,
      // getWeight: d => d.properties.weight,
      cellSizePixels: 4,
      // colorRange,
      // gpuAggregation,
      onHover: renderTooltip
    }
    addOptionsToObject(options, sgridObject)
    return (new ScreenGridLayer(sgridObject))
  } else if (name === 'grid') {
    const gridObject = {
      id: 'screen_grid',
      data,
      pickable: true,
      extruded: true,
      cellSize: 100,
      elevationScale: 4,
      getPosition: d => d.geometry.coordinates,
      onHover: renderTooltip
    }
    addOptionsToObject(options, gridObject)
    return (new GridLayer(gridObject))
  } else if (name === 'line') {
    const lineObject = {
      id: 'line-layer',
      data,
      pickable: true,
      onHover: renderTooltip
    }
    addOptionsToObject(options, lineObject)
    return (new LineLayer(lineObject))
  } else if (name === 'arc') {
    const arcObject = {
      id: 'arc-layer',
      data,
      pickable: true,
      onHover: renderTooltip
      // getSourcePosition: d => d.geometry.coordinates[0],
      // getTargetPosition: d => d.geometry.coordinates[1],
    }
    addOptionsToObject(options, arcObject)
    return (new ArcLayer(arcObject))
  } else if (name === 'path') {
    const pathObject = {
      id: 'path-layer',
      data,
      pickable: true,
      onHover: renderTooltip
    }
    addOptionsToObject(options, pathObject)
    return (new PathLayer(pathObject))
  } else if (name === 'heatmap') {
    const heatObject = {
      id: 'heatmap-layer',
      data,
      pickable: true,
      onHover: renderTooltip,
    }
    addOptionsToObject(options, heatObject);
    return (new HeatmapLayer(heatObject))
  } else if (name === "scatterplot") {
    const scatterObject = {
      id: 'scatterplot',
      data,
      pickable: true,
      onHover: renderTooltip,
      opacity: 0.3
    }
    addOptionsToObject(options, scatterObject);
    return (new ScatterplotLayer(scatterObject))
  } else if (name === "text") {
    const textObject = {
      id: 'text-layer',
      data,
      pickable: true,
      onHover: renderTooltip,
    }
    addOptionsToObject(options, textObject);
    return (new TextLayer(textObject))
  }

  return (null)
}

const getCentroid = (coords) => {
  let center = coords.reduce((x, y) => {
    return [x[0] + y[0] / coords.length, x[1] + y[1] / coords.length]
  }, [0, 0])
  center = [parseFloat(center[1].toFixed(3)), parseFloat(center[0].toFixed(3))]
  return center;
}

const convertRange = (oldValue = 2, values = {
  oldMax: 10, oldMin: 1,
  newMax: 1, newMin: 0
}) => {
  // thanks to https://stackoverflow.com/a/929107/2332101
  // OldRange = (OldMax - OldMin)  
  // NewRange = (NewMax - NewMin)  
  // NewValue = (((OldValue - OldMin) * NewRange) / OldRange) + NewMin
  let value = (((oldValue - values.oldMin) * (values.newMax - values.newMin))
    / (values.oldMax - values.oldMin)) + values.newMin
  return +value.toFixed(2)
}

const getParamsFromSearch = (search) => {
  if (!search) return (null);

  const qsResult = qs.parse(search.replace("?", ""))
  // 3 decimal points is street level
  const lat = Number(qsResult.lat).toFixed(3);
  const lng = Number(qsResult.lng).toFixed(3);
  return ({
    latitude: !isNaN(lat) ? Number(lat) : 53.8321,
    longitude: !isNaN(lng) ? Number(lng) : -1.6362,
    zoom: Number(qs.parse(search).zoom) || 10,
    pit: Number(qs.parse(search).pit) || 55,
    bea: Number(qs.parse(search).bea) || 0,
    alt: Number(qs.parse(search).alt) || 1.5,
  })
};

const getBbx = (bounds) => {
  if (!bounds) return null;
  // xmin = -1.6449
  // ymin = 53.82925
  // xmax = -1.6270
  // ymax = 53.8389
  let xmin = bounds._sw.lng;
  let xmax = bounds._ne.lng;
  let ymin = bounds._sw.lat;
  let ymax = bounds._ne.lat;
  if (xmin > xmax) {
    xmax = bounds._sw.lng;
    xmin = bounds._ne.lng;
  }
  if (ymin > ymax) {
    ymax = bounds._sw.lat;
    ymin = bounds._ne.lat;
  }
  return ({ xmin, ymin, xmax, ymax })
}

const suggestDeckLayer = (geojson) => {
  // basic version should suggest a layer
  // based on the geojson data types
  // go through each feature? in case of features.

}
const suggestUIforNumber = (number) => {
  // "checkbox",     
  // "radio",        
  // "buttongroups", 
  // "dropdown",     
  // "slider"])      
  const { UI_LIST } = Constants;
  if (!number) return UI_LIST[1];
  if (number === 1) {
    return UI_LIST[0];
  } else if (number > 3 && number <= 6) {
    return UI_LIST[1];
  } else if (number === 2 || number === 3) {
    return UI_LIST[2];
  } else if (number > 9 && number < 15) {
    return UI_LIST[3];
  } else {
    return UI_LIST[4]; // slider
  }
}

/**
 * Changes a `_` separated `str` to space separated and
 * camel cases all words
 * 
 * @param {*} str 
 */
const humanize = (str) => {
  if (!str) return str
  let frags = str.split('_');
  for (let i = 0; i < frags.length; i++) {
    frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
  }
  return frags.join(' ');
}

const shortenName = (name, n = 26) => {
  if (isNumber(name)) {
    return parseFloat(Number.parseFloat(name).toFixed(2).toString())
  }
  if (!name || name.length <= n || !isString(name)) return name;
  let shortened = name.trim();
  const extension = name.split('.').length > 1 &&
    name.split('.').pop().length < 10 && name.split('.').pop();
  shortened.replace(extension, "");
  if (name.length > 10) {
    shortened = shortened.substring(0, 10) + "..." + (extension || "")
  }
  return (shortened);
}

const percentDiv = (title, left, cb, dark) => {
  return (
    <div
      key={title}
      onClick={() => typeof (cb) === 'function' && cb()}
      style={{
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        float: 'left',
        width: '30%',
        color: dark ? 'white' : 'black',
        margin: '10px 2px',
        border: '1px solid gray',
      }}>
      <span style={{ position: 'absolute', left: '10%' }}>
        {title}
      </span>
      <div style={{
        width: left + '%',
        height: 20,
        background: 'rgb(18, 147, 154)',
        // background: 'rgb(200, 120, 0)'
      }}>
      </div>
    </div>
  )
}

/**
 * Thanks to https://stackoverflow.com/a/34695026/2332101
 * @param {*} str 
 */
const isURL = (str) => {
  var a = document.createElement('a');
  a.href = str;
  return (a.host && a.host !== window.location.host);
}

const isMobile = function () {
  var check = false;
  if (window.innerWidth < 640) return true;
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
};

function hexToRgb(hex) {
  let bigint = parseInt(hex.substring(1, hex.length), 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;

  return 'rgb(' + r + "," + g + "," + b + ")";
}

/**
 * Generate colour scale for unique set of values
 * based on the index of the values in an array.
 * 
 * @param {object} d particular property to get color for from features
 * @param {*} features features in a geojson featureset
 * @param {*} p index/name of column to generate color scale with
 * @param {Number} alpha value to add to colour pallete
 */
const colorScale = (d, features, p = 0, alpha = 180) => {
  if (!d || !features || features.length === 0) return null;
  const x = isNumber(p) ? Object.keys(d.properties)[p] : p;
  let domainIsNumeric = true;
  let domain = features.map(feature => {
    // uber move to show isochrones
    const i = feature.properties[x];
    if (isNumber(i) &&
      p === 'Mean.Travel.Time..Seconds.') {
      return (Math.floor(i / 300))
    } else if (domainIsNumeric && !isNumber(i)) {
      // stop getting here if already been
      domainIsNumeric = false;
    }
    return isNumber(i) ? +(i) : i
  })
  domain = Array.from(new Set(domain))
  // sort the domain if possible
  if (domainIsNumeric) {
    domain = domain.sort((a, b) => { return (a - b) })
  }
  const index = domain.indexOf(isNumber(d.properties[x]) &&
    p === 'Mean.Travel.Time..Seconds.' ?
    Math.floor(d.properties[x] / 300) : d.properties[x])
  // console.log(domain, index)
  let col = interpolateOrRd(index / domain.length);
  col = col.substring(4, col.length - 1)
    .replace(/ /g, '')
    .split(',').map(x => +x); // deck.gl 8 int not strings
  return [...col, alpha]
}

const colorRangeNames = ['inverseDefault', 'yellowblue', 'greens',
  'oranges', 'diverge', 'default'];

const colorRanges = (name) => {
  if (!name) return
  const colors = {
    yellowblue: [
      [255, 255, 204],
      [199, 233, 180],
      [127, 205, 187],
      [65, 182, 196],
      [44, 127, 184],
      [37, 52, 148]
    ],
    greens: [
      [237, 248, 233],
      [199, 233, 192],
      [161, 217, 155],
      [116, 196, 118],
      [49, 163, 84],
      [0, 109, 44],
    ],
    oranges: [
      [254, 237, 222],
      [253, 208, 162],
      [253, 174, 107],
      [253, 141, 60],
      [230, 85, 13],
      [166, 54, 3],
    ],
    diverge: [
      [140, 81, 10],
      [216, 179, 101],
      [246, 232, 195],
      [199, 234, 229],
      [90, 180, 172],
      [1, 102, 94]
    ],
    inverseDefault: [
      [189, 0, 38],
      [240, 59, 32],
      [253, 141, 60],
      [254, 178, 76],
      [254, 217, 118],
      [255, 255, 178]
    ],
    default: [
      [255, 255, 178],
      [254, 217, 118],
      [254, 178, 76],
      [253, 141, 60],
      [240, 59, 32],
      [189, 0, 38],
    ]
  }
  return (colors[name])
}

const iconJSType = (dataType) => {
  // describeFeatureVariables in geojsonutils
  // String, Number, Boolean and Object
  if (!dataType) return (null)
  switch (dataType) {
    case "String":
      dataType = "fa fa-globe";
      break;
    case "Number":
      dataType = "fa fa-list";
      break;
    case "Object":
      dataType = "fa fa-sack";
      break;
    default:
      dataType = "fa fa-question-circle";
  }
  return dataType
}

const searchNominatom = (location, callback) => {
  const url = "https://nominatim.openstreetmap.org/search/" +
    location + "?format=json";
  fetchData(url, (json) => {
    typeof callback === 'function' && callback(json)
  })
}

/**
 * 
 * @param {*} options 
 */
const generateLegend = (options) => {
  //quick check 
  const { domain, interpolate = interpolateOrRd, title } = options;
  if (!domain || !Array.isArray(domain) || !isNumber(domain[0])) return
  const jMax = domain[domain.length - 1], jMin = domain[0];
  const legend = [<p key='title'>{title}</p>]

  for (var i = 0; i < 10; i += 1) {
    legend.push(
      <>
        {i === 0 &&
          <i>{(title === humanize('Mean.Travel.Time..Seconds.') ?
            +(jMin) / 300 : jMin).toFixed(2)
          }</i>
        }
        <span key={i} style={{ background: interpolate(i / 10) }}>
        </span>
        {i === 9 &&
          <i>{(title === humanize('Mean.Travel.Time..Seconds.') ?
            +(jMax) / 300 : jMax).toFixed(2)
          }</i>
        }
      </>)
  }
  return legend;
}

/**
 * 
 * @param {*} data features from a geojson object
 * @param {*} column 
 */
const generateDomain = (data, column) => {
  if (!data || !Array.isArray(data) || !column ||
    !isString(column) || data.length === 0) return;

  let domainIsNumeric = true;
  let domain = data.map(feature => {
    // uber move to show isochrones
    const i = feature.properties[column];
    if (isNumber(i) &&
      column === 'Mean.Travel.Time..Seconds.') {
      return (Math.floor(i / 300));
    }
    return isNumber(i) ? +(i) : i;
  });
  domain = Array.from(new Set(domain));
  // sort the domain if possible
  if (domainIsNumeric) {
    domain = domain.sort((a, b) => { return (a - b); });
  }
  return domain
}

const sortNumericArray = (array) => {
  let domainIsNumeric = true;
  // sort the domain if possible
  array.map(e => !isNumber(e) && (domainIsNumeric = false))
  if (domainIsNumeric) {
    array = array.sort((a, b) => { return (a - b); });
  }
  return array
}

const getMax = (arr) => {
  return arr.reduce((max, v) => max >= v ? max : v, -Infinity);
}
const getMin = (arr) => {
  return arr.reduce((max, v) => max <= v ? max : v, Infinity);
}

const addLayerToMap = (map, MAPBOX_ACCESS_TOKEN) => {
  const URL = (process.env.NODE_ENV === 'development' ? 
  Constants.DEV_URL : Constants.PRD_URL);
  if(!map || !map.on) return null;
  map.on("load", (e) => {
    const brewer = !MAPBOX_ACCESS_TOKEN ? [
      '#ffffcc','#ffeda0','#fed976',
      '#feb24c','#fd8d3c','#fc4e2a',
      '#e31a1c','#bd0026','#800026'
    ] : [
      '#fff5f0','#fee0d2','#fcbba1',
      '#fc9272','#fb6a4a','#ef3b2c',
      '#cb181d','#a50f15','#67000d'];
    e.target.addSource('vt', {
      'type': 'vector',
      'tiles': [
        URL + '/rnet_cycling/{z}/{x}/{y}.pbf'
      ],
      'minzoom': 0,
      'maxzoom': 11
    });
    const layers = e.target.getStyle().layers;
    var lastSymbolId;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === 'symbol') {
        lastSymbolId = layers[i].id;
        // break; first!
      }
    }
    e.target.addLayer(
      {
        'id': 'vt',
        'type': 'line',
        'source': 'vt',
        'source-layer': 'rnet_cycling',
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        },
        'paint': {
          'line-opacity': 0.6,
          'line-color': [
            'case',
            ['<', ['get', 'bicycle'], 10],
            brewer[0],
            ['<', ['get', 'bicycle'], 50],
            brewer[1],
            ['<', ['get', 'bicycle'], 100],
            brewer[2],
            ['<', ['get', 'bicycle'], 500],
            brewer[3],
            ['<', ['get', 'bicycle'], 700],
            brewer[4],
            ['<', ['get', 'bicycle'], 1000],
            brewer[5],
            ['<', ['get', 'bicycle'], 10000],
            brewer[8],
                  /* other */ '#ccc'
          ],
          'line-width': 3
        }
      },
      MAPBOX_ACCESS_TOKEN ? 'waterway-label' : lastSymbolId
    );
  });
}

const OSMTILES = {
  "version": 8,
  "sources": {
    "simple-tiles": {
      "type": "raster",
      "tiles": [
        // "http://tile.openstreetmap.org/{z}/{x}/{y}.png",
        // "http://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
        // "http://tile.stamen.com/toner/{z}/{x}/{y}.png"
        'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg'
      ],
      "tileSize": 256
    }
  },
  "layers": [{
    "id": "simple-tiles",
    "type": "raster",
    "source": "simple-tiles",
  }]
};

export {
  getResultsFromGoogleMaps,
  getParamsFromSearch,
  xyObjectByProperty,
  suggestUIforNumber,
  generateDeckLayer,
  suggestDeckLayer,
  sortNumericArray,
  colorRangeNames,
  searchNominatom,
  generateLegend,
  generateDomain,
  addLayerToMap,
  convertRange,
  getCentroid,
  shortenName,
  colorRanges,
  percentDiv,
  iconJSType,
  colorScale,
  fetchData,
  OSMTILES,
  humanize,
  isMobile,
  getBbx,
  getMin,
  getMax,
  isURL,
}