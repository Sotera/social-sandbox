#!/usr/bin/env node

'use strict';

// scroll ES docs
const es = require('elasticsearch');
const request = require('request');
const srcClient = new es.Client({
    host: '10.1.92.76:9200',
    requestTimeout: 60000,
    log: 'error'
  }),
  srcIndex = 'yemen_ceasefire',
  srcType = 'instagram'
  ;
const destClient = new es.Client({
    host: 'localhost:9200',
    requestTimeout: 60000,
    log: 'error'
  }),
  destIndex = 'instagram_remap',
  destType = 'yemen'
  ;

const fs = require('fs'),
  url = require('url'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  dataMapping = require('./data-mapping'),
  mapping = require('./mapping') // instagram_remap mapping
;

const scrollWait = '10s';

const range = {
  must: [{
      range: {
        'geoloc.lat': {
          gte: 13.4,
          lte: 19.5
        }
      }
    },{
      range: {
        'geoloc.lon': {
          gte: 42.3,
          lte: 49.0
        }
      }
    },
    {
      range: {
        created_time: {
          gte: '1454284800'
        }
      }
    }]
};

const query = {
  // _source : ['id', 'postedTime', 'geo'],
  size    : 100,
  query: {
    bool: range
  }
};

let countDocs = 0;
dataMapping.createIndexWithMapping({client: destClient, index: destIndex, type: destType, mapping})
.then(() => {
  return srcClient.search({
    index : srcIndex,
    type  : srcType,
    scroll: scrollWait,
    body  : query
  });
})
.then(scroll)
.catch(console.error);

function storeImage(hit) {
  let imageUrl = hit._source.images.standard_resolution.url;
  var parsed = url.parse(imageUrl);
  let dir = ['/tmp/sandbox', destType, destType + '_images'].join('/');
  mkdirp.sync(dir);
  // console.log(parsed.pathname)
  // path + cache key
  let imagePath = [dir, path.basename(parsed.pathname)].join('/')// + parsed.search;
  request(imageUrl).pipe(fs.createWriteStream(imagePath));
}

function scroll(res) {
  console.log('scrolling...', countDocs, 'documents');
  let src, coords, lat, lng, bulkLines = [], hits = res.hits.hits;

  hits.forEach(hit => {
    src = hit._source;
    if (!src.geoloc) return; // no geo value
    lat = src.geoloc.lat;
    lng = src.geoloc.lon;
    if (!lat) return;

    bulkLines.push(JSON.stringify({create: {_id: hit._id}}));
    bulkLines.push(JSON.stringify(src));
    storeImage(hit);
  });

  // console.log(bulkLines.join('\n'))
  destClient.bulk({
    index: destIndex,
    type: destType,
    body: bulkLines.join('\n')
  })
  .catch(console.error);

  countDocs += hits.length;

  if (res.hits.total > countDocs) {
    return srcClient.scroll({
      scrollId: res._scroll_id,
      scroll: scrollWait
    })
    .then(slowdown)
    .then(scroll)
    .catch(console.error);
  } else {
    return 'done';
  }
}

function slowdown(hits) { // pass hits thru
  return new Promise(res => {
    setTimeout(() => res(hits), 3000);
  });
}
