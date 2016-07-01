import itertools
from collections import deque
from numba import autojit
import numpy as np
from scipy.spatial.distance import cosine
import redis
import json

def distance(xlat, xlon, ylat, ylon):
    xlat = xlat * np.pi / 180
    xlon = xlon * np.pi / 180
    ylat = ylat * np.pi / 180
    ylon = ylon * np.pi / 180
    ds   = [ylat - xlat, ylon - xlon]
    a    = np.sin(ds[0]) ** 2 + np.cos(xlat) * np.cos(ylat) * (np.sin(ds[1]) ** 2)
    return 6372794 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

jit_distance = autojit(distance)

class NED_STREAMER:
    
    post_generator = None
    cands = {
        'id'   : deque(),
        'time' : deque(), 
        'lat'  : deque(), 
        'lon'  : deque()
    }
    TIME_THRESH = None
    DIST_THRESH = None
    LOCATION = None

    def __init__(self, post_generator, LOCATION='null-location', REDIS_ADDRESS='null-address', REDIS_PORT='null_port',
                 TIME_THRESH = 30 * 60000, DIST_THRESH = 1000000000000):
        self.post_generator = post_generator
        self.LOCATION = LOCATION
        self.TIME_THRESH = TIME_THRESH
        self.DIST_THRESH = DIST_THRESH
        self.redis = redis.StrictRedis(host=REDIS_ADDRESS, port=REDIS_PORT, db=0)
    
    # Sequential
    def time_buffer(self, obj):     
        self.cands['id'].append(obj['id'])
        self.cands['time'].append(int(obj['created_time']))
        self.cands['lat'].append(obj['location']['latitude'])
        self.cands['lon'].append(obj['location']['longitude'])
        
        d = int(obj['created_time']) - self.cands['time'][0]
        while d > self.TIME_THRESH:
            try:
                for c in self.cands.values():
                    c.popleft()
            except:
                pass
            
            d = int(obj['created_time']) - self.cands['time'][0]
        
        return {
            'target' : obj, 
            'cands'  : dict([(k, list(v)) for k, v in self.cands.iteritems()])
        }
    
    def geo_filter(self, obj):
        out   = []
        xlat  = obj['target']['location']['latitude']
        xlon  = obj['target']['location']['longitude']
        cands = obj['cands']
        for i in range(len(cands['id'])):
            ylat = cands['lat'][i]
            ylon = cands['lon'][i]
            d    = self.distance(xlat, xlon, ylat, ylon)
            if d <= self.DIST_THRESH:
                out.append({
                    'id' : cands['id'][i],
                    'dist' : {
                        'location'     : d,
                        'created_time' : int(obj['target']['created_time']) - cands['time'][i]
                    }
                })
        
        return {
            "target" : obj['target'],
            "cands"  : out
        }
 
    def img_sim(self, obj):
        targ  = obj['target']['id']
        cands = obj['cands']
        tvec  = self.redis.get(targ)
        if tvec:
            tvec = json.loads(tvec)
        if type(tvec) != None:
            for cand in cands:
                b = self.redis.get(cand['id'])
                if b:
                    b = json.loads(b)
                cand['sim'] = self._img_sim(b, tvec)
        print len(cands)
        return {
            'target' : obj['target'],
            'cands'  : cands
        }

    def run(self, es = False):
        close_in_time  = itertools.imap(self.time_buffer, self.post_generator)
        close_in_space = itertools.imap(self.geo_filter, close_in_time)
        close_in_all   = itertools.imap(self.img_sim, close_in_space)
        # close_in_time  = itertools.imap(self.time_buffer, self.post_generator)
        # #close_in_space = itertools.imap(self.geo_filter, close_in_time)
        # close_in_all   = itertools.imap(self.img_sim, close_in_time)
        print 'here'
        for post in close_in_all:
            if es:
                yield self.es_format(post)
            else:
                yield post

    
    def es_format(self, post):
        return {
            '_index'  : 'events',
            '_type'   : self.LOCATION,
            '_id'     : post['target']['id'],
            '_source' : {
                'id'           : post['target']['id'],
                'location'     : post['target']['location'],
                'created_time' : int(post['target']['created_time']),
                'max_dist' : {
                    'created_time' : self.TIME_THRESH,
                    'location'     : self.DIST_THRESH
                },
                'sims' : filter(lambda c: c['id'] != post['target']['id'], post['cands'])
            }
        }
    
       
    def distance(self, xlat, xlon, ylat, ylon):
        return jit_distance(xlat, xlon, ylat, ylon)
    
    def _img_sim(self, vec, tvec):
        try:
            return 1 - cosine(vec, tvec)
        except:
            return None
    