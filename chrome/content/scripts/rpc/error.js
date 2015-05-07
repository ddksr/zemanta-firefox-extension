/*
 * An RPC Error
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.RPC.Error = function(code)
{
        this.code = (code != null?code:0);
        this.message = "";
        this.url = null;
}

Zemanta.RPC.Error.prototype.getCode = function()
{
        return this.code;
}

Zemanta.RPC.Error.prototype.getMessage = function()
{
        if (this.message == "")
        {
                return "Error code " + this.code;
        }
        else
        {
                return this.message;
        }
}

Zemanta.RPC.Error.prototype.getURL = function()
{
        return this.url;
}


Zemanta.RPC.Error.prototype.toString = function()
{
        return "Error " + this.getCode() + ": " + this.getMessage();
}

