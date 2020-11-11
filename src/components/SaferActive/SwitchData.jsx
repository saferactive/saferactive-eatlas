import * as React from "react";
import { StatefulButtonGroup, MODE } from 'baseui/button-group';
import { Button, KIND, SIZE } from "baseui/button";

import { DEV_URL, PRD_URL } from '../../Constants';
const host = (process.env.NODE_ENV === 'development' ? DEV_URL : PRD_URL);

const urls = {
  Casualties:  host + '/api/stats19',
  Walking: host + '/api/walking',
  Cycling: host + '/api/cycling'
}
export default (props) => {
  const { onSelectCallback } = props;
  return (
    <StatefulButtonGroup
      mode={MODE.radio}
      kind={KIND.secondary}
      size={SIZE.compact}
      initialState={{ selected: 0 }}
    >
      {
        Object.keys(urls).map(each =>
          <Button
            key={each}
            onClick={() =>
              onSelectCallback && onSelectCallback(urls[each])
            }>
            {each}
          </Button>)
      }
    </StatefulButtonGroup>
  );
}