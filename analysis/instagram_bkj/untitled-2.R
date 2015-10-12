library("streamMOA")

stream <- DSD_Memory(DSD_BarsAndGaussians(noise=0.05), n=5500)

sample <- DSC_TwoStage(micro=DSC_Sample(k=100), macro=DSC_Kmeans(k=4))
window <- DSC_TwoStage(micro=DSC_Window(horizon=100), macro=DSC_Kmeans(k=4))
dstream <- DSC_DStream(gridsize=.7)
dbstream  <- DSC_DBSTREAM(r=.5)
denstream <- DSC_DenStream(epsilon=.5, mu=1)
clustream <- DSC_CluStream(m=100, k=4)

plot(stream)

algorithms <- list(Sample=sample, Window=window, dstream=dstream, DBSTREAM=dbstream, DenStream=denstream, CluStream=clustream)
for(a in algorithms) {
	reset_stream(stream)
	update(a, stream, 5000)
}

sapply(algorithms, nclusters, type="micro")

op <- par(no.readonly = TRUE)
layout(mat=matrix(1:6, ncol=2))
for(a in algorithms) {
	reset_stream(stream)
	plot(a, stream, main=a$description, assignment=TRUE, weight=FALSE, type="both")
}
par(op)

reset_stream(stream)
plot(algorithms$DBSTREAM)

# ----------

# alg <- DSC_TwoStage(micro=DSC_Window(k=500), macro=DSC_DenStream(epsilon=.01, mu=1))

x <- read.csv('/vagrant/sub.csv', as.is = T)
x <- x[order(x$ntime),]
x <- x[,-1]
x <- as.matrix(x)
x <- x[,-3]
x <- x[, c(2, 1)]
stream <- DSD_Memory(x)

reset_stream(stream)

alg <- DSC_DenStream(epsilon=.05, initPoints = 10)

update(alg, stream, 500)
p <- get_points(stream, 1)
get_assignment(alg, p, method = 'auto')

plot(alg, stream, type = 'both')

update(alg, stream)
plot(alg, stream, type = 'both')

points <- get_points(stream, 100)
labs   <- get_assignment(alg, points, type = 'macro')
table(labs)


stream <- DSD_Gaussians(k=3)
win_km <- DSC_TwoStage(
	micro=DSC_Window(horizon=100), 
	macro=DSC_Kmeans(k=3)
) 
win_km

update(win_km, stream, 200) 
win_km
plot(win_km, stream, type="both")  
evaluate(win_km, stream, assign="macro")




stream <- DSD_Gaussians(k=3, d=2, noise=0.05)
     
# Use DBSCAN to recluster micro clusters (a sample)
sample <- DSC_Sample(k=100)
update(sample, stream, 500)
plot(sample, stream)

dbscan <- DSC_DBSCAN(eps = .07)
recluster(dbscan, sample)
plot(dbscan, stream, type="both")




# ------------------------

# 3 clusters with 5% noise
stream    <- DSD_Gaussians(k=3, d=2, noise=0.50)

denstream <- DSC_DenStream(epsilon=.05)
update(denstream, stream, 500)
denstream

# show macro-clusters (using density reachability with epsilon x offline)
plot(denstream, stream, type="both")

stream <- DSD_Gaussians(k=3, d=2, noise=0.05)

clustree <- DSC_ClusTree(maxHeight=3)
update(clustree, stream, 500)
clustree

# plot micro-clusters
plot(clustree, stream)


# create a two stage clusering using ClusTree and reachability reclustering 
reset_stream(stream)
CTxReach <- DSC_TwoStage(
	micro=DSC_ClusTree(maxHeight=1), 
	macro=DSC_Reachability(epsilon = .01)
)
CTxReach
zz <- update(CTxReach, stream, 250)
stream
plot(CTxReach, stream, type="both")
