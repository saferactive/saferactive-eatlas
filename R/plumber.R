packages <- c("sf", "geojsonsf", "curl", "data.table", "stats19")
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


casualties = readRDS(main.file)
casualties = casualties[,grep("accident_|lat|long|
vehicles|casualties|date|day_|sex_of_casualty|age_of_casualty|
age_band_of_casualt|sex|vehicle_type|casualty_type|road_type|
time|local_|road_cl|limit|urban|junction_det|
class|pedestrian_crossing$|force", names(casualties))]
dt <- as.data.table(casualties)
# leaves geometry as "sfc_POINT" "sfc"
coordinates <- st_coordinates(dt$geometry)
dt$lon <- coordinates[,1]
dt$lat <- coordinates[,2]
# casualties_geojson = geojsonsf::sf_geojson(casualties)
limit = 10000

#' #' Serve casualties data
#' #' @get /api/stats19
#' cas_geojson <- function(res){
#'   res$headers$`Content-type` <- "application/json"
#'   res$body <- casualties_geojson
#'   res
#' }


walking.rnet = readRDS(rnet.file)
walking.rnet = geojsonsf::sf_geojson(walking.rnet)

#' #' Serve rnet data
#' #'  @get /api/walking
#' rnet_geojson <- function(res){
#'   res$headers$`Content-type` <- "application/json"
#'   res$body <- walking.rnet
#'   res
#' }


#' Get a subset of results depending on a bbox provided
#'
#' By default the function/endpoint checks for default values of bbx
#' bing c(0,0,0,0) if so a subset of the current data is sent for default
#' loading. Then onwards, checks the values sent from client, if 0 or above 10k
#' alert user appropriately in a message, if above 1 and below 10k return
#' The results.
#'
#' @get /api/stats19/<xmin:double>/<ymin:double>/<xmax:double>/<xmax:double>/
#' @get /api/stats19/<xmin:double>/<ymin:double>/<xmax:double>/<ymax:double>
#'
subs_geojson <- function(res, xmin, ymin, xmax, ymax, download = ""){
  mm <- c(xmin, ymin, xmax, ymax)
  subset_geojson <- NULL
  print(mm)
  if(exists(c('xmin', 'ymin', 'xmax', 'ymax')) &&
     !is.na(as.numeric(mm))) {
    if(all(mm == 0)) {
      bbx <- sf::st_bbox(casualties) - 0.27 # send the data to start with
      subset <-  sf::st_crop(casualties, bbx)
      subset <- subset_dt_sf(bbx[[1]], bbx[[2]], bbx[[3]], bbx[[4]])
      # print(nrow(subset))
      subset_geojson <-  geojsonsf::sf_geojson(subset)
      # subset <- dt[sample(nrow(dt), limit),]
      # subset_geojson <- sf_geojson(st_as_sf(subset))
    } else {
      # bbx <- c(xmin = xmin, ymin = ymin, xmax = xmax, ymax = ymax)
      # subset <-  sf::st_crop(casualties, bbx)
      subset <- subset_dt_sf(xmin, ymin, xmax, ymax)
      print(nrow(subset))
      if(nrow(subset) == 0) {
        return(list(Message = "No records found."))
      }
      if(nrow(subset) > limit) {
        return(list(Message = "Message: please zoom to load less data."))
      }
      subset_geojson <-  geojsonsf::sf_geojson(subset)
    }
  } else {
    return(m)
  }
  if(identical(download, "true")) {
    res$headers$`Content-disposition` <- "attachment; filename=sa-crashes.json"
  }
  res$headers$`Content-type` <- "application/json"
  res$body <- subset_geojson
  res
}

subset_dt_sf <- function(xmin, ymin, xmax, ymax){
  # TODO: make sure DT exists?
  subdt <- data.table()
  if(exists(c('xmin', 'ymin', 'xmax', 'ymax')) &&
     !is.na(as.numeric(c(xmin, ymin, xmax, ymax)))) {
    subdt <- dt[lon >= xmin & lon < xmax & lat >= ymin & lat < ymax, -c("lon", "lat")]
  } else {
    stop("bounding box is required.")
  }
  # quick solution via sf again!
  subdt <- st_as_sf(subdt)
}

#' Find a particular accident details
#'
#' @serializer unboxedJSON
#' @get /api/accident/<index>/
#' @get /api/accident/<index>
get_accident <- function(index) {
  m <- list(Error = "Error: please provide valid accident index.")
  # sanity checks
  if(is.na(index) || is.null(index) ||
     nchar(index) > 15 || nchar(index) < 10) {
    return(m)
  }
  # invisible(force(index))
  a = acc[accident_index == index]
  c = cas[accident_index == index]
  v = veh[accident_index == index]
  if(all(nrow(a) == 0 && nrow(c) == 0 && nrow(v) == 0)) {
    print("No results")
    return(list(error="No results"))
  }
  list(acc=a, cas=c, veh=v)
}

# download the tiles from github and put them in build
# if there is no build create dir
# the rest is dealt with by plumber as it serves contents of
# build as ROOT so tiles will be available from /rnet-bike-tiles
if(!dir.exists("../build")) {
  dir.create("../build")
}
if(!dir.exists("../build/raster")) {
  download.file("https://github.com/saferactive/saferactive/releases/download/0.1.1/rnet-bike-tiles.zip",
                dest = "../build/rnet-bike-tiles.zip")
  unzip("../build/rnet-bike-tiles.zip", exdir = "../build")
  file.remove("../build/rnet-bike-tiles.zip")
  system("mv ../build/rnet-bike-tiles ../build/raster")
}

if(!dir.exists("../build/rnet_cycling")) {
  download.file("https://github.com/saferactive/saferactive/releases/download/0.1.1/rnet_cycling.zip",
                dest = "../build/rnet_cycling.zip")
  unzip("../build/rnet_cycling.zip", exdir = "../build")
  file.remove("../build/rnet_cycling.zip")
}

#' Tell plumber where our public facing directory is to SERVE.
#' No need to map / to the build or public index.html. This will do.
#'
#' @assets ../build /
list()

########### Loading full stats19 ######
#######################################
ptm <- proc.time()
# TODO get Dockerfile volume right
# years = c(1979,2005,2015:2019)
years = c(2018)
dd = "."
if(nchar(Sys.getenv("STAST19_DATA_DIR")) > 0) dd = Sys.getenv("STAST19_DATA_DIR")
if(!dir.exists(dd)) {
  # maybe it does not exist due to volume error or other
  # create it it
  dir.create(dd, recursive = TRUE)
}
# read
acc = get_stats19(year = years, data_dir = dd, type = "acc")
cas = get_stats19(year = years, data_dir = dd, type = "cas")
veh = get_stats19(year = years, data_dir = dd, type = "veh")

# just in case
stopifnot(all(acc$accident_index %in% cas$accident_index))
stopifnot(all(cas$accident_index %in% acc$accident_index))

# data.table
acc = as.data.table(acc)
cas = as.data.table(cas)
veh = as.data.table(veh)
print(proc.time() - ptm)
