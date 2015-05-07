/*
 * Utility Functions
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.Util = new function()
{
    this._prefServiceRoot = "extensions.zemanta.";
    this._prefServiceListDelimiter = "|";
    this._prefServiceCache = null;
    this.JSON = null;
}

Zemanta.Util.FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
Zemanta.Util.Cc = Components.classes;
Zemanta.Util.Ci = Components.interfaces;

/* Open a URL in the browser
   @parameter aUrl - page to load
   @parameter location - where to open it, current tab or new tab
     |location| can be:
     "current"     current tab            (if there aren't any browser windows, then in a new window instead)
     "tab"         new tab                (if there aren't any browser windows, then in a new window instead)
     "tabshifted"  same as "tab" but in background if default is to select new tabs, and vice versa
     "window"      new window
     "save"        save to disk (with no filename hint!)
*/
Zemanta.Util.browserLoad = function (aUrl, location)
{
    // Call to function in browser's utilityOverlay.js
    // Make sure it is in scope
    openUILinkIn(aUrl, location);
}

Zemanta.Util.getExtensionVersion = function(aCallback)
{
    var bits = {major: 1, minor: 0, revision: 0, increment: 0};

    Components.utils.import("resource://gre/modules/AddonManager.jsm");

    AddonManager.getAddonByID(Zemanta.EMID, function(addon) {
        if (addon) {
            Zemanta.versionCallback(addon.version);
        }
    });
    Zemanta.versionCallback(addon.version);
}

Zemanta.Util.getGlobalPref = function(aPrefName, aIsComplex)
{
    const Ci = Components.interfaces;
    const prefB = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Ci.nsIPrefBranch);
    if (aIsComplex) {
        return prefB.getComplexValue(aPrefName, Ci.nsISupportsString).data;
    }
    switch (prefB.getPrefType(aPrefName)) {
      case Ci.nsIPrefBranch.PREF_BOOL:
        return prefB.getBoolPref(aPrefName);
      case Ci.nsIPrefBranch.PREF_INT:
        return prefB.getIntPref(aPrefName);
      case Ci.nsIPrefBranch.PREF_STRING:
        return prefB.getCharPref(aPrefName);
      default: // includes nsIPrefBranch.PREF_INVALID
        return null;
    }
}

Zemanta.Util.setPreference = function(name, value)
{
    try
    {
        if (typeof value == 'boolean') 
        {
            if (this.getPreference(name) != value)
                this._getPrefService().setBoolPref(name, value);
        }
        else if (typeof value == 'number')
        {
            if (this.getPreference(name) != value)
                this._getPrefService().setIntPref(name, value);
        }
        else if (typeof value == 'string')
        {
            if (this.getPreference(name) != value)
                this._getPrefService().setCharPref(name, value);
        }
        else
        {
            this._getPrefService().setCharPref(name, value.toString());
        }
    }
    catch (e)
    {
        Zemanta.Logger.error(e);
    }
}

Zemanta.Util.getPreference = function(name)
{
    var val = null;

    try
    {
        var type = this._getPrefService().getPrefType(name);

        if (this._getPrefService().PREF_BOOL == type)
        {
            val = this._getPrefService().getBoolPref(name);
        }
        else if (this._getPrefService().PREF_INT == type)
        {
            val = this._getPrefService().getIntPref(name);
        }
        else if (this._getPrefService().PREF_STRING == type)
        {
            val = this._getPrefService().getCharPref(name);
        }
        else
        {
            Zemanta.Logger.error("Invalid pref: " + name);
        }
    }
    catch (e)
    {
        Zemanta.Logger.error(e);
    }

    return val;
}

Zemanta.Util.setPreferenceList = function(name, list)
{
    // TODO ensure there's no this._prefServiceListDelimiter in the list

    var joinedList = list.join(this._prefServiceListDelimiter);

    this.setPreference(name, joinedList);
}

Zemanta.Util.getPreferenceList = function(name)
{
    var pref = this.getPreference(name, "char");

    if (!pref) return new Array();

    return pref.split(this._prefServiceListDelimiter);
}

Zemanta.Util._getPrefService = function()
{
    if (!this._prefServiceCache)
    {
        try
        {
            var prefSvc = Components.classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefService);
            this._prefServiceCache = prefSvc.getBranch(this._prefServiceRoot);
        }
        catch (e)
        {
            Zemanta.Logger.error("Can't get Prefs Service: " + e);
        }
    }

    return this._prefServiceCache;
}

/**
 * Is the document 'active', i.e. is it in the currently selected browser tab / window
 *
 * @param document the document to check is active
 * @param _cw internal, don't use
 */
Zemanta.Util.isDocumentActive = function(document, _cw)
{
    var highbrow = (Zemanta.appId == Zemanta.Util.MOBILE_ID) ? Browser.selectedBrowser : gBrowser.selectedBrowser;
    if (!_cw)
    {
        _cw = highbrow.contentWindow;
    }

    if (highbrow.contentDocument == document)
    {
        return true;
    }

    var frames = _cw.frames;

    for (var i=0; i<frames.length; i++)
    {
        if (frames[i].document == document)
        {
            return true;
        }

        // also need to check recursively

        var retval = Zemanta.Util.isDocumentActive(document, frames[i]);

        if (retval == true)
        {
            return true;
        }
    }

    return false;
}

Zemanta.Util.dumpObject = function(obj, name, indent, depth)
{
    Zemanta.Logger.debug(Zemanta.Util._dumpObject(obj, name, indent, depth));
}
Zemanta.Util._dumpObject = function(obj, name, indent, depth)
{
    if (!name) name = "object";
    if (!indent) indent = " ";

    if (depth > 10)
    {
        return indent + name + ": <Maximum Depth Reached>\n";
    }

    if (typeof obj == "object")
    {
        var child = null;
        var output = indent + name + "\n";
        indent += "\t";

        for (var item in obj)
        {
            try
            {
                child = obj[item];
            }
            catch (e)
            {
                child = "<Unable to Evaluate>";
            }

            if (typeof child == "object")
            {
                output += Zemanta.Util._dumpObject(child, item, indent, depth + 1);
            }
            else
            {
                output += indent + item + ": " + child + "\n";
            }
        }
        return output;
    }
    else
    {
        return obj;
    }
}

/**
 * Returns textual content of an element (and descendands) with whitespace between text nodes
 */
Zemanta.Util.textWhiteSpace = function(element)
{
    if (element.nodeType == 3)
    {
        return element.nodeValue;
    }
    else if (element.nodeType == 1)
    {
        var text = "";

        for (var i=0; i<element.childNodes.length; i++)
        {
            text += Zemanta.Util.textWhiteSpace(element.childNodes[i]) + " ";
        }

        return text;
    }
}

/**
 * Returns the user's Firefox profile folder, as an nsIFile Object
 */
Zemanta.Util.getProfileFolder = function()
{
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
                     .getService(Components.interfaces.nsIProperties)
                     .get("ProfD", Components.interfaces.nsIFile);
    return file;
}

Zemanta.Util.ZEM_hitch = function(obj, meth)
{
  if (!obj[meth]) {
    throw "method '" + meth + "' does not exist on object '" + obj + "'";
  }

  var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

  return function() {
    // make a copy of staticArgs (don't modify it because it gets reused for
    // every invocation).
    var args = Array.prototype.slice.call(staticArgs);

    // add all the new arguments
    Array.prototype.push.apply(args, arguments);

    // invoke the original function with the correct this obj and the combined
    // list of static and dynamic arguments.
    return obj[meth].apply(obj, args);
  };
}

/**
 * Returns the number of seconds since 1970
 */
Zemanta.Util.secsSince1970 = function()
{
    var thedate = new Date();
    var ms = thedate.getTime();
    secs = ms/1000; // seconds
    return secs;
}

Zemanta.Util.getHostEnvironmentInfo = function()
{
    // Returns "WINNT" on Windows Vista, XP, 2000, and NT systems;
    // "Linux" on GNU/Linux; and "Darwin" on Mac OS X.
    var osString = this.Cc["@mozilla.org/xre/app-info;1"]
        .getService(this.Ci.nsIXULRuntime).OS;

    var info = this.Cc["@mozilla.org/xre/app-info;1"]
        .getService(this.Ci.nsIXULAppInfo);
    // Get the name of the application running us
    info.ID;
    info.name; // Returns "Firefox" for Firefox
    info.version; // Returns "2.0.0.1" for Firefox version 2.0.0.1

    var hostEnvInfo =
    {
        os: osString,
        appId: info.ID,
        appName: info.name,
        appVersion: info.version
    }

    return hostEnvInfo;
}

Zemanta.Util.getJSON = function()
{
    if (!this.JSON) {
        // The JSON object is available at global scope in Firefox 3.5
        // For Firefox 3.0, import the JSON module
        if (typeof(JSON) == "undefined") {
            Components.utils.import("resource://gre/modules/JSON.jsm");
            JSON.parse = JSON.fromString;
            JSON.stringify = JSON.toString;
        }
        this.JSON = JSON;
    }
    return this.JSON;
}

/**
 * Utility to create an error message in the log without throwing an error.
 */
Zemanta.Util.logError = function(e, opt_warn, fileName, lineNumber)
{
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);

  var consoleError = Components.classes["@mozilla.org/scripterror;1"]
    .createInstance(Components.interfaces.nsIScriptError);

  var flags = opt_warn ? 1 : 0;

  // third parameter "sourceLine" is supposed to be the line, of the source,
  // on which the error happened.  we don't know it. (directly...)
  consoleError.init(e.message, fileName, null, lineNumber,
                    e.columnNumber, flags, null);

  consoleService.logMessage(consoleError);
}

Zemanta.Util.compareAppVersion = function(aTarget)
{
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
      .getService(Components.interfaces.nsIXULAppInfo);
  var versionChecker = Components
      .classes["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Components.interfaces.nsIVersionComparator);

  return versionChecker.compare(appInfo.version, aTarget);
}
