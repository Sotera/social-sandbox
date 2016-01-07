config = {};

// https://instagram.com/developer/clients/register/
config.instagram_key= "put your client id here";

config.instagram_client_secret = "put your client secret here";

// https://instagram.com/developer/authentication/
config.instagram_access_token = "put your token here";

// Memex elasticsearch instagram index
config.es_index = 'instagram_remap';

config.es_address = 'localhost';

config.es_port = 9200;

config.es_search_size = 50000;

module.exports = config;