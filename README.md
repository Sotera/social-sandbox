# social-sandbox
Geo-temporal scraping of social media, unsupervised event detection

![alt text][logo]

[logo]: https://github.com/Sotera/social-sandbox/blob/master/docs/ss.png "Social Sandbox"

You'll need to change <https://github.com/Sotera/social-sandbox/blob/master/grid-app/server/config.js> after getting your keys from instagram: <https://instagram.com/developer/authentication/>

Dependencies are (and places you'll need to change config/paths/etc.):
* Elasticsearch - used for storage of image metadata
  * https://github.com/Sotera/social-sandbox/blob/new-event-detection/grid-app/server/config.js
  * https://github.com/Sotera/social-sandbox/blob/new-event-detection/grid-app/server/giver.js
  * https://github.com/Sotera/social-sandbox/blob/new-event-detection/python/ss-ned/ned_streamer_example.py
* Caffe (http://caffe.berkeleyvision.org/) - used for featurization of images
  * https://github.com/Sotera/social-sandbox/blob/new-event-detection/python/ss-ned/ss-image-featurize.py
* Redis - used for storing image feature vectors used in image similarity comparisions
  * https://github.com/Sotera/social-sandbox/blob/new-event-detection/python/ss-ned/ned_streamer.py
To get going quickly, run against the Elastic instance on the Memex VPN: <https://memexproxy.com/wiki/login.action?os_destination=%2Findex.action&permissionViolation=true>

```
cd grid-app/server/
npm install
node server.js
go to localhost:3000/login/
```
