import React from 'react';
import { LineSeries } from 'react-vis';
import { Table } from 'baseui/table';
import { humanize } from '../utils';
import SeriesPlot from './Showcases/SeriesPlot';
import { propertyCountByProperty } from '../geojsonutils';
import MultiLinePlot from './Showcases/MultiLinePlot';

const WIDTH = 220;
const BAR_HEIGHT = 80;

export default class Tooltip extends React.Component {
  constructor(props) {
    super();
    this.state = {
      isMobile: props.isMobile,
    };
    this._listPropsAndValues = this._listPropsAndValues.bind(this);
  }

  componentWillMount() {
    window.addEventListener('resize', this._handleWindowSizeChange.bind(this));
  }

  // make sure to remove the listener
  // when the component is not mounted anymore
  componentWillUnmount() {
    window.removeEventListener('resize', this._handleWindowSizeChange.bind(this));
  }

  _handleWindowSizeChange = () => {
    this.forceUpdate()
  };

  /**
   * hoverdObject can be of two types so far:
   * 1. collections of points with `.points` property
   * 2. properties of `.type === 'Feature'`.
   */
  render() {
    const { topx, topy, hoveredObject } = this.props;
    const { isMobile } = this.state;
    // console.log(topx, topy);

    if (!hoveredObject) return null;

    const type_feature = hoveredObject.type && 
    hoveredObject.type === 'Feature';
    const cluster = hoveredObject && hoveredObject.cluster 
    // {cluster: true, cluster_id: 8, point_count: 54, 
    // point_count_abbreviated: 54}

    let list;
    let severity_keys = [];
    let crashes_data = [];
    let severity_data = [];
    let severity_data_separate = [];    
    if (!type_feature && !cluster) {
      list = hoveredObject.points.map(feature => {
        const aKey = {}
        if (feature.properties.hasOwnProperty('accident_severity')) {
          aKey.severity = feature.properties.accident_severity;
        }
        if (feature.properties.hasOwnProperty('date')) {
          aKey.year = feature.properties.date.split("/")[2];
        }
        return (aKey)
      });
      const map = new Map()
      // aggregate severity and years
      list.forEach(element => {
        if (element.hasOwnProperty('severity')) {
          if (map.get(element.severity)) {
            map.set(element.severity, map.get(element.severity) + 1)
          } else {
            map.set(element.severity, 1)
          }
        }
        if (element.hasOwnProperty('year')) {
          if (map.get(element.year)) {
            map.set(element.year, map.get(element.year) + 1)
          } else {
            map.set(element.year, 1)
          }
        }
      });
      // list severity and year counts
      Array.from(map.keys()).forEach(key => {
        // console.log(key, [ ...map.keys() ]);
        if (parseInt(key)) { // TODO: replace with moment check - is it year?
          crashes_data.push({ x: key, y: map.get(key) })
        } else {
          // {x: serious, y: 20}
          // {x: slight: y: 21}
          severity_data.push({ x: key, y: map.get(key) })
        }
      })
      // separate the severity into [[],[]] arrays
      severity_keys = Array.from(new Set(severity_data.map(e => e.x)));
      const severity_by_year = propertyCountByProperty(hoveredObject.points,
        "accident_severity", severity_keys, "date");
      // now turn it into [[],[]]
      //{2009: {Slight: 1}, 2010: {Slight: 3}, 2012: {Slight: 4}, 
      // 2013: {Slight: 3}, 2014: {Serious: 1}, 2015: {Slight: 6}, 
      // 2016: {Serious: 1, Slight: 2}, 2017: {Slight: 1}}
      Object.keys(severity_by_year).forEach(y => {
        severity_by_year[y] &&
        Object.keys(severity_by_year[y]).forEach(kk => {
          // get index of kk
          const index = severity_keys.indexOf(kk);
          if(!severity_data_separate[index]) {
            severity_data_separate[index] = [];
          }
          // 2016: {Serious: 1, Slight: 2}
          severity_data_separate[index].push({
            x: +(y), y: severity_by_year[y][kk]
          })
        })
      })
    }
    // console.log(crashes_data);
    
    const w = window.innerWidth;
    const y = window.innerHeight;
    const n_topy = isMobile ? 10 :
      topy + (WIDTH + BAR_HEIGHT) > y ? topy - WIDTH : topy;
    const n_left = isMobile ? 10 :
      topx + WIDTH > w ? topx - WIDTH : topx;    
    const tooltip =
      <div
        className="xyz" style={{
          top: topy + (WIDTH + BAR_HEIGHT) > y ? n_topy : topy,
          left: topx + WIDTH > w ? n_left : topx
        }}>
        <div>
          <b>Total: {cluster ? hoveredObject.point_count : 
            type_feature ? 1 : hoveredObject.points.length}</b>
        </div>
        <div>
          {
            // Simple logic, if points and less two points or less,
            // or not poingts, hard to expect React-vis generating plot.
            // so list the values of the non-point or list both points.
            !cluster && (type_feature || hoveredObject.points.length <= 2) &&
            this._listPropsAndValues(hoveredObject)
          }
          {
            severity_data_separate.length > 1 ?
            <MultiLinePlot
              data={[...severity_data_separate, crashes_data]}
              legend={[...severity_keys, 'Total']}
              title="Crashes" noYAxis={true}
              plotStyle={{ height: 100, marginBottom: 50 }}
            /> :
            <SeriesPlot title={severity_keys.length === 1 && severity_keys[0]} 
            data= {crashes_data} type= {LineSeries} />
          }
        </div>
      </div >
    return (tooltip)
  }

  _listPropsAndValues(hoveredObject) {
    let DATA = []
    const props = hoveredObject.properties;
    if(props) {
      DATA = Object.keys(props)
      .map(p => {
        return([humanize(p), props[p]])
      })
    } else { // two points passed go through first one
      DATA = Object.keys(hoveredObject.points[0].properties)
      .map(p => {
        let points = [
          humanize(p), 
          hoveredObject.points[0].properties[p],
        ]
        if(hoveredObject.points[1]) {
          points.push(hoveredObject.points[1].properties[p])
        }
        return(points)
      })
    }
    return <Table style={{maxWidth: '320px'}} 
    columns={
      hoveredObject.points && 
      hoveredObject.points.length === 2 ? 
      ['Property', 'Value p1', 'Value p2'] : ['Property', 'Value'] 
    } data={DATA} />

  }
}