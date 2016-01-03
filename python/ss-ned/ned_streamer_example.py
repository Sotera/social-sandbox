import h5py
import argparse

from ned_streamer import NED_STREAMER

from elasticsearch import Elasticsearch

import sys
import time

chunksize = 500

parser = argparse.ArgumentParser(description='Scrape some instagram data by location.')
parser.add_argument('-es', dest='es', action='store', default="http://localhost:9200/",
                    help='Elasticsearch instance')
parser.add_argument('-es_index', dest='esi', action='store', help='Elasticsearch index in which to store data',
                    default="all")
parser.add_argument('-scrape_name', dest='scrape_name', action='store', help='name of the scrape', default="no name")

parser.add_argument('-rootDir', dest='rootDir', action='store', help='root social-sandbox directory.')
parser.add_argument('-redis_address', dest='redis_address', action='store', help='Address of redis',
                    default="localhost")
parser.add_argument('-redis_port', dest='redis_port', action='store', help='redis port', default="6379")

args = parser.parse_args()
es_index = args.esi
scrapeName = args.scrape_name
rootDir = args.rootDir
es = Elasticsearch([args.es])
redis_address = args.redis_address
redis_port = args.redis_port
# --

def pull_data(elastic_search, loc):
    last_time = None
    count = 0
    results = []
    query = {"size": chunksize, "fields": ["_id", "created_time", "location.latitude", "location.longitude"],
             "sort": [{"created_time": {"order": "asc"}}], "query": {"match_all": {}}}
    response = elastic_search.search(index=es_index, doc_type=loc, body=query)

    count += len(response["hits"]["hits"])
    
    for r in response["hits"]["hits"]:
        results.append(r)
        last_time = r['fields']['created_time'][0]

    while len(response["hits"]["hits"]) > 0:
        print >> sys.stdout, count
        query = {"size": chunksize, "fields": ["_id", "created_time", "location.latitude", "location.longitude"],
                 "sort": [{"created_time": {"order": "asc"}}], "query": {"range": {"created_time": {"gt": last_time}}}}
        response = elastic_search.search(index=es_index, doc_type=loc, body=query, size=chunksize)
        count += len(response["hits"]["hits"])
        for r in response["hits"]["hits"]:
            results.append(r)
            last_time = r['fields']['created_time'][0]

    return results

def stream_in(posts, mx=float('inf')):
    counter = 0
    prev = {'created_time': 0}
    
    for raw in posts:
        curr = {"id":raw['_id'],"created_time":raw["fields"]["created_time"][0],
            "location":{"latitude":raw["fields"]["location.latitude"][0], "longitude":raw["fields"]["location.longitude"][0]}}
        
        if int(curr['created_time']) < int(prev['created_time']):
            raise ValueError('stream_in :: out of order')
        
        yield curr
        prev = curr
        if counter > mx:
            break
        counter += 1

def preload_images(path):
    img = {}
    feat_file = h5py.File(path)
    keys = feat_file.keys()
    for k in keys:
        img[k] = feat_file[k].value
    
    print img
    return img

# --


# Object containing featurized images (created using ss-image-featurize.py)
#imgs = preload_images('/Users/dev/src/social-sandbox/server/jjj_hdf5/jjj.h5')

while True:

    insta_results = pull_data(es,scrapeName)

    # Generator that yields posts, in chronological order
    post_generator = stream_in(insta_results)

    # Run
    i = 0
    for post in NED_STREAMER(post_generator, LOCATION=scrapeName, REDIS_ADDRESS=redis_address,
                             REDIS_PORT=redis_port).run(es=True):
        # print post
        try:
            # pass
            es.index(index=post['_index'], doc_type=post['_type'], id=post['_id'], body=post['_source'])
        except:
            print >> 'error...but moving on' 
        i += 1
        if i % 1000 == 0:
            print >> sys.stdout, i, ' events indexed...'

    print >> sys.stdout, 'sleeping for 3 minutes...'
    time.sleep(180)
