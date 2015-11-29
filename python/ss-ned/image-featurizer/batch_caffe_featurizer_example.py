import os, sys, itertools
import numpy as np
import pandas as pd

CAFFE_ROOT = '/Users/BenJohnson/projects/software/caffe/'
sys.path.insert(0, CAFFE_ROOT + 'python')
import caffe

sys.path.append('/Users/BenJohnson/projects/caffe_featurize')
from caffe_featurizer import CaffeFeaturizer
cf = CaffeFeaturizer(CAFFE_ROOT)

# Utility for chunking
def chunks(l, n):
    n = max(1, n)
    return [l[i:i + n] for i in range(0, len(l), n)]

# ---

CHUNK_SIZE = 250
files      = ['f1.jpg', 'f2.jpg']
outfile    = open('outfile.csv', 'ab')

all_chunks = chunks(files, CHUNK_SIZE)
for chunk in all_chunks:
    cf.set_batch_size(len(chunk))        # Set batch size
    cf.set_files(itertools.chain(chunk)) # Give iterator for files
    cf.load_files()                      # Load the files from disk
    cf.forward()                         # Forward pass of NN
    
    feats       = pd.DataFrame(cf.featurize()) # Dataframe of features
    feats['id'] = chunk                        # Column of ids
    feats       = feats.drop(cf.errs)          # Error handling
    
    feats.to_csv(outfile, sep = '\t', fmt='%s', index = False, header = False)

outfile.close()

