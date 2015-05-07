/*
 * Logger interface
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.Logger = new function()
{
    this.ENABLE_CONSOLE_LOG = true;
    this.ENABLE_DUMP_LOG = false;
    this.ENABLE_TIMESTAMPS = false;

    this.consoleService = null;
    this._debug = null;
    this._verbose = null;

    this.debug = function(msg)
    {
        if (!this._isDebugEnabled()) return;

        this._realLog(msg, 5);
    }

    this.info = function(msg)
    {
        if (!this._isVerboseEnabled()) return;

        this._realLog(msg, 3);
    }

    this.log = function(msg)
    {
        if (!this._isVerboseEnabled()) return;

        this._realLog(msg, 3);
    }

    this.warn = function(msg)
    {
        if (!this._isVerboseEnabled()) return;

        this._realLog(msg, 2);
    }

    this.error = function(msg)
    {
        this._realLog(msg, 1);
    }

    this.fatal = function(msg)
    {
        this._realLog(msg, 1);
    }

    this._realLog = function(msg, level)
    {
        if (this.ENABLE_DUMP_LOG)
            this._dumpLog(msg, level);

        if (this.ENABLE_CONSOLE_LOG)
            this._consoleLog(msg, level);
    }

    this._dumpLog = function(msg, level)
    {
        dump("zemanta(" + level + "): " + msg + "\n\n");
    }

    this._consoleLog = function(msg, level)
    {
        if (!this.consoleService)
        {
            this.consoleService = Components.classes['@mozilla.org/consoleservice;1'].
                                    getService(Components.interfaces.nsIConsoleService);
        }

        var datestr = "";

        if (this.ENABLE_TIMESTAMPS)
        {
            var date = new Date();
            datestr = " " + date.getHours() + ":" + date.getMinutes() + ":"
                          + date.getSeconds() + "." + date.getMilliseconds();
        }

        this.consoleService.logStringMessage("zemanta(" + level + ")" + datestr + ": " + msg);
    }

    this._isDebugEnabled = function()
    {
        if (this._debug == undefined)
        {
            var debug = Zemanta.Util.getPreference("debug");

            if (debug == undefined)
                this._debug = false;
            else
                this._debug = debug;
        }

        return this._debug;
    }

    this._isVerboseEnabled = function()
    {
        if (this._isDebugEnabled() == true)
        {
            return true;
        }

        if (this._verbose == undefined)
        {
            var verbose = Zemanta.Util.getPreference("verbose");

            if (verbose == undefined)
                this._verbose = false;
            else
                this._verbose = verbose;
        }

        return this._verbose;
    }
}
