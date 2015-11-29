# social-sandbox
Geo-temporal scraping of social media, unsupervised event detection

![alt text][logo]

[logo]: https://github.com/Sotera/social-sandbox/blob/master/docs/ss.png "Social Sandbox"

You'll need to change <https://github.com/Sotera/social-sandbox/blob/master/grid-app/server/config.js> after getting your keys from instagram: <https://instagram.com/developer/authentication/>

Dependencies are:
* Elasticsearch - used for storage of image metadata
**
* Caffe (http://caffe.berkeleyvision.org/) - used for featurization of images
* Redis - used for storing image feature vectors used in image similarity comparisions

To get going quickly, run against the Elastic instance on the Memex VPN: <https://memexproxy.com/wiki/login.action?os_destination=%2Findex.action&permissionViolation=true>

```
cd grid-app/server/
node server
```
