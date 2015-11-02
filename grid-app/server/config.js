config = {};

// https://instagram.com/developer/clients/register/
config.instagram_key = "080cb98cf5424d519352724b6048c5ee";

// https://instagram.com/developer/authentication/
config.instagram_access_token = "e6a8c282722c4ba585aa9bb04199cac3";
// Memex elasticsearch
config.es_path = 'http://10.1.94.103:9200';
// Memex elasticsearch instagram index
config.es_index = 'instagram_remap';

module.exports = config;