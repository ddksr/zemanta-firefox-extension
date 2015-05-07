/*
 * RPC Service Layer
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.RPC = new function() {}

Zemanta.RPC.Service = function()
{
    // private instance variables
    this._observers = new Array();
    this._logger = null;
    this._filename = null;
    this._serviceURL = Zemanta.RPC.Constants.ZEMANTA_RPC_BASE_URL;

    this.rpcComplete = function(rpcnet, result, response, type, callback)
    {
        var service = this;

        service._logger.debug("Zemanta.RPC.Service: got rpc complete (id=" + (rpcnet?rpcnet.id:"null") + ",s=" + (rpcnet?rpcnet.status:"null") + ") of type = " + type + " and status = " + result);

        var event = new Zemanta.RPC.Event(type, result, response);

        if (result == Zemanta.RPC.Constants.ZEMANTA_RPC_RPC_FAILURE)
        {
            // response is error code
            service._logger.debug("Zemanta.RPC.Service: complete is error with error code: " + response)
            event.error = new Zemanta.RPC.Error(response);
        }

        if (callback)
        {
            callback(event);
        }

        service.notifyObservers(event);
    };

    this.rpcCompleteWithError = function(rpcnet, errorCode, type)
    {
        this.rpcComplete(rpcnet, Zemanta.RPC.Constants.ZEMANTA_RPC_RPC_FAILURE, errorCode, type);
    }

    this.notifyObservers = function(event)
    {
        for (var i in this._observers)
        {
            if (this._observers[i])
            {
                try
                {
                    this._observers[i].notify(event);
                }
                catch (e)
                {
                    this._logger.error("Zemanta.RPC.Service.onComplete: error notifying observer: " + e);
                    Zemanta.Util.dumpObject(e);
                }
            }
        }
   };

    this.rpcSend = function(type, callback, postData, reqmethod)
    {
        var service = this;

        var rpcnet = new Zemanta.RPC.Net();

        rpcnet.registerLogger(service._logger);
        rpcnet.setFilename(this._filename);
        rpcnet.setUrl(this._serviceURL);
        rpcnet.setType(type);
        rpcnet.setPostData(postData);
        rpcnet.setMethod(reqmethod);

        rpcnet.onComplete = function(rpc, result, response, type) { service.rpcComplete(rpc, result, response, type, callback); };

        // send immediately
        service._logger.debug("Zemanta.RPC.Service: sending rpc immediately");
        rpcnet.send();
    };

    this.createAction = function(action, replacements)
    {
        if (replacements)
        {
            for (var i=0; i<replacements.length; i++)
            {
                action = action.replace("%" + (i+1), escape(replacements[i]));
            }
        }

        return action;
    };

    this.createPostData = function(action, xmldata)
    {
        var postData 
            = '<?xml version="1.0"?>\n';

            // @@TODO Define here what the post data will be for particular requests, if any

        return postData;
    }

    this.getUniqueId = function()
    {
        var id = ((new Date()).getTime() - 1169730000000) + "" + (Math.round(1000*Math.random())+1000);
        return id;
    };
}

/* 
 * Public Utility Methods
 */

Zemanta.RPC.Service.prototype.setServiceFilename = function(filename)
{
    this._filename = filename;
}

Zemanta.RPC.Service.prototype.setServiceURL = function(url)
{
    this._serviceURL = url;
}

Zemanta.RPC.Service.prototype.registerLogger = function(logger)
{
    this._logger = logger;
}

Zemanta.RPC.Service.prototype.registerObserver = function(observer)
{
    var id = this.getUniqueId();

    this._observers[id] = observer;

    this._logger.info('Zemanta.RPC.Service.registerObserver: adding observer, id = ' + id);

    return id;
}

Zemanta.RPC.Service.prototype.unregisterObserver = function(observerId)
{
    for (var i in this._observers)
    {
        if (i == observerId)
        {
            this._observers[observerId] = null;
            this._logger.debug('Zemanta.RPC.Service.unregisterObserver: removed observer, id = ' + observerId);
            return;
        }
    }
}

/*
 * Zemanta Protocol Methods Below Here
 */

Zemanta.RPC.Service.prototype.getScriptFile = function(aScript, callback)
{
    this._logger.debug('Zemanta.RPC.Service.getScriptFile');

    var postData = null;
    var reqmethod = "GET";
    this.setServiceFilename(aScript.substring(aScript.lastIndexOf("/")+1));
    this.setServiceURL(aScript);
    this.rpcSend(Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_SCRIPT_ACTION_COMPLETE,
                 callback,
                 postData,
                 reqmethod);
}

Zemanta.RPC.Service.prototype.getRulesFile = function()
{
    var postData = null;
    var reqmethod = "GET";
    var rulesUrl = Zemanta.Util.getPreference("rules");
    var apikey = Zemanta.getAPIKey();
    if (apikey && apikey != "")
    {
        rulesUrl = rulesUrl + "?api_key=" + apikey;
    }
    this._logger.debug('Zemanta.RPC.Service.getRulesFile - sending request to : '+rulesUrl);
    this.setServiceURL(rulesUrl);
    this.rpcSend(Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_RULES_ACTION_COMPLETE,
                 null,
                 postData,
                 reqmethod);
}

Zemanta.RPC.Service.prototype.getImagesFile = function()
{
    var postData = null;
    var reqmethod = "GET";
    var imagesUrl = Zemanta.RPC.Constants.ZEMANTA_RPC_IMAGES_URL;
    this._logger.debug('Zemanta.RPC.Service.getImagesFile - sending request to : '+imagesUrl);
    this.setServiceURL(imagesUrl);
    this.rpcSend(Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_IMAGES_ACTION_COMPLETE,
                 null,
                 postData,
                 reqmethod);
}

Zemanta.RPC.Service.prototype.ZemantaAPIKey = function()
{
    this._logger.debug('Zemanta.RPC.Service.ZemantaAPIKey');
    //var action = Zemanta.RPC.Constants.ZEMANTA_RPC_GET_APIKEY_ACTION;

    var postData = "method=zemanta.auth.create_user";
    var reqmethod = "POST";
    this.setServiceURL(Zemanta.RPC.Constants.ZEMANTA_RPC_API_URL);
    this.rpcSend(Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_APIKEY_ACTION_COMPLETE,
                 null,
                 postData,
                 reqmethod);
}
