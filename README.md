
<!-- # eAtlas &middot; [![Build Status](https://travis-ci.org/layik/eAtlas.svg)](https://travis-ci.org/layik/eAtlas) [![Project Status: WIP](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#) -->

### Development

The front end is an npm package, so if you do not need the backend,
having cloned the repo:

``` js
npm i # or yarn
# and run
npm start
```

This is what you should see at `localhost:3000`:
<img src="https://user-images.githubusercontent.com/1825120/88171123-b9656c00-cc16-11ea-8aed-bdd56fa8d17e.png" width="100%" />
The frontend is a
[`create-react-app`](https://create-react-app.dev/docs/getting-started/)
(CRA) so all the standard commands of CRA appliees.

### full stack

The application is a
[geopumber](https://github.com/ATFutures/geoplumber) app. That means it
is an R powered backend API (think Flask in Python) and a ReactJS front
end.

To build the frontend if never built before, from an R console:

``` r
library(geoplumber)
gp_build()
```

Then you can run

``` r
# install latest from github
library(geoplumber) 
gp_plumb() 
```

visit `localhost:8000`

OR you could `Rscript run.R`

  - if you like to use Mapbox tiles, you can use a Mapbox API key in
    `.env.local` file using variable name:
    `REACT_APP_MAPBOX_ACCESS_TOKEN = 'API_KEY'`

  - in production one must change the `PRD_URL` in the `Constants.js`
    file and *use Docker*.

### Docker for production

Repo contains Dockerfile for production. This is again WIP.

``` sh
# Dockerfile manages your npm/React build steps
# REACT_APP_MAPBOX_ACCESS_TOKEN is required but app should run
docker build -t eatlas .
# then bind plumber's default 8000 port to any of your choice
docker run -d -p 8000:8001 --name eatlas eatlas
```

Use your favourite document server (nginx for example) to proxy requets
(more later hopefully).
