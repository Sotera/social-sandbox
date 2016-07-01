#!/usr/bin/env node

// UK jun 2016 twitter data from joe with locally saved images

'use strict';

// scroll ES docs
const es = require('elasticsearch');
const request = require('request');
// const srcClient = new es.Client({
//     host: '10.1.92.76:9200',
//     requestTimeout: 60000,
//     log: 'error'
//   }),
//   srcIndex = 'yemen_ceasefire',
//   srcType = 'instagram'
//   ;
const destClient = new es.Client({
    host: 'localhost:9200',
    requestTimeout: 60000,
    log: 'error'
  }),
  destIndex = 'instagram_remap',
  destType = 'uk-jun2016'
  ;

const fs = require('fs'),
  url = require('url'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  dataMapping = require('./data-mapping'),
  mapping = require('./instagram_remap'),
  readline = require('readline'),
  _ = require('lodash')
;

// const scrollWait = '10s';

// const range = {
//   must: [{
//       range: {
//         'geoloc.lat': {
//           gte: 13.4,
//           lte: 19.5
//         }
//       }
//     },{
//       range: {
//         'geoloc.lon': {
//           gte: 42.3,
//           lte: 49.0
//         }
//       }
//     },
//     {
//       range: {
//         created_time: {
//           gte: '1461974400'
//         }
//       }
//     }]
// };

// const query = {
//   // _source : ['id', 'postedTime', 'geo'],
//   size    : 50,
//   query: {
//     bool: range
//   }
// };

let countDocs = 0;
let bulkLines = [];
dataMapping.createIndexWithMapping({
  client: destClient, index: destIndex, type: destType, mapping
})
.then(process)
.then(bulkSave)
.catch(console.error);

// TODO: slow things down when using larger files
// to allow image retrieval to finish
function process() {
  return new Promise((res, rej) => {
    const infile = '/home/luke/apps/sotera/social-sandbox/uk-tweets-jun2016-from-joe/raw_tweet_data/live_stream/2016-06-28_10:18:07.231080.json';
    const lineReader = readline.createInterface({
      input: fs.createReadStream(infile),
      terminal: false
    });

    lineReader
    .on('line', line => {
      let sandboxed = sandboxify(line);
      if (sandboxed) {
        console.log(sandboxed);
        bulkLines.push(JSON.stringify({create: {_id: sandboxed.id}}));
        bulkLines.push(JSON.stringify(sandboxed));
        storeImage(sandboxed.id, sandboxed.images.standard_resolution.url);
      }
    })
    .on('close', res)
    .on('error', rej);
  });
}

function bulkSave() {
  return destClient.bulk({
    index: destIndex,
    type: destType,
    body: bulkLines.join('\n')
  });
}

function sandboxify(line) {
  let sandboxed = JSON.parse(line);
  let coords = [], mediaUrl;

  // for now lets keep sandbox happy by retaining lat-lng
  // TODO: forget about lat-lngs
  coords = _.get(sandboxed, 'place.bounding_box.coordinates[0][0]');
  // must have a pic
  // uses default size
  mediaUrl = _.get(sandboxed, 'entities.media[0].media_url');
  if (!coords || !mediaUrl) return;
  // if (!mediaUrl) return;

  sandboxed.id = sandboxed.id_str; // make sure ==
  // coords are in geojson lon-lat order
  sandboxed.geoloc = { lat: coords[1], lon: coords[0] };
  sandboxed.location = { latitude: coords[1], longitude: coords[0] };
  sandboxed.link = 'TODO';
  sandboxed.user.username = sandboxed.user.screen_name;
  sandboxed.created_time = (Math.floor(+sandboxed.timestamp_ms / 1000)).toString();
  _.set(sandboxed, 'images.standard_resolution.url', mediaUrl);
  _.set(sandboxed, 'images.low_resolution.url', mediaUrl + ':thumb');
  // rm unused nested objects to save space
  delete sandboxed.entities;
  delete sandboxed.extended_entities;
  delete sandboxed.place;
  // delete sandboxed.user;
  return sandboxed;
}
// assumes image url has file ext in path.
// I think sandbox requires .jpg files in regex checks. LW
function storeImage(basename, imageUrl) {
  var parsed = url.parse(imageUrl);
  let dir = ['/tmp/sandbox', destType, destType + '_images'].join('/');
  mkdirp.sync(dir);
  // path + cache key
  // let imagePath = [dir, path.basename(parsed.pathname)].join('/')// + parsed.search;
  let pathParts = parsed.pathname.split('.');
  let ext = '.' + pathParts[pathParts.length-1];
  let imagePath = [dir, basename].join('/')// + parsed.search;
  request(imageUrl).pipe(fs.createWriteStream(imagePath + ext));
}

// function scroll(res) {
//   console.log('scrolling...', countDocs, 'documents');
//   let src, coords, lat, lng, bulkLines = [], hits = res.hits.hits;

//   hits.forEach(hit => {
//     src = hit._source;
//     if (!src.geoloc) return; // no geo value
//     lat = src.geoloc.lat;
//     lng = src.geoloc.lon;
//     if (!lat) return;

//     bulkLines.push(JSON.stringify({create: {_id: hit._id}}));
//     bulkLines.push(JSON.stringify(src));
//     storeImage(hit);
//   });

//   // console.log(bulkLines.join('\n'))
//   destClient.bulk({
//     index: destIndex,
//     type: destType,
//     body: bulkLines.join('\n')
//   })
//   .catch(console.error);

//   countDocs += hits.length;

//   if (res.hits.total > countDocs) {
//     return srcClient.scroll({
//       scrollId: res._scroll_id,
//       scroll: scrollWait
//     })
//     .then(slowdown)
//     .then(scroll)
//     .catch(console.error);
//   } else {
//     return 'done';
//   }
// }

function slowdown(hits) { // pass hits thru
  return new Promise(res => {
    setTimeout(() => res(hits), 3000);
  });
}
