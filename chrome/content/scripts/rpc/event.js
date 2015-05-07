/*
 * The RPC Event
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.RPC.Event = function(type, result, response)
{
    // public instance variables
    this._type = type;
    this._result = result;
    this._response = response;
    this.error = null;

    this.parseResponse = function()
    {
        // parse the xml reponse, checking for SERVICE LEVEL errors
        //Zemanta.Logger.debug("xml = '" + this._response + "'");
        
        //@@TODO We don't know what the Zemanta XML will look like yet
        return;

        var rule = this._response.rule[0];
        var status = this._response.result.status.text();

        Zemanta.Logger.debug("status = '" + status + "'");

        if (status != 'OK' && rule == "")
        {
            var errorMessage = this._response.result.errorMessage.text();
            var url = this._response.result.url.text();

            Zemanta.Logger.debug("errorMessage = '" + errorMessage + "'");
            Zemanta.Logger.debug("url = '" + url + "'");

            if (status == 'BAD_XML')
                this._result = Zemanta.RPC.Constants.ZEMANTA_RPC_SERVICE_ERROR_BAD_XML;

            this.error = new Zemanta.RPC.Error();
            this.error.code = this._result;
            this.error.message = errorMessage;
            this.error.url = url;
        }
    }

    if (!this.isError())
    {
        this.parseResponse();
    }
}

Zemanta.RPC.Event.prototype.isError = function()
{
    return this._result != Zemanta.RPC.Constants.ZEMANTA_RPC_NET_SUCCESS;
}

Zemanta.RPC.Event.prototype.getError = function()
{
    // 2 types of error
    // 1) when result is false (protocol error) code = 400-600
    // 2) when there's an error in response (application error) code = 700+
    if (this._result == Zemanta.RPC.Constants.ZEMANTA_RPC_NET_SUCCESS) return null;

    if (this.error == null)
    {
        this.error = new Zemanta.RPC.Error();
        this.error.code = -1;
        this.error.message = "Internal error";
    }

    return this.error;
}

Zemanta.RPC.Event.prototype.getType = function()
{
    return this._type;
}

Zemanta.RPC.Event.prototype.getData = function()
{
    return this._response;
}

Zemanta.RPC.Event.prototype.toString = function()
{
    return "Event (" + (this.isError() ? this.getError().toString() : "Success") + ")";
}

