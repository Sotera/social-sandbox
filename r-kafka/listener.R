init <- function() {
	require(rkafka)
	require(RJSONIO)
	require(kernlab)
	require(fpc)
	options(stringsAsFactors = F)

	BSIZE      <<- 2000
	ALGFREQ    <<- 500
	dat        <<- c()
	counter    <<- 0
}

init() 

consumer2 = rkafka.createConsumer("127.0.0.1:2181", "instagram_proc")

val <- 'start'
while(val != '') {
	val <- rkafka.read(consumer2)
	print(val)
}

rkafka.closeConsumer(consumer2)