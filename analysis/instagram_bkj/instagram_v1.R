init <- function() {
	require(YaleToolkit)
	require(scales)
	options(stringsAsFactors = F)
	require(RJSONIO)
	require(iotools)
	require(plyr)
	require(doMC)
	registerDoMC(cores = 6)
	
	INPATH <<- 'instagram.json.txt'
}

init()

df <- df.orig <- chunk.apply(INPATH, function(o) {
	print('.')
	out <- lapply(mstrsplit(o, sep = '\n'), fromJSON)
	out <- lapply(out, function(x) {
		# x <- fromJSON(x)
		list(
			id   = x$`_id`,
			time = x$`_source`$created_time,
			loc  = x$`_source`$location,
			text = x$`_source`$caption$text
		)
	})

	ldply(out, .fun = function(x) as.data.frame(t(unlist(x))), .parallel = T)
})

df.orig <- df
saveRDS(df, 'df.rds')
df <- readRDS('df.rds')
# -------------------
# Mapping
df$loc.longitude <- as.numeric(df$loc.longitude)
df$loc.latitude  <- as.numeric(df$loc.latitude)
df$time          <- as.Date(as.numeric(df$time) / (60 * 60 * 24), origin = '1970-01-01')

df <- df[df$loc.latitude > 39.236 & df$loc.latitude < 39.373,]
df <- df[df$loc.longitude > -76.7 & df$loc.longitude < -76.6,]

plot(df$loc.latitude ~ df$loc.longitude, cex = .005)

# ---------------------
# Time series

hist(df$time, 1000)


# ----------------------
# Together

make_plots <- function(df) {
	pairs(df[,c('loc.latitude', 'time', 'loc.longitude')], cex = .02, col = alpha('black', .1))
	# dev.new()
	# hist(df$loc.latitude, 1000)
	# dev.new()
	# hist(df$loc.longitude, 1000)
}

make_plots(df)

# -----------------------
# Just downtown
dfsub <- df
dfsub <- dfsub[dfsub$loc.latitude > 39.28 & dfsub$loc.latitude < 39.30,]
dfsub <- dfsub[dfsub$loc.longitude > -76.61 & dfsub$loc.longitude < -76.6,]

make_plots(dfsub)

# ----------------------
# Geographic warping

scale_ <- function(x) {
	x <- x - min(x)
	x <- x / max(x)
	x
}

df2            <- df
df2$scaled.lat <- scale_(df2$loc.lat)
df2$scaled.lon <- scale_(df2$loc.lon)

# Rescale lat
df2         <- df2[order(df2$loc.lat),]
df2$ind     <- as.numeric(cut(df2$scaled.lat, 1000))
tb          <- table(df2$ind)
df2$cum.lat <- cumsum(tb)[df2$ind]

# Rescale lo
df2         <- df2[order(df2$loc.lon),]
df2$ind     <- as.numeric(cut(df2$scaled.lon, 1000))
tb          <- table(df2$ind)
df2$cum.lon <- cumsum(tb)[df2$ind]

df2$rlat    <- order(df2$scaled.lat)
df2$rlon    <- order(df2$scaled.lon)

df2$rlat  <- ( df2$rlat - min(df2$rlat) ) / ( max(df2$rlat) - min(df2$rlat) )
df2$rlon  <- ( df2$rlon - min(df2$rlon) ) / ( max(df2$rlon) - min(df2$rlon) )
df2$time2 <- ( df2$time - min(df2$time) ) / ( max(df2$time) - min(df2$time) )

dev.new()
pairs(df2[,c('rlat', 'time', 'rlon')], cex = .02, col = scales::alpha('black', .1))
dev.new()
pairs(df[,c('loc.latitude', 'time', 'loc.longitude')], cex = .02, col = scales::alpha('black', .1))

par(mfcol = c(2, 1), mar = rep(2, 4))
plot(df2$loc.longitude ~ df2$time, cex = .02)
plot(df2$rlon ~ df2$time, cex = .02, xlim = c(16535, 16540))

# -------------------------------
# Density estimation for a given day
df3     <- df
df3$day <- floor(as.numeric(df3$time))
days    <- sort(unique(df3$day))[-1]

day <- 16535 # April 10
# day <- 16560 # April 27

pre       <- df3[df3$day < day,]
sub       <- df3[df3$day == day,]
sub$filat <- findInterval(sub$loc.lat, sort(pre$loc.lat))
sub$filon <- findInterval(sub$loc.lon, sort(pre$loc.lon))
sub$ntime <- as.numeric(sub$time)

par(mfcol = c(2, 1), mar = rep(2, 4))
plot(sub$loc.longitude, sub$loc.latitude, cex = .2)
plot(sub$filon, sub$filat, cex = .2)

dsub        <- sub[,c('filat', 'filon', 'ntime')]
dsub        <- apply(dsub, 2, scale)
d           <- as.matrix(dist(dsub))
colnames(d) <- rownames(d) <- sub$id
close_dist  <- apply(d, 2, function(x) mean(head(sort(x), 20)))
hist(close_dist, 1000)

nms <- names(which(close_dist < quantile(close_dist, .2)))
par(mfcol = c(2, 1), mar = rep(2, 4))
plot(sub$loc.longitude, sub$loc.latitude, cex = .2, col = 1 + (sub$id %in% nms))
# identify(sub$loc.longitude, sub$loc.latitude)
plot(sub$filon, sub$filat, cex = .2, col = 1 + (sub$id %in% nms))

unique(sub[sub$id %in% nms,'text'])

# -------------------------------

x        <- df
x$day    <- floor(as.numeric(x$time))
x$ntime  <- as.numeric(x$time)

# day <- 16533

# x <- x[x$day <= day,]
# x$pre <- x$day < day

x$latbin <- cut(x$loc.lat, 10)
x$lonbin <- cut(x$loc.lon, 10)
x$bin    <- paste(as.character(x$latbin), as.character(x$lonbin))

s <- split(x, x$bin)
s <- lapply(s, function(x) {
	x$latbin_sub <- cut(x$loc.lat, 3)
	x$lonbin_sub <- cut(x$loc.lon, 3)
	x$bin_sub    <- paste(as.character(x$latbin_sub), as.character(x$lonbin_sub))	
	x
})

feats <- lapply(s, function(x) {
	x$day <- as.factor(x$day)
	do.call(rbind, lapply(split(x, x$bin_sub), function(y) {
		table(y$day)	
	}))
})

ss <- do.call(rbind, s)

ss[ss$day == 16549 & ss$bin_sub == '(39.249,39.253] (-76.62,-76.617]','text']
	
feats[[12]][,c(24, 40)]
identify(cmdscale(dist(t(feats[[12]]))))

# -------------------------------
# Trying to do density estimation

df2$time <- as.numeric(df2$time)

mm   <- df2[,c('rlon', 'time', 'rlat')]
mm   <- mm[mm$time >= 16535 & mm$time <= 16540,]
fhat <- kde(x = mm)

mmm        <- mm[sample(1:nrow(mm), .4 * nrow(mm)),]
mmm        <- apply(mmm, 2, function(x) (x - min(x)) / (max(x) - min(x)))
fhat2      <- kde(x = mmm)
fhat2$melt <- melt(fhat2$estimate)
hid        <- fhat2$melt[fhat2$melt$value > quantile(fhat2$melt$value, .99),]

eps <- do.call(cbind, fhat2$eval.points)
hid <- cbind(hid, t(apply(hid, 1, function(x) c(
		eps[x[1], 1],
		eps[x[2], 2],
		eps[x[2], 3]
	)
)))


pairs(hid[,-(1:4)])



dbk <- dbscan(mm, eps = .5, scale = T, showplot = 1, par(cex = .2))
pairs(head(mm, 3000), col = dbk$cluster, cex = .2)

# ---------------------
# Out of sample geographic warping
df3      <- df
df3$time <- floor(as.numeric(df3$time))
days     <- sort(unique(df3$time))[-1]
for(day in days) {
	cat('.')
	pre       <- df3[df3$time < day,]
	sub       <- df3[df3$time == day,]
	sub$filat <- findInterval(sub$loc.lat, sort(pre$loc.lat))
	sub$filon <- findInterval(sub$loc.lon, sort(pre$loc.lon))
	
	par(mfcol = c(2, 1), mar = rep(2, 4))
	plot(sub$filat ~ sub$filon, cex = .1, main = day)
	plot(sub$loc.lat ~ sub$loc.lon, cex = .1, main = day)
	day <- day + 1
}

