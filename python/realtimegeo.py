#! /usr/local/bin/python

import urllib2
import json
from datetime import datetime, timedelta
from time import mktime, sleep
import os
import os.path
import threading
import urllib
import Queue
import argparse

from elasticsearch import Elasticsearch
from kafka.client import KafkaClient
from kafka.producer import SimpleProducer
import elasticsearch.exceptions
from elasticsearch.client import IndicesClient as IC

parser = argparse.ArgumentParser(description='Scrape some instagram data by location.')

parser.add_argument('-es', dest='es', action='store',
                    default="http://localhost:9200/",
                    help='Elasticsearch instance')
parser.add_argument('-key', dest='key', action='store', required=True,
                    help='Instagram API Client Key - see https://instagram.com/developer/clients/manage/')

parser.add_argument('-start_date', dest='start_date', action='store', required=True,
                    help='Start date from which to pull data from in form 20140131')

parser.add_argument('-end_date', dest='end_date', action='store',
                    help='End date from which to pull data from in form 20140131. If left out, this process will '
                         'continued to pull images forever for the last 5 minutes.')

parser.add_argument('-bb', dest='bb', action='store',
                    help='Bounding box for which to pull data from in the form min_lat,min_lon,max_lat,max_lon - '
                         'e.g. 39.236,-76.706,39.373,-76.528',
                    required=True)

parser.add_argument('-es_index', dest='esi', action='store', help='Elasticsearch index in which to store data',
                    default="all")

parser.add_argument('-scrape_name', dest='scrape_name', action='store', help='name of the scrape', default="noname")

parser.add_argument('--save_images', action='store_true', dest='images', help='Whether we save images or not to disk')

parser.add_argument('--send_to_kafka', action='store_true', dest='kafka',
                    help='Whether we send new images to kafka topic.')

parser.add_argument('-rootDir', dest='rootDir', action='store', help='root social-sandbox directory.')

parser.add_argument('-kafka', dest='kafka_url', action='store', default="localhost:9092")

parser.add_argument('--log_to_disk', action='store_true', dest='log_to_disk',
                    help='Whether we log the data to disk or not')
args = parser.parse_args()
es_index = args.esi
scrapeName = args.scrape_name
rootDir = args.rootDir
es = Elasticsearch([args.es])
ic = IC(es)

q = Queue.Queue()

done_scraping = True
print "ROOT APP DIR IN THE PYTHON SCRIPT:" + rootDir
mapping = json.loads("\n".join(open(rootDir + '/server/mapping.json').readlines()))


def logpictures():
    print "starting image thread..."
    while done_scraping or not q.empty():
        if not q.empty():
            j = q.get()
            img_url = j['url']
            id = j['id']
            ext = img_url.split('/')[-1].split('.')[1]
            print img_url
            if not os.path.isfile(rootDir + '/' + scrapeName + '/' + scrapeName + '_images' + '/' + id + '.' + ext):
                try:
                    urllib.urlretrieve(img_url,
                                       rootDir + '/' + scrapeName + '/' + scrapeName + '_images' + '/' + id + '.' + ext)
                except IOError:
                    print 'Issue with downloading image... to ' + rootDir + '/' + scrapeName + '/' + scrapeName + \
                          '_images' + '/' + id + '.' + ext
        else:
            # print 'No images to process...'
            sleep(10)


kafka = None
producer = None
if args.kafka:
    kafka = KafkaClient(args.kafka_url)
    producer = SimpleProducer(kafka)

client_id = args.key
sdate = args.start_date

minlat = float(args.bb.split(',')[0])
maxlat = float(args.bb.split(',')[2])
minlon = float(args.bb.split(',')[1])
maxlon = float(args.bb.split(',')[3])

lat_dist = maxlat - minlat
lon_dist = maxlon - minlon

spread = 0.085
distance_in_meters = 5000

if lat_dist < spread or lon_dist < spread:
    spread = 0.015
    distance_in_meters = 1000
    minlat += 0.01
    maxlat -= 0.01
    minlon += 0.01
    maxlon -= 0.01
realtime = True

try:
    es.indices.create(index=es_index, ignore=400)
    if not ic.get_mapping(index=es_index, doc_type=scrapeName):
        ic.put_mapping(index=es_index, doc_type=scrapeName, body=mapping)
except:
    ic.put_mapping(index=es_index, doc_type=scrapeName, body=mapping)

start_date = datetime(int(sdate[0:4]), int(sdate[4:6]), int(sdate[6:8]), int(sdate[8:10]))
end_date = datetime(datetime.now().year, datetime.now().month, datetime.now().day, datetime.now().hour,
                    datetime.now().minute)
if args.end_date:
    end_date = datetime(int(args.end_date[0:4]), int(args.end_date[4:6]), int(args.end_date[6:8]),
                        int(args.end_date[8:10]))

max_secs = 460800  # 128 hours

max_images = 40  # this is the artificial max limit instagram sets...for now we'll just make it something low
min_images = 10  # increase the time window for any calls netting less than 10 images

if args.images:
    imagelogger = threading.Thread(target=logpictures)
    imagelogger.daemon = True
    imagelogger.start()

print "$$ Kicking it off", minlat, maxlat, minlon, maxlon, spread, distance_in_meters
while realtime:

    tmp_lat = minlat
    tmp_lon = minlon
    tmp_start_date = start_date
    time_inc_seconds = 60  # one minute is what we'll start with
    # set this to start + the time increment
    tmp_end_date = start_date + timedelta(seconds=time_inc_seconds)

    while tmp_lat <= maxlat and tmp_lon <= maxlon:

        print "**** Starting New Bin:", tmp_lat, "", tmp_lon, tmp_start_date, "-", end_date
        # we're going to run through the entire date range for this lat/lon
        while tmp_start_date < end_date:
            response = None
            try:
                # make the call to instagram
                response = urllib2.urlopen('https://api.instagram.com/v1/media/search?distance='
                                           + str(distance_in_meters) + '&'
                                           + 'min_timestamp=' + str(int(mktime(tmp_start_date.timetuple()))) + '&'
                                           + 'max_timestamp=' + str(int(mktime(tmp_end_date.timetuple()))) + '&'
                                           + 'lat=' + str(tmp_lat) + '&'
                                           + 'lng=' + str(tmp_lon) + '&access_token=' + client_id
                                           + '&count=500')
                sleep(1)  # this sleep call ensures we don't hit instagram's api limit of 5000 an hour.
            except urllib2.URLError:  # weird error? just sleep for a second, print the error,
                # and move on to the next time slice.  no point in trying again
                sleep(1)
                tmp_start_date = tmp_end_date
                tmp_end_date = tmp_end_date + timedelta(seconds=time_inc_seconds)
                print '***Error on:  https://api.instagram.com/v1/media/search?distance=' \
                      + str(distance_in_meters) + '&' \
                      + 'min_timestamp=' + str(int(mktime(tmp_start_date.timetuple()))) + '&' \
                      + 'max_timestamp=' + str(int(mktime(tmp_end_date.timetuple()))) + '&' \
                      + 'lat=' + str(tmp_lat) + '&' \
                      + 'lng=' + str(tmp_lon) + '&access_token=' + client_id \
                      + '&count=500 ***'
                continue
            # if we get here we have some results
            html = response.read()
            j = json.loads(html)
            i = 0

            file_name = str(tmp_lat) + "_" + str(tmp_lon) + "_" + str(
                int(mktime(tmp_start_date.timetuple()))) + "_" + str(int(mktime(tmp_end_date.timetuple()))) + ".bulk"
            num_i = len(j['data'])  # count the number of images.
            print str(datetime.now()) + " -- " + str(num_i) + ' pictures in: ' + str(tmp_start_date) + ' - ' + str(
                tmp_end_date)
            if num_i > max_images:  # if the number of images is more than the max, we need to cut the time down.
                if time_inc_seconds > 60:  # as long as we haven't hit the min, we'll decrease
                    if time_inc_seconds >= 1800:  # if we're anything >= 30 minutes, just cut the time in half
                        time_inc_seconds /= 2
                    elif time_inc_seconds == 900:  # if we're at 15 minutes, make it 5 minutes
                        time_inc_seconds /= 3
                    elif time_inc_seconds == 300:  # if we're at 5 minutes, make it 1 minute
                        time_inc_seconds /= 5
                    tmp_end_date = tmp_start_date + timedelta(seconds=time_inc_seconds)
                    continue  # we continue in the looping process because we want to throw out the results we just got
                    #  - trying again with a smaller time inc.
                else:
                    pass
                    print time_inc_seconds, 'is the min seconds.  Moving on with it.'
            elif num_i < min_images:  # if the number of images is less than the min, we need to increase the time
                if time_inc_seconds < max_secs:  # as long as we haven't hit the max time already, let's increase
                    if time_inc_seconds == 60:  # if we're at 1 minute, go to 5 minutes
                        time_inc_seconds *= 5
                    elif time_inc_seconds == 300:  # if we're at 5 minutes, got to 15 minutes
                        time_inc_seconds *= 3
                    else:  # otherwise, just double the time.
                        time_inc_seconds *= 2
                        # note there is no 'continue' here because we're going to keep the images we just got.
                else:
                    time_inc_seconds = max_secs

            # build the json.  add the call which we made and then add the raw data.
            eslines = []
            bykey = {}
            for img in j['data']:
                if not img.get('location') or not img['location'].get('latitude'):
                    continue
                if img['location'].get('latitude') is None or not (
                                        minlat - .005 <= img['location']['latitude'] <= maxlat + .005 and
                                        minlon - .005 <= img['location']['longitude'] <= maxlon + .005):
                    continue
                q.put({"id": img['id'], "url": img['images']['standard_resolution']['url']})
                indexline = {"index": {"_index": es_index, "_type": scrapeName, "_id": img['id']}}
                dataline = img
                dataline['geoloc'] = {
                    "lat": dataline['location']['latitude'],
                    "lon": dataline['location']['longitude']
                }
                bykey[img['id']] = dataline
                eslines.append(json.dumps(indexline) + '\n' + json.dumps(dataline))
                if args.log_to_disk:
                    open(scrapeName + "_meta/" + file_name, "w").write('\n'.join(eslines))
            if not args.log_to_disk and len(eslines) > 0:
                try:
                    resp = es.bulk(body='\n'.join(eslines)).get('items', [])
                except elasticsearch.exceptions.ConnectionTimeout:
                    print 'issue with es'
                    open(scrapeName + "_meta/" + file_name, "w").write('\n'.join(eslines))
                except elasticsearch.exceptions.TransportError:
                    print 'issue with es'
                    open(scrapeName + "_meta/" + file_name, "w").write('\n'.join(eslines))
                if args.kafka:
                    newones = [i for i in resp if i['index']['_version'] == 1]
                    if len(newones) > 0:
                        print len(newones), "new ones!!!", str(tmp_start_date) + ' - ' + str(tmp_end_date)
                        dudes = []
                        for newguy in newones:
                            if newguy['index']['_id'] in bykey:
                                dudes.append(bykey[newguy['index']['_id']])
                        try:
                            producer.send_messages("instagram", json.dumps(dudes))
                        except kafka.common.FailedPayloadsError:
                            print "problem sending to kafka queue...move on"

            tmp_start_date = tmp_end_date  # make the start time equal to the previous end.

            tmp_end_date = tmp_end_date + timedelta(seconds=time_inc_seconds)
            # make the end time the old end time + the time inc.

            if tmp_end_date > end_date:  # if somehow we're beyond the end, just make it the end.
                tmp_end_date = end_date

        # if we're here, we're done with this lat/lon block and the whole time window, let's move along geographically
        tmp_lat += spread  # move the lat forward
        if tmp_lat > maxlat:  # if we're beyond the maxlat, it's time to reset the lat, and increase the lon.
            tmp_lat = minlat
            tmp_lon += spread

        tmp_start_date = start_date  # reset the start and end times
        tmp_end_date = start_date + timedelta(seconds=time_inc_seconds)
        if tmp_end_date > end_date:
            tmp_end_date = end_date

    print '---- Done with iteration on Grid ----'
    if args.end_date:
        realtime = False
    else:
        start_date = end_date
        end_date = datetime(datetime.now().year, datetime.now().month, datetime.now().day, datetime.now().hour,
                            datetime.now().minute)

        if (end_date - start_date).seconds < 300:
            start_date = end_date - timedelta(seconds=300)

done_scraping = False
print "*****Completely Finished..."
