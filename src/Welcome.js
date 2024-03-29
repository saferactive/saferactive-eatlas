/**
 * Main entry to the application.
 * 
 * The crucial bits are:
 * 
     this.state = {
      data,            <= main data holding param   
      layers: [],      <= mapgl layers object
      initialViewState:<= deckgl/mapgl initial state object
      legend: false    <= map legend to avoid rerender.
    }
 * and
 * DeckSidebarContainer which holds DeckSidebar object itself.
 * 
 * Main funcitons:
 * _generateLayer which is the main/factory of filtering state
 * of the map area of the application.
 * 
 */
import React from 'react';
import DeckGL from 'deck.gl';
import MapGL, { NavigationControl, FlyToInterpolator, Source, Layer } from 'react-map-gl';
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import _ from 'underscore';

import {
  fetchData, generateDeckLayer,
  getParamsFromSearch, getBbx,
  isMobile, colorScale, 
  colorRanges, addLayerToMap, OSMTILES,
  convertRange, getMin, getMax, isURL, updateHistory
} from './utils';
import Constants from './Constants';
import DeckSidebarContainer from
  './components/DeckSidebar/DeckSidebarContainer';
import history from './history';

import './App.css';
import Tooltip from './components/Tooltip';
import { sfType } from './geojsonutils';
import { isNumber, isArray } from './JSUtils';
import { throttle } from 'lodash';

const URL = (process.env.NODE_ENV === 'development' ? Constants.DEV_URL : Constants.PRD_URL);
const defualtURL = "/api/stats19";

// Set your mapbox access token here
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const gradient = {
  height: '200px',
  // TODO: which browsers?
  backgroundColor: 'red', /* For browsers that do not support gradients */
  backgroundImage: 'linear-gradient(to top, red , yellow)' /* Standard syntax (must be last) */
}

const LIGHT_SETTINGS = {
  lightsPosition: [-0.144528, 49.739968, 8000, -3.807751, 54.104682, 8000],
  ambientRatio: 0.4,
  diffuseRatio: 0.6,
  specularRatio: 0.2,
  lightsStrength: [0.8, 0.0, 0.8, 0.0],
  numberOfLights: 2
};

export default class Welcome extends React.Component {
  constructor(props) {
    super(props)
    const init = {
      longitude: -1.6362,
      latitude: 53.8321,
      zoom: 10,
      pitch: 55,
      bearing: 0,
    }
    const param = getParamsFromSearch(props.location.search);
    if (param) {
      //lat=53.814&lng=-1.534&zoom=11.05&bea=0&pit=55&alt=1.5
      Object.keys(param).forEach(key => {
        Object.keys(init).forEach(iKey => {
          if (iKey.startsWith(key)) {
            init[key] = param[key]
          }
        })
      })
    }

    this.state = {
      loading: true,
      layers: [],
      backgroundImage: gradient.backgroundImage,
      radius: Constants.RADIUS,
      elevation: Constants.ELEVATION,
      mapStyle: MAPBOX_ACCESS_TOKEN ? ("mapbox://styles/mapbox/" +
        (props.dark ? "dark" : "streets") + "-v9") : OSMTILES,
      initialViewState: init,
      subsetBoundsChange: true,
      colourName: 'default',
      iconLimit: 500,
      legend: false,
      multiVarSelect: {}
    }
    this._generateLayer = this._generateLayer.bind(this)
    this._renderTooltip = this._renderTooltip.bind(this);
    this._fetchAndUpdateState = this._fetchAndUpdateState.bind(this);
    this._fitViewport = this._fitViewport.bind(this);
    this._updateURL = this._updateURL.bind(this);
    // TODO: can let user change the 300
    this._throttleUR = throttle((v) => this._updateURL(v), 300)
  }

  componentDidMount() {
    this._fetchAndUpdateState()
    addLayerToMap(this.map, MAPBOX_ACCESS_TOKEN);
  }

  /**
   * Main function to fetch data and update state.
   * 
   * @param {String} aURL to use if not default `/api/stats19` is used.
   * @param {Object} customError to use in case of urlCallback object/urls.
   * @param {Boolean} fitView whether viewState has been set externally,
   * default is true.
   */
  _fetchAndUpdateState(aURL, customError, fitView = true) {
    if (aURL && !isURL(aURL)) return;
    if (customError && typeof (customError) !== 'object') return;
    // TODO: more sanity checks?
    const fullURL = aURL ?
      // TODO: decide which is better.
      // URL + "/api/url?q=" + aURL : // get the server to parse it 
      aURL : // do not get the server to parse it 
      URL + defualtURL + "/0/0/0/0"; // 0/0/0/0 is the default bounding
      // no ending slash by choice for this versio of plumber
    this.setState({ loading: true });
    fetchData(fullURL, (data, error) => {
      if (!error && data.features) {
        this.setState({
          loading: false,
          data: data,
          alert: customError || null,
        })
        fitView && this._fitViewport(data)
        this._generateLayer()
      } else {
        this.setState({
          loading: false,
          alert: error ? { content: 'Could not reach: ' + fullURL } :
          {content: data.message}
        })
        //network error?
      }
    })
  }

  /**
   * Welcome should hold own state in selected as:
   * {property: Set(val1, val2), ...}.
   * 
   * @param {*} values includes
   * radius: specific to changing geoms
   * elevation: specific to changing geoms
   * filter: multivariate filter of properties
   * cn: short for colorName passed from callback
   * TODO: other
   */
  _generateLayer(values = {}) {
    const { radius, elevation, filter, cn } = values;

    if (filter && filter.what === 'mapstyle') {
      const newStyle = "mapbox://styles/mapbox/" + filter.selected + "-v9";
      this.setState({
        mapStyle: !MAPBOX_ACCESS_TOKEN ? OSMTILES :
          filter && filter.what === 'mapstyle' ?  filter.selected === "No map" ?
          Constants.BLANKSTYLE : newStyle : this.state.mapStyle,
      })
      return;
    }
    let data = this.state.data && this.state.data.features
    if (!data) return;
    const { colourName, iconLimit, multiVarSelect } = this.state;
    let column = (filter && filter.what === 'column' && filter.selected) ||
      this.state.column;
    if (filter && filter.what === "%") {
      data = data.slice(0, filter.selected / 100 * data.length)
    }
    // to optimize the search keep state as the source of truth
    if (this.state.coords) {
      data = this.state.filtered;
    }
    const geomType = sfType(data[0]).toLowerCase();
    //if resetting a value
    const filterValues = filter && filter.what === 'multi' ||
      Object.keys(multiVarSelect).length;
    const filterCoords = filter && filter.what === 'coords';
    const selected = filter && filter.selected || multiVarSelect;
    if (filterValues || filterCoords) {
      data = data.filter(
        d => {
          if (filterValues) {
            // go through each selection
            // selected.var > Set()
            for (let each of Object.keys(selected)) {
              const nextValue = each === "date" ?
                // for now format is yyyy-mm-dd
                d.properties[each].split("-")[0] : d.properties[each] + ""
              // each from selected must be in d.properties
              // *****************************
              // compare string to string
              // *****************************
              if (!selected[each].has(nextValue)) {
                return false
              }
            }
          }
          if (filterCoords) {
            // coords in 
            if (_.difference(filter.selected || this.state.coords,
              d.geometry.coordinates.flat()).length !== 0) {
              return false;
            }
          }
          return (true)
        }
      )
    }
    // console.log(data.length);
    let layerStyle = (filter && filter.what ===
      'layerStyle' && filter.selected) || this.state.layerStyle || 'grid';
    if (geomType !== "point") layerStyle = "geojson";
    const switchToIcon = data.length < iconLimit && !this.state.layerStyle && 
    (!filter || filter.what !== 'layerStyle') && geomType === "point";
    if (switchToIcon) layerStyle = 'icon';
    const options = {
      radius: radius ? radius : this.state.radius,
      cellSize: radius ? radius : this.state.radius,
      elevationScale: elevation ? elevation : this.state.elevation,
      lightSettings: LIGHT_SETTINGS,
      colorRange: colorRanges(cn || colourName)
    };
    if (layerStyle === 'geojson') {
      options.getFillColor = (d) => colorScale(d, data) //first prop
    }
    let columnNameOrIndex =
      (filter && filter.what === 'column' && filter.selected) || column || 1;
    if (layerStyle === 'heatmap') {
      options.getPosition = d => d.geometry.coordinates
      // options.getWeight = d => d.properties[columnNameOrIndex]
    }
    if (geomType === 'linestring') {
      layerStyle = "line"
      // https://github.com/uber/deck.gl/blob/master/docs/layers/line-layer.md
      options.getColor = d => [235, 170, 20]
      options.getPath = d => d.geometry.coordinates
      options.onClick = (info) => {
        // console.log(info);
        if (info && info.hasOwnProperty('coordinate')) {
          if (['path', 'arc', 'line'].includes(this.state.layerStyle) &&
            info.object.geometry.coordinates) {
            this._generateLayer({
              filter: {
                what: 'coords',
                selected: info.object.geometry.coordinates[0]
              }
            })
          }
        }
      }
      if (layerStyle === 'line') {
        // options.getSourceColor = d => [Math.sqrt(+(d.properties.base)) * 1000, 140, 0]
        // options.getTargetColor = d => [Math.sqrt(+(d.properties.hs2)) * 1e13, 140, 0]
        options.getSourcePosition = d => d.geometry.coordinates[0] // geojson
        options.getTargetPosition = d => d.geometry.coordinates[1] // geojson
      }
      if (isNumber(data[0] && data[0].properties &&
        data[0].properties[columnNameOrIndex])) {
        const colArray = data.map(f => f.properties[columnNameOrIndex])
        const max = getMax(colArray);
        const min = getMin(colArray)
        options.getWidth = d => {
          let newMax = 10, newMin = 0.1;
          if (data.length > 100000) {
            newMax = 0.5; newMin = 0.005
          }
          const r = convertRange(
            d.properties[columnNameOrIndex], {
            oldMin: min, oldMax: max, newMax: newMax, newMin: newMin
          })
          return r
        }; // avoid id
      }
    }
    if (geomType === "polygon" || geomType === "multipolygon") {
      const cols = Object.keys(data[0] && data[0].properties &&
        data[0].properties);
      // TODO: remove SPENSER
      const SPENSER = isArray(cols) && cols.length > 0 &&
        cols[1] === 'GEOGRAPHY_CODE';
      if (SPENSER) {
        options.getElevation = d => (isNumber(d.properties[column]) &&
          column !== 'YEAR' && d.properties[column]) || null
      }
      // TODO: allow user to specify column.
      options.getFillColor = (d) =>
        colorScale(d, data, column ? column : SPENSER ? 1 : 0)
    }
    const alayer = generateDeckLayer(
      layerStyle, data, this._renderTooltip, options
    )

    this.setState({
      alert: switchToIcon ? { content: 'Switched to icon mode. ' } : null,
      loading: false,
      // do not save if not given else leave it as it is
      layerStyle: filter && filter.what ===
        'layerStyle' ? filter.selected : this.state.layerStyle,
      // do not save if not given etc
      multiVarSelect: filter && filter.what === "multi" ? 
      filter.selected : multiVarSelect,
      geomType,
      tooltip: "",
      filtered: data,
      layers: [alayer],
      radius: radius ? radius : this.state.radius,
      elevation: elevation ? elevation : this.state.elevation,
      road_type: filter && filter.what === 'road_type' ? filter.selected :
        this.state.road_type,
      colourName: cn || colourName,
      column, // all checked
      coords: filter && filter.what === 'coords' ? filter.selected :
        this.state.coords
    })
  }

  _fitViewport(newData, bboxLonLat) {
    const data = newData || this.state.data;
    if ((!data || data.length === 0) && !bboxLonLat) return;
    const bounds = bboxLonLat ?
      bboxLonLat.bbox : bbox(data)
    const center = bboxLonLat ? 
    [bboxLonLat.lon, bboxLonLat.lat] : centroid(data).geometry.coordinates;

    this.map.fitBounds(bounds, {padding:'100px'})

    const viewport = {
      ...this.state.viewport,
      longitude: center[0],
      latitude: center[1],
      transitionDuration: 500,
      transitionInterpolator: new FlyToInterpolator(),
      // transitionEasing: d3.easeCubic
    };
    this.setState({ viewport })
  }

  _renderTooltip({ x, y, object }) {
    const hoveredObject = object;
    // console.log(hoveredObject && hoveredObject.points[0].properties.speed_limit);
    // console.log(hoveredObject)
    // return
    if (!hoveredObject) {
      this.setState({ tooltip: "" })
      return;
    }
    this.setState({
      tooltip:
        // react did not like x and y props.
        <Tooltip
          isMobile={isMobile()}
          topx={x} topy={y} hoveredObject={hoveredObject} />
    })
  }

  _updateURL(viewport) {
    updateHistory(viewport)
  }

  _fetchDataWithBounds() {
    const { subsetBoundsChange } = this.state;
    const bounds = this.map && this.map.getBounds();
    // console.log(bounds, subsetBoundsChange);
    if (bounds && subsetBoundsChange) {
      const box = getBbx(bounds);
      // console.log("bounds", box);
      // we need some margins int he user's view
      const { xmin, ymin, xmax, ymax } = box; // we can do shrinking at R easier
      //TODO: refactor the rest to use _fetchAndUpdateState
      // just needs switch to ignore refitting window
      // also needs handling "zoom in" message
      let r = 0.05
      if(xmax - xmin < 3*r || ymax - ymin < 3*r) r = 0
      const u = URL + defualtURL + "/" + (xmin + r) + "/" +
      (ymin + r/2) + "/" + (xmax - r) + "/" + (ymax - r/2)
      this._fetchAndUpdateState(u, undefined, false)
    }
  }

  render() {
    const { tooltip, viewport, initialViewState,
      loading, mapStyle, alert, data, filtered,
      layerStyle, geomType, legend, coords } = this.state;
    // console.log(geomType, legend);

    return (
      <div id="html2pdf">
        {/* just a little catch to hide the loader 
        when no basemap is presetn */}
        <div className="loader" style={{
          zIndex: loading ? 999 : -1,
          visibility: typeof mapStyle === 'string' &&
            mapStyle.endsWith("No map-v9") ? 'hidden' : 'visible'
        }} />
        <MapGL
          ref={ref => {
            // save a reference to the mapboxgl.Map instance
            this.map = ref && ref.getMap();
          }}
          mapStyle={mapStyle}
          onViewportChange={(viewport) => {
            this._throttleUR(viewport)
            this.setState({ viewport })
          }}
          // see
          // https://github.com/visgl/react-map-gl/issues/190#issuecomment-616381024
          onInteractionStateChange={(s) => {
            if (
              s.isDragging ||
              s.inTransition ||
              s.isRotating ||
              s.isZooming ||
              s.isHovering ||
              s.isPanning
            )
              return;
            this._fetchDataWithBounds();
          }}
          height={window.innerHeight - 54 + 'px'}
          width={window.innerWidth + 'px'}
          //crucial bit below
          viewState={viewport ? viewport : initialViewState}
        // mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
        >
          <div className='mapboxgl-ctrl-top-right' style={{
            zIndex: 9
          }}>
            <NavigationControl
              {...viewport}
              onViewportChange={viewport => this.setState({ viewport })}
            />
          </div>
          <DeckGL
            viewState={viewport ? viewport : initialViewState}
            initialViewState={initialViewState}
            layers={this.state.layers}
            // see docs below, url split for readability
            // https://deck.gl/#/documentation/developer-guide/
            // adding-interactivity?
            // section=using-the-built-in-event-handling
            onClick={(e) => {
              console.log(e);
              // this.setState({
              //   tooltip: <Modal 
              //   open={true} 
              //   noButton={true} 
              //   toggleOpen={() => {
              //     this.setState({tooltip: null})
              //   }}
              //   />
              // })
              if (!e.layer && coords) {
                this.setState({ coords: null })
                this._generateLayer()
              }
            }}
            onHover={(info, evt) => {
              // const mapboxFeatures = this.map.queryRenderedFeatures([evt.offsetX, evt.offsetY]);
              // console.log(info, evt);
              // console.log(this.map.getLayer("vt"))
              // let sp = this.map.queryRenderedFeatures()[0].properties.spenser;
              // sp = Object.values(JSON.parse(sp))[0]
              // const r = [];
              // while (sp.length) {
              //     r.push(sp.splice(0, 4));
              // }
              // console.log(sp)
            }}
          >
            {tooltip}
          </DeckGL>
          {/* <Source
            id="vt"
            type="vector"
            tiles={['http://localhost:8000/tiles/{z}/{x}/{y}.pbf']}>
            <Layer
              id="vt"
              type="fill"
              source-layer="out20112012"
              paint={{
                'fill-opacity': .4,
                'fill-color': '#007cbf'
              }} />
          </Source> */}
        </MapGL>
        <DeckSidebarContainer
          loading={loading}
          dark={this.props.dark}
          layerStyle={layerStyle}
          isMobile={isMobile()}
          key="decksidebar"
          alert={alert}
          unfilteredData={data && data.features}
          data={filtered}
          colourCallback={(colourName) =>
            this._generateLayer({ cn: colourName })
          }
          urlCallback={(url_returned, geojson_returned) => {
            this.setState({
              tooltip: "",
              road_type: "",
              radius: Constants.RADIUS,
              elevation: Constants.ELEVATION,
              loading: true,
              coords: null
            })
            if (geojson_returned) {
              // confirm valid geojson
              try {
                this.setState({
                  data: geojson_returned
                })
                this._fitViewport(geojson_returned)
                this._generateLayer()
              } catch (error) {
                // load up default
                this._fetchAndUpdateState(undefined, { content: error.message });
              }
            } else {
              this._fetchAndUpdateState(url_returned);
            }
          }}
          column={this.state.column}
          onSelectCallback={(selected) => this._generateLayer({ filter: selected })}
          onChangeRadius={(value) => this._generateLayer({ radius: value })}
          onChangeElevation={(value) => this._generateLayer({ elevation: value })}
          toggleSubsetBoundsChange={(checked) => {
            this.setState({
              subsetBoundsChange: checked
            })
            checked && this._fetchDataWithBounds();
          }}
          onlocationChange={(bboxLonLat) => {
            this._fitViewport(undefined, bboxLonLat)
          }}
          showLegend={(legend) => this.setState({ legend })}
        />
        {
          legend && (geomType === 'polygon' ||
            geomType === 'multipolygon') &&
          <div className="right-side-panel mapbox-legend">
            {legend}
          </div>
        }
      </div>
    );
  }
}