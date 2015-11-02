# social-sandbox
Geo-temporal scraping of social media, unsupervised event detection

![alt text][logo]

[logo]: https://github.com/Sotera/social-sandbox/blob/master/docs/ss.png "Social Sandbox"

You'll need to change <https://github.com/Sotera/social-sandbox/blob/master/grid-app/server/config.js> after getting your keys from instagram: <https://instagram.com/developer/authentication/>

To get going quickly, run against the Elastic instance on the Memex VPN: <https://memexproxy.com/wiki/login.action?os_destination=%2Findex.action&permissionViolation=true>

### Install

```
# update grid-app/server/config.js with Instagram keys
cd grid-app/server && npm install
cd grid-app/web && bower install
pip install kafka-python elasticsearch
```

### Run

```
vpnc ... # xdata credentials if using Memex / XData VPN ElasticSearch
cd grid-app/server
node . 
```
