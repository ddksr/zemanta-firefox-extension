/*
 * RPC Constants
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.RPC.Constants = new function()
{
    this.ZEMANTA_RPC_BASE_URL = 'http://api.zemanta.com';
    this.ZEMANTA_RPC_API_URL = 'http://api.zemanta.com/services/rest/0.0/';
    this.ZEMANTA_RPC_GET_APIKEY_ACTION = 'ZemantaAPIKey';
    this.ZEMANTA_RPC_IMAGES_URL = 'http://static.zemanta.com/images.xml';

    this.ZEMANTA_RPC_NET_FAILURE = -1;
    this.ZEMANTA_RPC_NET_SUCCESS = 1;
    this.ZEMANTA_RPC_NET_CREATED = 10;
    this.ZEMANTA_RPC_NET_INPROGRESS = 20;
    this.ZEMANTA_RPC_NET_FINISHED = 30;

    this.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_APIKEY_ACTION_COMPLETE  = 1020;
    this.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_RULES_ACTION_COMPLETE  = 1030;
    this.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_SCRIPT_ACTION_COMPLETE  = 1040;
    this.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_IMAGES_ACTION_COMPLETE  = 1030;

    this.ZEMANTA_RPC_NET_ERROR_HTTP = 400;
    this.ZEMANTA_RPC_NET_ERROR_XHR_CONNECTION = 500;
    this.ZEMANTA_RPC_NET_ERROR_XHR_CREATE = 510;
    this.ZEMANTA_RPC_NET_ERROR_XML_PROTOCOL = 520;

    //this.ZEMANTA_RPC_SERVICE_ERROR_BAD_XML = 700;
}
