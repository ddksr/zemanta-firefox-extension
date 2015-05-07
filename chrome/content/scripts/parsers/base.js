/*
 * Base parser object
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.Parser = new function() {}

Zemanta.Parser = function()
{
    this.NAME = 'Base Parser';
    this.ID = 'BASE_PARSER';
    this.ENABLED = true;

    this.document = null;
    this.unsafeWin = null;
    this.href = null;
    this.loaderurl = null;
    this.loaderbase = "http://fstatic.zemanta.com";
    this.loaderbasesecure = "https://static.zemanta.com";
    //this.releaseid = 0;  // release_id will be read from rules.xml, seconds since 1970

    /* Download the scripts, before injection
    */
    this.getScript = function()
    {
        var service = Zemanta._service;
        var parser = this;
        var callback = function(event) 
        {
            // gets called on complete 
            if (event.isError()) return;
            var js = event.getData();

            //Zemanta.Logger.debug("JS file came back: ");
            //Zemanta.Logger.debug(js);

            var scriptName = parser.NAME.toLowerCase()+"-"+service._filename;
            Zemanta.Scripts.writeScriptFile(js, scriptName);
            Zemanta.Scripts.script = scriptName;
            Zemanta.Scripts.scriptFilesDone();
        }
        // We only want to load scripts from static.zemanta.com
        var loaderUrl = this.loaderurl.toString();
        var proceed = Zemanta.checkZemantaURL(loaderUrl, "static");
        var aUrl = this.href;
        var aUri = Components.classes["@mozilla.org/network/standard-url;1"].
                        createInstance(Components.interfaces.nsIURI);
        aUri.spec = aUrl;
        if (aUri.scheme == "https") {
            // If we are in a https page, we can only insert loader script from https
            // http://static.zemanta.com/ -> https://s3.amazonaws.com/static.zemanta.com/
            var regexS = this.loaderbase.replace('/', '\/');
            regexS = regexS.replace(':', '\:');
            regexS = regexS.replace('.', '\.');
            var re = new RegExp('^('+regexS+')', "i"); 
            loaderUrl = loaderUrl.replace(re, this.loaderbasesecure);
        }
        if (proceed)
        {
            Zemanta.Logger.debug("loaderUrl : "+loaderUrl);
            Zemanta._service.getScriptFile(loaderUrl, callback);
        }
        else
        {
            Zemanta.Logger.debug("Loader script not coming from expected source. NOT LOADING");
        }
    }

    // Insert more specific parsing functions here
}
Zemanta.Parser.prototype.setDocument = function(document)
{
    this.document = document;
    this.href = document.location.href;
}

Zemanta.Parser.prototype.preparse = function()
{
    // overridden when neccessary
    return true;
}

Zemanta.Parser.prototype.parse = function()
{
    Zemanta.Logger.debug("Starting parse with doc '" + this.href + "'");

    this.document.__zemanta_pagetype = 1;

    this.getScript();
}
