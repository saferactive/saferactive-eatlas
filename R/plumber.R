packages <- c("sf", "curl")
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
github <- "https://github.com/saferactive/saferactiveshiny/releases/download/0.0.2"

if(!file.exists(main.file)) {
  download.file(
    file.path(github,
           main.file),
    destfile = main.file)
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

# write geojson
casualtiese = readRDS(main.file)
sf::st_write(casualtiese, "cas.geojson")
casualtiese_geojson = readLines("cas.geojson")
# casualtiese_geojson = geojsonsf::sf_geojson(casualtiese)

#' @get /api/stats19
all_geojson <- function(res){
  res$headers$`Content-type` <- "application/json"
  res$body <- casualtiese_geojson
  res
}

#' Tell plumber where our public facing directory is to SERVE.
#' No need to map / to the build or public index.html. This will do.
#'
#' @assets ./build /
list()