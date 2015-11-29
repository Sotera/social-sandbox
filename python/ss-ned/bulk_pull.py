from elasticsearch import Elasticsearch
from elasticsearch import helpers
import json
import os
import json
from datetime import datetime
import urllib
import os
import sys


dir = sys.argv[1]
users = {}
chunksize = 50

def pullImages(users):
  for id in users.keys():
    print id
    img_url = users[id]
    ext = img_url.split('/')[-1].split('.')[1]
    if os.path.isfile(dir + '/' + id + '.' + ext) == False:
      try:
        urllib.urlretrieve(img_url, dir + '/' + id + '.' + ext)
      except IOError:
        print 'Error...moving on'
    else:
      print 'image exists'

def addUsers(response):
  for i in response["hits"]["hits"]:
    user = i["_id"]
    if not user in users:
      users[user] = i["fields"]["images.thumbnail.url"][0]
    

output = open(dir + '.json.csv','w')


count = 0
es = Elasticsearch(['http://10.1.94.103:9200/'])
query={"size":chunksize,"fields":["_id","created_time","location.latitude","location.longitude"], "sort" : [ { "created_time" : {"order" : "asc"}}],"query" : {"match_all" : {}}}
response= es.search(index="instagram_remap", doc_type=dir, body=query) 
print response

count += len(response["hits"]["hits"])
print count
last_time = None
for r in response["hits"]["hits"]:
  output.write(json.dumps(r) + '\n')
  last_time = r['fields']['created_time'][0]

while len(response["hits"]["hits"]) > 0:
  print json.dumps({"size":chunksize,"fields":["_id","created_time","location.latitude","location.longitude"], "sort" : [ { "created_time" : {"order" : "asc"}}],"query" : {"range" : {"created_time":{"gt":last_time}}}})
  query={"size":chunksize,"fields":["_id","created_time","location.latitude","location.longitude"], "sort" : [ { "created_time" : {"order" : "asc"}}],"query" : {"range" : {"created_time":{"gt":last_time}}}}
  response= es.search(index="instagram_remap", doc_type=dir, body=query, size=chunksize) 
  print response
  for r in response["hits"]["hits"]:
    output.write(json.dumps(r) + '\n')
    last_time = r['fields']['created_time'][0]
  count += len(response["hits"]["hits"])
  print count
  
#pullImages(users)