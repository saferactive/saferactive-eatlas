/**
 * geoplumber R package code.
 */
import React, { useState } from 'react';
import { Switch, Route } from 'react-router-dom';

import Welcome from './Welcome';
import Header from './components/Header';
import About from './About';

import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider, LightTheme, DarkTheme } from 'baseui';
import { Client as Styletron } from 'styletron-engine-atomic';

import '../node_modules/react-vis/dist/style.css';

import './App.css';

const engine = new Styletron();

/**
 * Separate the Header and the main content.
 * Up to this point we are still not using SSR
 */
function App() {
    const [dark, setDark] = useState(true)
    
    return (
      <main>
        <Header dark={dark}
        toggleTheme={() => setDark(!dark)}/>
        <StyletronProvider value={engine}>
          <BaseProvider theme={dark ? DarkTheme : LightTheme}>
            <Switch>
              <Route exact path="/" component={(props) => <Welcome 
              {...props}
              dark={dark}
              />} />
              <Route exact path="/about" component={About} />
            </Switch>
          </BaseProvider>
        </StyletronProvider>
      </main>
    )
}

export default App;
