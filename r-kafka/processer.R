config = list(
	# consumer_ip    = "10.3.2.75:2181",
	# producer_ip    = "10.3.2.75:9092",
	consumer_ip    = '10.202.20.70:2181',
	producer_ip    = "10.202.20.70:9092",
	consumer_topic = 'throwaway',
	producer_topic = 'instagram_fake'
)


init <- function() {
	require(rkafka)
	require(RJSONIO)
	require(jsonlite)
	require(kernlab)
	require(fpc)
	options(stringsAsFactors = F)

	BSIZE    <<- 4000
	ALGFREQ  <<- 1000
	dat      <<- c()
	counter  <<- 0
}

init() 

detect_events <- function(df, plot = F) {
	
	SIGMA             <- 1
	CLOSE_DEF         <- 0.85
	HID_DEF           <- 25 # 50 # quantile(.8) is good?
	DBSCAN_EPS        <- 0.1
	DBSCAN_MIN_POINTS <- 10
	
	pre <- head(df, nrow(df) * 0.75)
	sub <- tail(df, nrow(df) * 0.25)
	
	sub$filat <- findInterval(sub$loc.lat, sort(pre$loc.lat))
	sub$filon <- findInterval(sub$loc.lon, sort(pre$loc.lon))
	
	# Distance kernel
	dsub   <- apply(sub[,c('filat', 'filon')], 2, scale)
	k_dist <- kernelMatrix(rbfdot(sigma = SIGMA), dsub)

	# Time kernel
	tsub   <- apply(sub[,c('time'), drop = F], 2, scale)
	k_tmp  <- kernelMatrix(rbfdot(sigma = SIGMA), tsub)
	
	k           <- (k_dist + k_tmp) / 2
	diag(k)     <- NA
	rownames(k) <- colnames(k) <- sub$id

	n_close <- apply(k, 2, function(x) sum(x > CLOSE_DEF, na.rm = T))
	# Should be able to pick this parameter by looking at this plot
	# plot(sort(n_close))
	sel <- which(n_close > HID_DEF)
	
	# Apply DBSCAN clustering to high density points in space
	# to separate events
	print('scan')
	dbk <- dbscan(
		sub[sel,c('loc.latitude', 'loc.longitude')],
		eps      = .1,
		showplot = T, 
		MinPts   = 10,
		scale    = T
	)
	
	print('end')
	sub$cl <- 0
	sub$cl[sel][dbk$isseed] <- dbk$cluster[dbk$isseed]
	
	lapply(split(sub$text[sub$cl > 0], sub$cl[sub$cl > 0]), function(x) {
		tail(sort(table(make_hashtag(x))), 10)
	})

	
	if(plot) {
		cat('\n------------------------------\n', max(sub$time))
		pdf(paste0('/sandbox/plots/', max(sub$time), '.pdf'))
		plot(sub[,c('loc.longitude', 'loc.latitude')],
			pch = 16,
			cex = sub$cl == 0,
			col = scales::alpha('grey', .1))
		text(sub[sub$cl > 0,c('loc.longitude', 'loc.latitude')],
			labels = sub$cl[sub$cl > 0],
			cex = 1,
			col = scales::alpha(sub$cl[sub$cl > 0], .2))
		dev.off()
		cat('\n------------------------------\n')
	}
	
	saveRDS(df,  paste0('df_', counter, '.rds'))
	saveRDS(sub, paste0('sub_', counter, '.rds'))
	

	return(sub)
}


bind <- function(dat, x) {
	x <- lapply(x, function(x) {
		if(is.null(x)) {
			NA
		} else {
			x
		}
	})
	
	x <- data.frame(x)
	tail(rbind(dat, x), BSIZE)
}

process <- function(val_) {	
	
	x <- list(
		id            = val_$id,
		time          = as.numeric(val_$created_time),
		loc.latitude  = as.numeric(val_$location['latitude']),
		loc.longitude = as.numeric(val_$location['longitude']),
		text          = val_$caption$text
	)
	
	dat     <<- bind(dat, x)
	counter <<- counter + 1
	print(counter)
	if((counter %% ALGFREQ == 0) && (nrow(dat) >= BSIZE)) {
		print('detecting!')
		detect_events(dat)
	} else {
		NULL
	}
}

make_hashtag <- function(x) {
    tmp <- unlist(strsplit(x, ' '))
	tolower(grep('^#', tmp, value = T))	
}

# ----
# Hooking up to queue


con  = rkafka.createConsumer(config$consumer_ip, config$consumer_topic, groupId = 'processor-group', autoCommitInterval = '1000')
prod = rkafka.createProducer(config$producer_ip)

val.orig <- 'start'
while(val.orig != '') {

	# Read from queue
	sink(file = '/dev/null')
	val <- val.orig <- rkafka.read(con)
	sink()
	try({
		val <- RJSONIO::fromJSON(val)[[1]]
		res <- process(val)
		if(!is.null(res)) {
			
			res <- res[res$cl != 0,]
			out <- lapply(split(res, res$cl), function(x) {
				list(
					hashtags = names(tail(sort(table(make_hashtag(x$text))), 10)),
					posts    = nrow(x),
					lat   = list(
						max = max(x$loc.lat),
						min = min(x$loc.lat)
					),
					lon   = list(
						max = max(x$loc.long),
						min = min(x$loc.long)
					)
				)
			})
			
			rkafka.send(prod, config$producer_topic, config$producer_ip, paste(RJSONIO::toJSON(out), ' '))
		}
	})
	
}

rkafka.closeConsumer(con)
rkafka.closeProducer(prod)
