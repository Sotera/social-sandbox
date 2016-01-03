import os, sys, itertools,  re
# not used? import zipfile, io, h5py,numpy as np
import pandas as pd
import redis
import time
import argparse

parser = argparse.ArgumentParser(description='Featurize some instagram data by scrape_name.')
parser.add_argument('-rootDir', dest='rootDir', action='store', help='root social-sandbox directory.')
parser.add_argument('-scrape_name', dest='scrape_name', action='store', help='scrape name in which to store data',default="no scrape name")
parser.add_argument('-redis_address', dest='redis_address', action='store', help='Address of redis',default="localhost")
parser.add_argument('-redis_port', dest='redis_port', action='store', help='redis port',default="6379")

args = parser.parse_args()
scrape_name = args.scrape_name
rootDir = args.rootDir

# change to your path to caffe
CAFFE_ROOT = '/home/strong-pm/caffe/'
sys.path.insert(0, CAFFE_ROOT + 'python')
import caffe



# change to your path to the project 
sys.path.append(rootDir + '/python/ss-ned/image-featurizer')
from caffe_featurizer import CaffeFeaturizer
cf = CaffeFeaturizer(CAFFE_ROOT)

r = redis.StrictRedis(host=args.redis_address, port=args.redis_port, db=0)

# --
# Utilities
def chunks(l, n):
    n = max(1, n)
    return [l[i:i + n] for i in range(0, len(l), n)]

def get_files(image_pth):
    return [image_pth + x for x in os.listdir(image_pth) if not r.get(re.sub('.*/|\\.jpg', '', image_pth + x)) ]

def send_to_redis(x):
    key = re.sub('.*/|\\.jpg', '', x['id'])
    value = map(float,x[:-1])
    #print >> sys.stdout key
    #print >> sys.stdout value
    r.set(key,value)

# --
# Step 0: Parameters

#csv_path  = rootDir + '/' + scrape_name + '/' + scrape_name + '_features/' + scrape_name + '.csv'
#h5_path   = rootDir + '/' + scrape_name + '/' + scrape_name + '_hdf5/' + scrape_name + '.h5'

# change to your path to the project 
image_pth = rootDir + '/' + scrape_name + '/' + scrape_name + '_images' + '/'



# --
# Step 1 : Featurize

out        = None
CHUNK_SIZE = 250

#outfile = open(csv_path, 'ab')

while True:

    counter    = 0
    files      = get_files(image_pth)
    print >> sys.stdout, len(files), " new images to featurize."
    all_chunks = chunks(files, CHUNK_SIZE)
    for chunk in all_chunks:
        print >> sys.stdout, 'chunk :: %d' % counter

        #print >> sys.stdout chunk
        
        cf.set_batch_size(len(chunk))
        cf.set_files(itertools.chain(chunk))
        cf.load_files()
        cf.forward()
        
        feats       = pd.DataFrame(cf.featurize())
        feats['id'] = chunk
        feats       = feats.drop(cf.errs)
        feats.apply(send_to_redis,axis=1)
        
        print >> sys.stdout, 'saving...'
        # Should really be saving in a sparse format
        #feats.to_csv(outfile, sep = '\t', fmt='%s', index = False, header = False)
        
        counter += 1
        print >> sys.stdout, 'sleeping for 60 seconds'
    time.sleep(60)


#outfile.close()


# --
# Step 2 : Migrate to h5py (could be made more efficient)
'''
infile  = io.open(csv_path, 'rb')
outfile = h5py.File(h5_path, 'w')

counter = 0
for l in infile:
    counter += 1
    if counter % 1000 == 0:
        print >> sys.stdout counter
    
    x   = l.strip().split('\t')
    key = re.sub('.*/|\\.jpg', '', x[-1])
    val = map(float, x[:-1])
    try:
        _ = outfile.create_dataset(key, data = np.array(val))
    except:
        print >> sys.stdout 'error at :: %d' % counter 

outfile.close()
'''
