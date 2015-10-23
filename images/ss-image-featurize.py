# Run:
# find images | xargs file | grep ASCII | sed "s/:.*//" | xargs -I {} rm {}
# in baltimore_images or else you might have errors for deleted picutes

import os, sys, itertools, zipfile
import numpy as np
import pandas as pd

# Utility for chunkign
def chunks(l, n):
    n = max(1, n)
    return [l[i:i + n] for i in range(0, len(l), n)]


CAFFE_ROOT = '/Users/BenJohnson/projects/software/caffe/'
sys.path.insert(0, CAFFE_ROOT + 'python')
import caffe

sys.path.append('/Users/BenJohnson/projects/caffe_featurize')
from caffe_featurizer import CaffeFeaturizer
cf = CaffeFeaturizer(CAFFE_ROOT)

# --
# User defined

def get_files(image_pth):
    image_pth  = 
    return [image_pth + x for x in os.listdir(image_pth)]

# --
csv_path  = '/Users/BenJohnson/data/images/austin/austin_features.csv'
h5_path   = '/Users/BenJohnson/data/images/austin/austin_features.h5'
image_pth = '/Users/BenJohnson/data/images/austin/austin_images/'

files = get_files(image_pth)

out        = None
CHUNK_SIZE = 250

outfile = open(csv_path, 'ab')

counter = 0
all_chunks = chunks(files, CHUNK_SIZE)
for chunk in all_chunks:
    print 'chunk :: %d' % counter
    
    cf.set_batch_size(len(chunk))
    cf.set_files(itertools.chain(chunk))
    cf.load_files()
    cf.forward()
    
    feats       = pd.DataFrame(cf.featurize())
    feats['id'] = chunk
    feats       = feats.drop(cf.errs)
    
    print 'saving...'
    # Should really be saving in a sparse format
    feats.to_csv(outfile, sep = '\t', fmt='%s', index = False, header = False)
    
    counter += 1

outfile.close()


# --
# Migrate to h5py

import io, h5py, re
import numpy as np

infile  = io.open(csv_path, 'rb')
outfile = h5py.File(h5_path, 'w')

counter = 0
for l in infile:
    counter += 1
    if counter % 500 == 0:
        print counter
    
    x   = l.strip().split('\t')
    key = re.sub('.*/|\\.jpg', '', x[-1])
    val = map(float, x[:-1])
    try:
        _ = outfile.create_dataset(key, data = np.array(val))
    except:
        print 'error at :: %d' % counter 

outfile.close()
