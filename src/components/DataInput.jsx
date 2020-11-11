import * as React from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
  FocusOnce,
} from 'baseui/modal';

import File from './File'
import URL from './URL';
import { DEV_URL, PRD_URL } from '../Constants';

/**
 * The package is by mapbox. 
 * 
 * GDAL specs have been taken into consideration according to
 * package docs. The package creats lines and polygons from 
 * correct csv files.
 * 
 * There has been good effort into guessing the naming of
 * lat/longs, see 
 * https://github.com/mapbox/csv2geojson/blob/gh-pages/index.js
 * 
 * From the package
 * var latRegex = /(Lat)(itude)?/gi,
 *  lonRegex = /(L)(on|ng)(gitude)?/i;
 * 
 */
const csv2geojson = require('csv2geojson');

const partURL = (process.env.NODE_ENV === 'development' ? DEV_URL : PRD_URL);

export default function (props) {
  const [isOpen, setOpen] = React.useState(false);
  const { urlCallback, toggleOpen } = props;

  return (
    <React.Fragment>
      <Button
        kind={KIND.secondary} size={SIZE.compact}
        onClick={() => {
          setOpen(s => !s); // or s === isOpen
          typeof toggleOpen === 'function' && toggleOpen()
        }}>Add data</Button>
      <Modal
        onClose={() => {
          typeof (toggleOpen) === 'function' && toggleOpen()
          setOpen(false);
        }}
        isOpen={isOpen}>
        <div className="add-data">
          <ModalHeader>Your data remains on your browser. It is NOT uploaded anywhere.</ModalHeader>
          <ModalBody>
            <FocusOnce>
              <URL urlCallback={(url) => {
                setOpen(false);
                typeof (urlCallback) === 'function'
                  && urlCallback(url)
              }} />
            </FocusOnce>
            <File contentCallback={({ text, name }) => {
              if (name && (name.split(".")[1].match(/geo/) //test.json
                || name.split(".")[1].match(/json/))) {
                try {
                  const json = JSON.parse(text);
                  typeof (urlCallback) === 'function'
                    && urlCallback(null, json, name)
                  setOpen(false);
                } catch (e) {
                  console.log(e);
                }
              } else {
                // err has any parsing errors
                csv2geojson.csv2geojson(text, (err, data) => {
                  if (!err) {
                    typeof (urlCallback) === 'function'
                      && urlCallback(null, data, name)
                  }
                });
              }
            }} />
          </ModalBody>
          <ModalFooter>
            <ModalButton onClick={() => {
              setOpen(false);
              typeof (toggleOpen) === 'function' && toggleOpen();
            }}>Close</ModalButton>
          </ModalFooter>
        </div>
      </Modal>
    </React.Fragment >
  );
}
