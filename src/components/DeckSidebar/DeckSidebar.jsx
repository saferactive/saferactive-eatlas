import React from 'react';
import {
  Tabs, Tab, FormGroup, InputGroup,
  FormControl, Glyphicon, Checkbox
} from 'react-bootstrap';
import { Button, KIND, SIZE } from 'baseui/button';
import { StyledLink } from "baseui/link";

import './DeckSidebar.css';
import MapboxBaseLayers from '../MapboxBaseLayers';
import {
  xyObjectByProperty, percentDiv,
  searchNominatom,
  humanize, generateLegend, sortNumericArray
} from '../../utils';
import { LineSeries, VerticalBarSeries } from 'react-vis';
import Variables from '../Variables';
import RBAlert from '../RBAlert';
import { propertyCount } from '../../geojsonutils';
import { DEV_URL, PRD_URL, LAYERSTYLES, RADIUS, ELEVATION }
  from '../../Constants';
import ColorPicker from '../ColourPicker';
import Modal from '../Modal';
import DataTable from '../Table';

import { yearSlider } from '../Showcases/Widgets';
import SeriesPlot from '../Showcases/SeriesPlot';
import { isNumber } from '../../JSUtils';
import MultiSelect from '../MultiSelect';
import AddVIS from '../AddVIS';

const URL = (process.env.NODE_ENV === 'development' ? DEV_URL : PRD_URL);

export default class DeckSidebar extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      radius: RADIUS,
      elevation: ELEVATION,
      year: "",
      reset: false,
      multiVarSelect: {},
      barChartVariable: "road_type",
      datasetName: props.datasetName,
      subsetBoundsChange: true
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { data, alert, loading } = this.props;
    const { elevation, radius, reset, subsetBoundsChange,
      barChartVariable,  } = this.state;
    // avoid rerender as directly operating on document.get* 
    // does not look neat. Keeping it React way.
    if (reset !== nextState.reset ||
      elevation !== nextState.elevation ||
      radius !== nextState.radius ||
      subsetBoundsChange !== nextState.subsetBoundsChange ||
      alert !== nextProps.alert ||
      loading !== nextProps.loading ||
      barChartVariable !== nextState.barChartVariable) return true;
    //TODO:  a more functional way is needed        
    if (data && nextProps && nextProps.data &&
      data.length === nextProps.data.length) {
      return false
    }
    return true;
  }

  /**
   * Render the sidebar empty if no data is loaded.
   * Partly because we like to load from a URL.
   */
  render() {
    const { elevation, radius, year, datasetName,
      subsetBoundsChange, multiVarSelect, barChartVariable } = this.state;
    const { onChangeRadius, onChangeElevation,
      onSelectCallback, data, colourCallback, unfilteredData,
      toggleSubsetBoundsChange, urlCallback, alert,
      onlocationChange, column, dark, toggleOpen } = this.props;
    // let plot_data = [];
    // let plot_data_multi = [[], []];
    const notEmpty = data && data.length > 1;
    // plot_data = crashes_plot_data(notEmpty, data, plot_data, plot_data_multi);
    let columnDomain = [];
    let columnData = notEmpty ?
      xyObjectByProperty(data, column || barChartVariable) : [];
    const geomType = notEmpty && data[0].geometry.type.toLowerCase();
    // console.log(geomType);
    if (notEmpty && column && (geomType === 'polygon' ||
      geomType === 'multipolygon' || "linestring") &&
      isNumber(data[0].properties[column])) {
      // we dont need to use generateDomain(data, column)
      // columnData already has this in its x'es
      columnDomain = columnData.map(e => e.x);
      // we will just sort it        
      columnDomain = sortNumericArray(columnDomain);
      // console.log(columnDomain);

      this.props.showLegend(
        generateLegend(
          {
            domain: columnDomain,
            title: humanize(column)
          }
        )
      );
    }

    const columnPlot = {
      data: columnData,
      opacity: 1,
      stroke: 'rgb(72, 87, 104)',
      fill: 'rgb(18, 147, 154)',
    }

    const resetState = (urlOrName) => {
      this.setState({
        reset: true,
        year: "",
        multiVarSelect: {},
        barChartVariable: "road_type",
        datasetName: urlOrName || datasetName
      })
    }

    // reuse for different props
    const generatePercent = (array, prop, n) => {
      return array &&
        <div style={{ clear: 'both' }}>{
          array.map(each =>
            percentDiv(each.x, 100 * each.y / data.length, () => {
              if (multiVarSelect && multiVarSelect[prop] &&
                multiVarSelect[prop].has(each.x)) {
                delete multiVarSelect[prop];
              } else {
                multiVarSelect[prop] = new Set([each.x]);
                this.setState({ multiVarSelect })
              }
              onSelectCallback &&
                onSelectCallback(Object.keys(multiVarSelect).length === 0 ?
                  { what: '' } : { what: 'multi', selected: multiVarSelect })
            }, dark, n))
        }</div>
    }

    const plotWith = (t, p) => <SeriesPlot
      dark={dark}
      title={t} noYAxis={true}
      plotStyle={{ height: 100 }} noLimit={true}
      type={LineSeries}
      // sorts the results if x is a number
      // TODO: do we want to do this?
      // also think about sorting according to y
      data={xyObjectByProperty(data, p)}
    />

    return (
      <>
        <div
          style={{
            color: dark ? "white" : "black",
            background: dark ? "#242730" : "white"
          }}
          className="side-panel">
          <RBAlert alert={alert} />
          <div
            style={{
              background: dark ? '#29323C' : '#eee'
            }}
            className="side-pane-header">
            <h2>{data && data.length ?
              data.length + " row" + (data.length > 1 ? "s" : "") + "."
              : this.props.loading ? "Loading..." : "Nothing to show"}
            </h2>
          </div>
          <div>
            {/* <DataInput
              toggleOpen={() => typeof toggleOpen === 'function' && toggleOpen()}
              urlCallback={(url, geojson, name) => {
                resetState(url || name);
                typeof (urlCallback) === 'function'
                  && urlCallback(url, geojson);
                typeof (toggleOpen) === 'function' && toggleOpen()
              }
              } /> */}
            <Modal
              toggleOpen={() => typeof toggleOpen === 'function' && toggleOpen()}
              component={<DataTable data={data} />} />
            {
              this.state.reset &&
              <Button
                kind={KIND.secondary} size={SIZE.compact}
                onClick={() => {
                  resetState();
                  typeof (urlCallback) === 'function'
                    && urlCallback(URL + "/api/stats19");
                  typeof (this.props.showLegend) === 'function' &&
                    this.props.showLegend(false);
                }}>Reset</Button>
            }
            {notEmpty &&
              <StyledLink 
              download="sa-crashes.geojson"  
              href={
                "data:text/json;charset=utf-8," + 
                encodeURIComponent(JSON.stringify({
                  type: 'FeatureCollection',
                  features: data
                }))
              }>
                {<i
                style={{
                  margin: 5,
                  cursor: 'pointer',
                  fontSize: '1.5em'
                }}
                className={"fa fa-download"}></i>}
                </StyledLink>
            }
          </div>
          <div className="side-panel-body">
            <div className="side-panel-body-content">
              {/* <DateSlider data={yy} multiVarSelect={multiVarSelect}
                  onSelectCallback={(changes) => console.log(changes)} 
                  callback={(changes) => console.log(changes)}/> */}
              {/* range of two values slider is not native html */
                yearSlider({
                  data: unfilteredData, year, multiVarSelect,
                  // for callback we get { year: "",multiVarSelect }
                  onSelectCallback, callback: (changes) => this.setState(changes)
                })
              }
              <br />
              {/* TODO: generate this declaritively too */}
              {
                ["accident_severity", "casualty_type"]
                  .map(e => generatePercent(
                    propertyCount(data, e), e, e === "casualty_type" ? 2 : 3
                  )
                  )
              }
              <hr style={{ clear: 'both' }} />
              <Checkbox
                checked={subsetBoundsChange}
                onChange={() => {
                  // needed for subsequent parent call
                  this.setState({ subsetBoundsChange: !subsetBoundsChange })
                  if (toggleSubsetBoundsChange && typeof (toggleSubsetBoundsChange) === 'function') {
                    toggleSubsetBoundsChange(!subsetBoundsChange) //starts with false
                  }
                }}
              >Subset by map boundary</Checkbox>
              <Tabs defaultActiveKey={"1"} id="main-tabs">
                <Tab eventKey="1" title={
                  <i style={{ fontSize: '2rem' }}
                    className="fa fa-info" />
                }>
                  {/* distribution example */}
                  {
                    ['date', 'age_of_casualty'].map(e => notEmpty &&
                      data[0].properties.hasOwnProperty([e]) &&
                      plotWith(humanize(e), e))
                  }
                  {notEmpty &&
                    data[0].properties.hasOwnProperty(['day_of_week']) &&
                    <SeriesPlot
                      dark={dark}
                      data={xyObjectByProperty(data, 'day_of_week')}
                      type={VerticalBarSeries}
                      plotStyle={{ marginBottom: 100 }}
                    />}
                  {/* TODO: example of generating vis based on column
                  cloudl now be deleted. */}
                  {<SeriesPlot
                    dark={dark}
                    data={columnPlot.data}
                    type={VerticalBarSeries}
                    onValueClick={(datapoint) => {
                      // convert back to string
                      multiVarSelect[column ||
                        barChartVariable] = new Set([datapoint.x + ""]);
                      this.setState({ multiVarSelect })
                      onSelectCallback &&
                        onSelectCallback({ what: 'multi', selected: multiVarSelect })
                    }}
                    onDragSelected={(datapoints) => {
                      multiVarSelect[column ||
                        barChartVariable] = new Set(datapoints.map(e => e + ""));
                      this.setState({ multiVarSelect })
                      onSelectCallback &&
                        onSelectCallback({ what: 'multi', selected: multiVarSelect })
                    }}
                    plotStyle={{ marginBottom: 100 }} noYAxis={true}

                  />}
                  {/* pick a column and vis type */}
                  <AddVIS data={data} dark={dark} />
                  {/* {popPyramid({ data, dark: dark })} */}
                </Tab>
                <Tab eventKey="2" title={
                  <i style={{ fontSize: '2rem' }}
                    className="fa fa-sliders" />
                }>
                  {notEmpty &&
                    <div>
                      <ColorPicker colourCallback={(color) =>
                        typeof colourCallback === 'function' &&
                        colourCallback(color)} />
                      <input
                        type="range"
                        id="radius"
                        min={50}
                        max={1000}
                        step={50}
                        value={radius}
                        onChange={(e) => {
                          this.setState({
                            radius: e.target.value,
                          })
                          typeof (onChangeRadius) === 'function' &&
                            onChangeRadius(e.target.value)
                        }}
                      />
                      <h5>Radius: {radius}.</h5>
                      <input
                        type="range"
                        id="elevation"
                        min={2}
                        max={8}
                        step={2}
                        value={elevation}
                        onChange={(e) => {
                          this.setState({
                            elevation: e.target.value
                          })
                          typeof (onChangeElevation) === 'function' &&
                            onChangeElevation(e.target.value)
                        }}
                      />
                      <h5>Elevation: {elevation}.</h5>
                    </div>
                  }
                  {notEmpty &&
                    <>
                      <h6>Deck Layer:</h6>
                      <MultiSelect
                        title="Vis style"
                        single={true}
                        values={
                          LAYERSTYLES.map(e =>
                            ({ id: humanize(e), value: e }))
                        }
                        onSelectCallback={(selected) => {
                          // array of seingle {id: , value: } object
                          const layerStyle = (selected && selected[0]) ?
                            selected[0].value : layerStyle;
                          this.setState({
                            layerStyle: layerStyle
                          });
                          typeof onSelectCallback === 'function' &&
                            onSelectCallback({
                              what: 'layerStyle', selected: layerStyle
                            });
                        }}
                      />
                    </>
                  }
                  Map Styles
                  <br />
                  <MapboxBaseLayers
                    onSelectCallback={(selected) =>
                      onSelectCallback &&
                      onSelectCallback({
                        selected: selected,
                        what: 'mapstyle'
                      })
                    }
                  />
                </Tab>
                {/* <Tab eventKey="3" title={
                  <i style={{ fontSize: '2rem' }}
                    className="fa fa-tasks" />
                }>
                  Tab 3
                </Tab> */}
                <Tab eventKey="3" title={
                  <i style={{ fontSize: '2rem' }}
                    className="fa fa-filter" > {
                      multiVarSelect && Object.keys(multiVarSelect).length
                    } </i>
                }>
                  {
                    unfilteredData && unfilteredData.length > 0 &&
                    <Variables
                      dark={dark}
                      multiVarSelect={multiVarSelect}
                      onSelectCallback={(mvs) => {
                        typeof (onSelectCallback) === 'function' &&
                          onSelectCallback(
                            Object.keys(mvs).length === 0 ?
                              { what: '' } : { what: 'multi', selected: mvs })
                        this.setState({ multiVarSelect: mvs })
                      }}
                      unfilteredData={unfilteredData} />
                  }
                </Tab>
              </Tabs>
            </div>
            <div className="space"></div>
            <form className="search-form" onSubmit={(e) => {
              e.preventDefault();
              console.log(this.state.search);
              searchNominatom(this.state.search, (json) => {
                console.log(json && json.length > 0 && json[0].boundingbox);
                let bbox = json && json.length > 0 && json[0].boundingbox;
                bbox = bbox && bbox.map(num => +(num))
                typeof onlocationChange === 'function' && bbox &&
                  onlocationChange({
                    bbox: bbox,
                    lon: +(json[0].lon), lat: +(json[0].lat)
                  })
              })
            }}>
              <FormGroup>
                <InputGroup>
                  <FormControl
                    style={{
                      background: dark ? '#242730' : 'white',
                      color: dark ? 'white' : 'black'
                    }}
                    onChange={(e) => this.setState({ search: e.target.value })}
                    placeholder="fly to..." type="text" />
                  <InputGroup.Addon
                    style={{
                      background: dark ? '#242730' : 'white',
                      color: dark ? 'white' : 'black'
                    }}>
                    <Glyphicon glyph="search" />
                  </InputGroup.Addon>
                </InputGroup>
              </FormGroup>
            </form>
          </div>
        </div>
      </>
    )
  }
}

