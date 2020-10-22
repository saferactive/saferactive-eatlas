
<!-- # eAtlas &middot; [![Build Status](https://travis-ci.org/layik/eAtlas.svg)](https://travis-ci.org/layik/eAtlas) [![Project Status: WIP](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#) -->

This is a [geoplumber](https://github.com/ATFutures/geoplumber) app with
scripts to run either as backend only, frontend only or as a Docker
image for production.

### Run locally

This is how we expect you to run this repo:

1.  Clone the repo and change directory into it

<!-- end list -->

``` r
library(geoplumber)
gp_is_wd_geoplumber()
```

    ## [1] TRUE

2.  In R:

<!-- end list -->

``` r
gp_build()
```

3.  Again in R:

<!-- end list -->

``` r
# install latest from github
gp_plumb()
```

Visit `http://localhost:8000` and you should see something like this
(from clean
clone):

<img alt="Screenshot 2020-07-22 at 17 22 59" src="https://user-images.githubusercontent.com/408568/88201918-03167c80-cc40-11ea-8f45-371963a92e19.png" width="100%" />

If the default browser tab opened and not loading, reload and it must
work. That is an issue for package `geoplumber` to deal with.

Read on for more.

### Development

#### typical environment

1.  Start background process by running: `Rscript run.R` which starts
    the backend at `localhost:8000`
2.  Start front end separately by running: `npm start`

Then use `localhost:3000` as you edit front end. You can use
`localhost:8000` if you like to see the API endpoints such as
`localhost:8000/api/stats19`.

#### Front only

The front end is an npm package, so if you do not need the backend,
having cloned the repo:

``` js
npm i # or yarn
# and run
npm start
```

<script type="text/javascript">
npm i # or yarn
# and run
npm start
</script>

This is what you should see at `localhost:3000`:
<img src="https://user-images.githubusercontent.com/1825120/88171123-b9656c00-cc16-11ea-8aed-bdd56fa8d17e.png" width="100%" />
The frontend is a
[`create-react-app`](https://create-react-app.dev/docs/getting-started/)
(CRA) so all the standard commands of CRA appliees.

#### Full stack

The application is a
[geopumber](https://github.com/ATFutures/geoplumber) app. That means it
is an R powered backend API (think Flask in Python) and a ReactJS front
end.

To build the frontend if never built before, from an R console:

``` r
remotes::install_github("atfutures/geoplumber")
library(geoplumber)
gp_build()
```

Then you can run

``` r
# install latest from github
library(geoplumber) 
gp_plumb()
```

notice we bind the default port of 8000 matches what is in
`Constants.js` as production URL because we are using the `build`
folder, you can now visit `http://localhost:8000`.

OR you could `Rscript run.R` which uses the same port and host values.

Pleasee note: \* if you like to use Mapbox tiles, you can use a Mapbox
API key in `.env.local` file using variable name:
`REACT_APP_MAPBOX_ACCESS_TOKEN = 'API_KEY'`

  - in production one must change the `PRD_URL` in the `Constants.js`
    file and *use Docker*.

## Docker for production

Repo contains Dockerfile for production. This is again WIP.

``` sh
# Dockerfile manages your npm/React build steps
# REACT_APP_MAPBOX_ACCESS_TOKEN is required but app should run
docker build -t eatlas .
# note: here we bind internal 8000 to external (host machine)'s 8001.
# The reason for internal 8000 is in the Dockerfile we use 8000 as the plumber port. 
# It is your choice how you want to do this.
docker run -d -p 8000:8001 --name eatlas eatlas
```

Use your favourite document server (nginx for example) to proxy requets
(more later hopefully).
