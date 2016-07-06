#!/usr/bin/env node

// UK jun 2016 twitter data from joe
// expects newline-delimited json files in ./tmp/import/

'use strict';

const es = require('elasticsearch');
const request = require('request');
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
  _ = require('lodash'),
  dir = require('node-dir'),
  imagesDir = ['/tmp/sandbox', destType, destType + '_images'].join('/'),
  images = [] // cached while processing
;

// let countDocs = 0;
dataMapping.createIndexWithMapping({
  client: destClient, index: destIndex, type: destType, mapping
})
.then(prep)
.then(process)
.then(bulkIndex)
.then(() => saveImages(images))
.catch(console.error);

function prep() {
  // remove images
  (function rmDir(dirPath) {
    try { var files = fs.readdirSync(dirPath); }
    catch(e) { return; }
    if (files.length > 0)
      for (var i = 0; i < files.length; i++) {
        var filePath = dirPath + '/' + files[i];
        if (fs.statSync(filePath).isFile())
          fs.unlinkSync(filePath);
        else // is dir
          rmDir(filePath);
      }
    fs.rmdirSync(dirPath);
    return;
  })(imagesDir);
}

function process() {
  let bulkLines = [];

  return new Promise((res, rej) => {
    console.log(__dirname)
    dir.readFilesStream(__dirname + '/../tmp/import', 
      { match: /.json$/ },
      (err, stream, next) => {
        if (err) throw err;
        const lineReader = readline.createInterface({
          input: stream,
          terminal: false
        });

        lineReader
        .on('line', line => {
          let sandboxed = sandboxify(line);
          if (sandboxed) {
            console.log(sandboxed);
            // TODO: would be better to stream
            bulkLines.push(JSON.stringify({create: {_id: sandboxed.id}}));
            bulkLines.push(JSON.stringify(sandboxed));
            // TODO: would be better to stream
            images.push({
              basename: sandboxed.id, 
              url: sandboxed.images.standard_resolution.url
            });
          }
        })
        .on('close', () => next())
        .on('error', err => { throw err; })
        ;
      },
      (err, files) => {
        if (err) throw err;
        return res(bulkLines);
      }

    );

  });
}

function bulkIndex(lines) {
  return destClient.bulk({
    index: destIndex,
    type: destType,
    body: lines.join('\n')
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
// sandbox requires .jpg files in regex checks.
function saveImages(images) {
  mkdirp.sync(imagesDir);
  const BATCH_SIZE = 50;
  
  // save in chunks with a built-in delay to bypass
  // file handler limits, request limits, etc.
  return Promise.all(_(images).chunk(BATCH_SIZE).map(batchSave))
  // .then(console.log)
  .catch(console.error);

  function batchSave(images) {
    let imageRequests = images.map(saveImage);
    return Promise.all(imageRequests)
    .then(() => console.log('Saving images...'))
    .then(slowdown);
  }
}

function saveImage(img) {
  return new Promise((res, rej) => {
    let parsed = url.parse(img.url);
    let pathParts = parsed.pathname.split('.');
    let ext = '.' + pathParts[pathParts.length-1];
    let imagePath = [imagesDir, img.basename].join('/') + ext;
    let imageStream = fs.createWriteStream(imagePath);
    let imageReq = request(img.url);

    imageStream
      .on('finish', () => res())
      .on('error', err => {
        fs.unlink(imagePath);
        rej(err);
      });

    imageReq
      .on('error', err => {
        console.error(err);
        fs.unlink(imagePath);
      });
    
    imageReq.pipe(imageStream);
  });
}

// arbitrary slowdown to ease http requests
function slowdown() {
  return new Promise(res => {
    setTimeout(() => res(), 5000);
  });
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
