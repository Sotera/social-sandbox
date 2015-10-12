import json
from elasticsearch import Elasticsearch
from elasticsearch.helpers import scan, streaming_bulk

INDEX    = 'instagram'
HOSTNAME = 'localhost'
HOSTPORT = 9205
OUTPATH  = 'instagram.json.txt'

QUERY = {
	"query" : {
		"match_all" : {}
	}
}

# -------------------------------------

client = Elasticsearch([ {'host' : HOSTNAME, 'port' : HOSTPORT} ])

def run(client, index, query):    
    for a in scan(client, index = index, query = query):
        yield a

counter = 0
with open(OUTPATH, 'wb') as f:
    for a in run(client, INDEX, QUERY):
        counter += 1
        f.write(json.dumps(a))
        f.write('\n')
        if counter % 100 == 0:
            print counter

