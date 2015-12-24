config = {};

// https://instagram.com/developer/clients/register/
config.instagram_key = "080cb98cf5424d519352724b6048c5ee";//"put your client id here";

config.instagram_client_secret = "e6a8c282722c4ba585aa9bb04199cac3";//"put your client secret here";

// https://instagram.com/developer/authentication/
config.instagram_access_token = "1759912166.080cb98.42e22b0c49ab46f38a68170a85982908";//put your token here";

// Memex elasticsearch
config.es_path = 'http://localhost:9200';//'http://10.1.94.103:9200';

// Memex elasticsearch instagram index
config.es_index = 'instagram_remap';

config.rootDir = '/home/dev/src/social-sandbox';

module.exports = config;