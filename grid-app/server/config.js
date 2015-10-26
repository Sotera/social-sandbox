config = {};

// https://instagram.com/developer/clients/register/
config.instagram_key = "put your client id here";

// https://instagram.com/developer/authentication/
config.instagram_access_token = "put your token here";

// Memex elasticsearch
config.es_path = 'http://10.1.94.103:9200';

// Memex elasticsearch instagram index
config.es_index = 'instagram_remap';

module.exports = config;