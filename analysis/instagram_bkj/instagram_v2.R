require(fpc)
require(kernlab)

clean <- function(df) {
	df$loc.longitude <- as.numeric(df$loc.longitude)
	df$loc.latitude  <- as.numeric(df$loc.latitude)
	df$time          <- as.Date(as.numeric(df$time) / (60 * 60 * 24), 
		origin = '1970-01-01')

	df <- df[df$loc.latitude > 39.236 & df$loc.latitude < 39.373,]
	df <- df[df$loc.longitude > -76.72 & df$loc.longitude < -76.6,]
	df
}

augment <- function(df) {
	df$ntime <- as.numeric(df$time)
	
	df$day <- as.Date(floor(as.numeric(df$time)), '1970-01-01')
	
	df <- df[order(df$loc.lat),]
	df <- df[order(df$loc.lon),]
	
	df$rlat <- order(df$loc.lat)
	df$rlon <- order(df$loc.lon)

	df$rlat <- ( df$rlat - min(df$rlat) ) / ( max(df$rlat) - min(df$rlat) )
	df$rlon <- ( df$rlon - min(df$rlon) ) / ( max(df$rlon) - min(df$rlon) )

	df
}

make_hashtag <- function(x) {
    tmp <- unlist(strsplit(x, ' '))
	tolower(grep('^#', tmp, value = T))	
}

# ---------------

df <- df.orig <- readRDS('data/df.rds')
df <- clean(df)
df <- augment(df)

# ----------------
# Algorithm

# Parameters
SIGMA             <- 1
CLOSE_DEF         <- 0.95
HID_DEF           <- 50    # quantile(.8) is good?
DBSCAN_EPS        <- 0.001
DBSCAN_MIN_POINTS <- 15

days <- sort(unique(df$day))
day  <- '2015-04-10'

pre <- df[df$day < day,]
sub <- df[df$day == day,]

sub$filat <- findInterval(sub$loc.lat, sort(pre$loc.lat))
sub$filon <- findInterval(sub$loc.lon, sort(pre$loc.lon))

sub <- sub[order(sub$ntime),]

# Distance kernel
dsub   <- apply(sub[,c('filat', 'filon')], 2, scale)
k_dist <- kernelMatrix(rbfdot(sigma = SIGMA), dsub)

# Time kernel
tsub   <- apply(sub[,c('ntime'), drop = F], 2, scale)
k_tmp  <- kernelMatrix(rbfdot(sigma = SIGMA), tsub)

k           <- (k_dist + k_tmp) / 2
diag(k)     <- NA
rownames(k) <- colnames(k) <- sub$id

k[lower.tri(k)] <- 0
n_close         <- apply(k, 2, function(x) sum(x > CLOSE_DEF, na.rm = T))
# Should be able to pick this parameter by looking at this plot
plot(sort(n_close))
sel <- which(n_close > HID_DEF) 

# Apply DBSCAN clustering to high density points in space
# to separate events
dbk <- dbscan(
	sub[sel,c('filat', 'filon', 'ntime')],
	eps      = .25,
	showplot = T, 
	MinPts   = DBSCAN_MIN_POINTS,
	scale    = T
)

sub$cl <- 0
sub$cl[sel][dbk$isseed] <- dbk$cluster[dbk$isseed]

# Plot
plot(sub[,c('loc.longitude', 'loc.latitude')], 
	pch = 16,
	cex = sub$cl == 0, 
	col = scales::alpha('grey', .1))
text(sub[sub$cl > 0,c('loc.longitude', 'loc.latitude')], 
	labels = sub$cl[sub$cl > 0], 
	cex = 1,
	col = scales::alpha(sub$cl[sub$cl > 0], .2))

# Print hashtags
lapply(split(sub$text[sub$cl > 0], sub$cl[sub$cl > 0]), function(x) {
	tail(sort(table(make_hashtag(x))), 10)
})

# !!! Use other similarity to set the parameters here !!!
# I.e. choose the epsilon that maximizes in cluster similarity on the other
# metrics

# For streaming, check out streamMOA

# ++++++++++
# Etc


require(tm)
corpus          <- Corpus(VectorSource(sub$text))
tdm <- tdm.orig <- as.matrix( TermDocumentMatrix(corpus) )
colnames(tdm)   <- sub$id
tdm             <- tdm[grep('^#', rownames(tdm)),]
tdm             <- apply(tdm, 2, function(x) {
	x / (1 + sqrt(sum(x^2, na.rm = T)))
})
cos <- t(tdm) %*% tdm

