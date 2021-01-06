import {CompositeLayer} from '@deck.gl/core';
import {IconLayer} from '@deck.gl/layers';
import { options } from 'marked';
import Supercluster from 'supercluster';

function getIconName(size) {
  if (size === 0) {
    return '';
  }
  if (size < 10) {
    return `marker-${size}`;
  }
  if (size < 100) {
    return `marker-${Math.floor(size / 10)}0`;
  }
  return 'marker-100';
}

function getIconSize(size) {
  return Math.min(100, size) / 100 + 1;
}

export default class IconClusterLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex = changeFlags.dataChanged || props.sizeScale !== oldProps.sizeScale;

    if (rebuildIndex) {
      const index = new Supercluster({maxZoom: 16, radius: props.sizeScale});
      index.load(
        props.data.map(d => ({
          geometry: {coordinates: props.getPosition(d)},
          properties: d
        }))
      );
      this.setState({index});
    }

    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex || z !== this.state.z) {
      this.setState({
        data: this.state.index.getClusters([-180, -85, 180, 85], z),
        z
      });
    }
  }

  getPickingInfo({info, mode}) {
    const pickedObject = info.object && info.object.properties;
    if (pickedObject) {
      if (pickedObject.cluster && mode !== 'hover') {
        info.objects = this.state.index
          .getLeaves(pickedObject.cluster_id, 25)
          .map(f => f.properties);
      }
      info.object = pickedObject;
    }
    return info;
  }

  renderLayers() {
    const {data} = this.state;
    const {iconAtlas, iconMapping, sizeScale} = this.props;

    return new IconLayer(
      this.getSubLayerProps({
        id: 'icon',
        data,
        iconAtlas,
        iconMapping,
        sizeScale,
        getPosition: d => d.geometry.coordinates,
        // getIcon: d => getIconName(d.properties.cluster ? d.properties.point_count : 1),
        getIcon: d => {
          // console.log(d);
          if(d.properties.cluster) return getIconName(d.properties.point_count)
          // now the actual object is returned
          /*
          * {geometry:{coordinates:[lon,lat]}, properties:{gejsonObj}}
          */
          let ct = d.properties.properties &&
          d.properties.properties.casualty_type
          ct = ct && ct.substring(0,2).toLowerCase()
          let cs = d.properties.properties &&
          d.properties.properties.accident_severity
          cs = cs && cs === "Slight" ? "" : cs.substring(0,1).toLowerCase()

          const opts = [
            'marker-dr-f', 'marker-pe-f', 'marker-cy-f', 'marker-fam-f',
            'marker-dr', 'marker-pe', 'marker-cy', 'marker-fam',
            'marker-dr-s', 'marker-pe-s', 'marker-cy-s', 'marker-fam-s',
          ]
          const iconName = "marker-" + ct + (cs ? ("-" + cs) : "");
          if(opts.includes(iconName)) return opts[opts.indexOf(iconName)]
          return getIconName(1)
        },
        getSize: d => getIconSize(d.properties.cluster ? d.properties.point_count : 1)
      })
    );
  }
}
