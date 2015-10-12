# USAGE
# python color_kmeans.py --image images/jp.png --clusters 3

# import the necessary packages
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt
import argparse, utils, os, cv2

args = {
	'plot'    : False,
	'indir'   : 'baltimore_images',
	'outfile' : 'baltimore_features'
}

def make_hist(f, plot = False, n_bins = 5):
	image = cv2.imread(f)
	image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
	
	# show our image
	if args['plot']:
		plt.figure()
		plt.axis("off")
		plt.imshow(image)
	
	color    = ('r','g','b')
	features = []
	for i,col in enumerate(color):
		hist = cv2.calcHist([image], [i], None, [n_bins], [0,256])
		features.extend(hist.flatten())
		
		if args['plot']:
			plt.plot(hist,color = col)
			plt.xlim([0,256])
	
	# Normalized by total number of pixel-channels
	sm       = sum(features)
	features = [x / sm for x in features]
	return features

def write_hist(outfile, hist, fileName):
	hist = [str(f) for f in hist]
	outfile.write("%s,%s\n" % (fileName, ",".join(hist)))

files = os.listdir(args['indir'])
files = [os.path.join(args['indir'], f) for f in files]

with open(args['outfile'], 'w') as outfile:
	for fileName in files:
		try:
			hist = make_hist(fileName, plot = args['plot'])
			write_hist(outfile, hist, fileName)
		except:
			'error @ ' + fileName