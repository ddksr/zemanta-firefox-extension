/*
 * RPC Network Layer
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.RPC.Net = function()
{
    // public instance variables
    this.onComplete = function(rpc, result, response, type, request) {};
    this.status = Zemanta.RPC.Constants.ZEMANTA_RPC_NET_CREATED;
    this.id = ((new Date()).getTime() - 1169730000000) + "" + (Math.round(1000*Math.random())+1000);

    // private instance variables
    this._url = '';
    this._filename = '';
    this._method = 'GET';
    this._basicAuthUsername = '';
    this._basicAuthPassword = '';
    this._queryString = '';
    this._postData = '';
    this._type = null;

    this._request = null;
    this._logger = null;

    /*
       this.release = function() {
       this._request = null;
       this.onComplete = null;
       this.logger = null;
       }
     */

    this.finished = function(result, response, request)
    {
        this._logger.debug('Zemanta.RPC.Net.finished: ' + this.id + ': finished');
        this.status = Zemanta.RPC.Constants.ZEMANTA_RPC_NET_FINISHED;
        this.onComplete(this, result, response, this._type, request);
    };

    this.failed = function(errorCode)
    {
        this._logger.debug('Zemanta.RPC.Net.failed: ' + this.id + ': failed');
        this.status = Zemanta.RPC.Constants.ZEMANTA_RPC_NET_FINISHED;
        this.onComplete(this, Zemanta.RPC.Constants.ZEMANTA_RPC_NET_FAILURE, errorCode, this._type, null);
    };

    this.ready = function (rpcnetrequest)
    {
        var rpcnet = this;

        try
        {
            //rpc._logger.debug('Zemanta.RPC.Net.send.onreadystatechange: ' + rpc.id + ': readyState = ' + rpcnetrequest.readyState);
            if (rpcnetrequest.readyState != 4) { return; }
        }
        catch (e) 
        {
            rpcnet._logger.error('Zemanta.RPC.Net.send.onreadystatechange: ' + rpcnet.id + ': error in readyState: ' + e);
            rpcnet.failed(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_ERROR_XHR_CONNECTION);
            return;
        }

        var result = Zemanta.RPC.Constants.ZEMANTA_RPC_NET_SUCCESS;
        var status = 0;

        try 
        {
            status = rpcnetrequest.status;

            if (rpcnetrequest.status < 200 || rpcnetrequest.status > 299)
            {
                rpcnet._logger.error('Zemanta.RPC.Net.send.onreadystatechange: ' + rpcnet.id + ': error in status: ' + rpcnetrequest.status);
                rpcnet.failed(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_ERROR_HTTP);
                return;
            }
        }
        catch (e)
        {
            rpcnet.failed(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_ERROR_HTTP);
            return;
        }

        rpcnet._logger.debug('Zemanta.RPC.Net.send.onreadystatechange: ' + rpcnet.id + ': status = ' + rpcnetrequest.status);

        try
        {
            var response = rpcnetrequest.responseText;
            //rpcnet._logger.debug('Zemanta.RPC.Net.send.onreadystatechange: raw response  = ' + response);
            var returnData;
            if (this._type != Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_RULES_ACTION_COMPLETE)
            {
                returnData = response;
            }
            else
            {
                response = response.replace('<?xml version="1.0"?>', "");
                response = response.replace('<?xml version="1.0" encoding="UTF-8"?>', "");
                var oParser = new DOMParser();
                returnData = oParser.parseFromString(response, "text/xml");
            }

            rpcnet.finished(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_SUCCESS, returnData, rpcnetrequest);
        }
        catch (e)
        {
            // invalid xml
            rpcnet._logger.error('Zemanta.RPC.Net.send.onreadystatechange: ' + rpcnet.id + ': error in response: ' + e);
            rpcnet.failed(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_ERROR_XML_PROTOCOL);
        }
    };
}

Zemanta.RPC.Net.prototype.registerLogger = function(logger)
{
    this._logger = logger;
}

Zemanta.RPC.Net.prototype.setUrl = function(url)
{
    this._url = url;
}

Zemanta.RPC.Net.prototype.setFilename = function(filename)
{
    this._filename = filename;
}

Zemanta.RPC.Net.prototype.setType = function(type)
{
    this._type = type;
}

Zemanta.RPC.Net.prototype.setPostData = function(postData)
{
    this._postData = postData;
}

Zemanta.RPC.Net.prototype.setArguments = function(args)
{
    this._queryString = '';

    for (var i in args)
    {
        this._queryString += escape(i) + '=' + escape(args[i]) + '&';
    }

    if ('&' == this._queryString.charAt(this._queryString.length-1))
    {
        this._queryString = this._queryString.substring(0,this._queryString.length-1);
    }
}

Zemanta.RPC.Net.prototype.setMethod = function(method)
{
    if (method == 'POST')
    {
        this._method = 'POST';
    }
    else
    {
        this._method = 'GET';
    }
}

Zemanta.RPC.Net.prototype.setCredentials = function(username, password)
{
    this._basicAuthUsername = username;
    this._basicAuthPassword = password;
}

Zemanta.RPC.Net.prototype.send = function()
{
    var rpcnet = this;

    rpcnet.status = Zemanta.RPC.Constants.ZEMANTA_RPC_NET_INPROGRESS;

    //rpc._logger.debug('Zemanta.RPC.Net.send: ' + rpc.id + ': creating ' + rpc._method + ' XMLHttpRequest');

    var rpcnetrequest = new XMLHttpRequest();

    if (!rpcnetrequest) { rpcnet.failed(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_ERROR_XHR_CREATE); }

    var postData = null;
    var url = rpcnet._url;

    if ('POST' == rpcnet._method && rpcnet._postData.length > 0) {
        postData = rpcnet._postData;
    } else if (rpcnet._queryString && (rpcnet._queryString.length > 0)) {
        url += '?' + rpcnet._queryString;
    }

    rpcnet._logger.debug('Zemanta.RPC.Net.send: ' + rpcnet.id + ': opening XMLHttpRequest to ' + url);
    rpcnet._logger.debug('Zemanta.RPC.Net.send: Method = ' + rpcnet._method);

    try
    {
        rpcnetrequest.open(rpcnet._method, url, true);
    }
    catch (e)
    {
        rpcnet._logger.error('Zemanta.RPC.Net.send: ' + rpcnet.id + ': error opening connection: ' + e);
        rpcnet.failed(Zemanta.RPC.Constants.ZEMANTA_RPC_NET_ERROR_XHR_CREATE);
        return;
    }

    if ('POST' == rpcnet._method)
    {
        rpcnetrequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    }
    else
    {
        // Bypassing cache only useful for GET requests
        // http://ajaxpatterns.org/XMLHttpRequest_Call#How_will_caching_be_controlled.3F
        rpcnetrequest.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2005 00:00:00 GMT");
        rpcnetrequest.setRequestHeader("Cache-Control", "no-cache");
    }

    /*
    if ('' != rpcnet._basicAuthUsername) {
        rpcnetrequest.setRequestHeader('Authorization', 'Basic ' + btoa(rpcnet._basicAuthUsername + ':' + rpcnet._basicAuthPassword));
    }
    */
    //rpcnetrequest.overrideMimeType('text/xml');

    rpcnetrequest.onreadystatechange = function() { rpcnet.ready(rpcnetrequest); };

    rpcnet._logger.debug('Zemanta.RPC.Net.send: ' + rpcnet.id + ': sending XMLHttpRequest with data "' + postData + '"');

    rpcnetrequest.send(postData);
}
