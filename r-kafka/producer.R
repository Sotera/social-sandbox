init <- function() {
	require(rkafka)
	require(RJSONIO)	
}

init()
prod1 <- rkafka.createProducer("127.0.0.1:9092")
df    <- readRDS('/sandbox/data/clean_df.rds')
df    <- df[order(df$ntime),]


df <- head(df, 2000)
# -----------------

print('starting...')
i <- 1
while(i < nrow(df)) {
	package <- RJSONIO::toJSON(unlist(df[i,]), auto_unbox = T)
	cat('\n', package, '\n')
	rkafka.send(prod1,"instagram_3","127.0.0.1:9092", package)
	# Sys.sleep(.05)
	i <- i + 1
}

rkafka.closeProducer(prod1)

