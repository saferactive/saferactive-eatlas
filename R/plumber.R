packages <- c("sf", "geojsonsf", "curl")
if (length(setdiff(packages, rownames(installed.packages()))) > 0) {
  install.packages(setdiff(packages, rownames(installed.packages())),repos='http://cran.us.r-project.org')
}

lapply(packages, library, character.only = TRUE)

if(is.null(curl::nslookup("r-project.org", error = FALSE))) {
  stop(message(
    "No connection",
    "To save space on the repo files need to be downloaded.",
    "Please re-run when you are connected."
  ))
}

main.file <- "casualties_active_london.Rds"
rnet.file <- "rnet_walking_london.Rds"

github <- "https://github.com/saferactive/saferactiveshiny/releases/download/0.0.2"

if(!file.exists(main.file)) {
  download.file(
    file.path(github, main.file),
    destfile = main.file)
}

if (!file.exists(rnet.file)) {
   download.file(
     file.path("www.github.com/saferactive/saferactive/releases/download/0.1",
     rnet.file),
     destfile = rnet.file
   )
}

# Enable CORS -------------------------------------------------------------
#' CORS enabled for now. See docs of plumber
#' for disabling it for any endpoint we want in future
#' https://www.rplumber.io/docs/security.html#cross-origin-resource-sharing-cors
#' @filter cors
cors <- function(res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  plumber::forward()
}
# TODO: option to remove above CORS

#' @section TODO:
#' The plumber endpoint should not be there. Currently mapping React build to /
#' at assets causes the swagger endpoint to be 404. Support is limited.
#'
#' @get /__swagger__/
swagger <- function(req, res){
  fname <- system.file("swagger-ui/index.html", package = "plumber") # serve the swagger page.
  plumber::include_html(fname, res)
}

casualtiese = readRDS(main.file)
casualtiese_geojson = geojsonsf::sf_geojson(casualtiese)

#' Serve casualties data
#' @get /api/stats19
cas_geojson <- function(res){
  res$headers$`Content-type` <- "application/json"
  res$body <- casualtiese_geojson
  res
}


walking.rnet = readRDS(rnet.file)
walking.rnet = geojsonsf::sf_geojson(walking.rnet)

#' Serve rnet data
#'  @get /api/walking
rnet_geojson <- function(res){
  res$headers$`Content-type` <- "application/json"
  res$body <- walking.rnet
  res
}


#' get a subset of results depending on a bbox provided
#' @get /api/stats19/<xmin:double>/<ymin:double>/<xmax:double>/<xmax:double>/
#' @get /api/stats19/<xmin:double>/<ymin:double>/<xmax:double>/<ymax:double>
#'
subs_geojson <- function(res, xmin, ymin, xmax, ymax){
  res$headers$`Content-type` <- "application/json"
  if(exists(c('xmin', 'ymin', 'xmax', 'ymax')) &&
     !is.na(as.numeric(c(xmin, ymin, xmax, ymax)))) {
    cat(c(xmin, ymin, xmax, ymax))

    bbx <- c(xmin = xmin, ymin = ymin, xmax = xmax, ymax = ymax)
    cat(bbx)
    cat(length(accidents))
    subset <-  sf::st_crop(accidents, bbx) # bbox only
    subset_geojson <-  geojsonsf::sf_geojson(subset)
    print(subset)
    print(subset_geojson)
    res$body <- subset_geojson
  } else {
    res$body <- accidents_geojson
  }
  res
}


#' Tell plumber where our public facing directory is to SERVE.
#' No need to map / to the build or public index.html. This will do.
#'
#' @assets ./build /
list()
