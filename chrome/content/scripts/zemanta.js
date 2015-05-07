/*
 * Zemanta base object
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

var Zemanta = new function() { }

Zemanta.zemantaStartPageURL = "http://www.zemanta.com/welcome";
Zemanta.zemantaUpgradePageURL = "http://www.zemanta.com/welcome/?upgrade";
Zemanta.zemantaSupportPageURL = "http://getsatisfaction.com/zemanta";
Zemanta.zemantaFAQPageURL = "http://www.zemanta.com/faq/";
Zemanta.zemantaAboutPageURL = "http://www.zemanta.com/firefox";
Zemanta.zemantaUninstallPage = "http://www.zemanta.com/uninstall/";

Zemanta.EMID = "firefox@zemanta.com";

Zemanta.init = function()
{
    this._activeParser = null;

    this._service = new Zemanta.RPC.Service();
    this._service.registerLogger(Zemanta.Logger);

    var hostEnvInfo = Zemanta.Util.getHostEnvironmentInfo();
    this.appName = hostEnvInfo.appName;
    this.appId = hostEnvInfo.appId;
}

Zemanta.process = function(document, zemSvc)
{
    var docIsActive = Zemanta.Util.isDocumentActive(document);
    if (docIsActive)
    {
        ZemantaLocationBarButton.toggleActive(false);
    }

    var enabled = Zemanta.Util.getPreference("enabled");
    if (!enabled)
    {
        Zemanta.Logger.error("Zemanta is TURNED OFF");
        return false;
    }

    if (!document || !document.location)
    {
        Zemanta.Logger.error("Invalid argument: '" + document + "'");
        return false;
    }

    var url = document.location.href;
    var theParser = Zemanta.getParser(url);

    // if no parser found, do no parsing
    if (!theParser)
    {
        Zemanta.Logger.debug("No parser found for the URL '" + url + "'");

        document.__zemanta_pagetype = 0;

        return false;
    }

    if (!theParser.preparse(document))
    {
        // this document is part of a valid site, but for some reason won't be
        // parsed - don't do anything more here

        return false;
    }

    // set the working document for the parser
    theParser.setDocument(document);
    if (docIsActive)
    {
        ZemantaLocationBarButton.toggleActive(true);
    }

    this._activeParser = theParser;

    this._activeParser.parse(zemSvc);
    this._activeParser = null;
    return true;
}

Zemanta.getParser = function(url)
{
    Zemanta.Logger.info("Zemanta.getParser");
    var theParser = null;
    var rulefilter = "";
    var ruletest = null;

    var enabledTypes = Zemanta.Util.getPreference("enabledTypes");
    var enabled = Zemanta.Util.getPreference("enabled");
    if (!enabled || !enabledTypes)  // Zemanta turned off
    {
        Zemanta.Logger.error("Zemanta is TURNED OFF");
        return null;
    }
    else {
        var eTypes = enabledTypes.split(" ");
        for each (eType in eTypes) {
            rulefilter = rulefilter + eType + "|";
        }
        rulefilter = rulefilter.substring(0, rulefilter.lastIndexOf("|"));
        ruletest = new RegExp('(^|\\s)('+rulefilter+')(\\s|$)', "i");
        Zemanta.Logger.debug("Rule filter = "+ rulefilter);
    }

    Zemanta.Rules.setupRulesRegexArray();
    for (var i = 0; i < Zemanta.Rules.rRxArray.length; i++) {
        if (Zemanta.Rules.rRxArray[i].test(url)) {
            var rules = Zemanta.Rules.rTypeArray[i];
            if (!rules || ruletest.test(rules)) {
                theParser = new Zemanta.Parser();
                theParser.NAME = Zemanta.Rules.rNameArray[i];
                theParser.loaderurl = Zemanta.Rules.rUrlArray[i];
                //theParser.releaseid = releaseid;
                Zemanta.Logger.info("Found a parser ('" + theParser.loaderurl + "') for the page '" + url + "'");
                break;
            }
        }
    }
    return theParser;
}

Zemanta.chromeGetAPIKey = function()
{
    var apikey = Zemanta.getAPIKey();
    Zemanta.Logger.debug("Zemanta.chromeGetAPIKey : apikey = " + apikey);
    if (apikey != "")
    {
        Zemanta.Logger.debug("NOT sending apikey request");
        return apikey;
    }

    var observerId = Zemanta._service.registerObserver({
        notify: function(event)
        {
            if (event.getType() == Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_APIKEY_ACTION_COMPLETE)
            {
                Zemanta._service.unregisterObserver(observerId);

                if (event.isError())
                {
                    Zemanta.Logger.error("RPC error: '" + event.getError().getMessage() + "'");
                    // show a generic error message ??
                    Zemanta.Logger.debug("There was a problem getting the API key"); // TODO Localise / Improve
                }
                else
                {
                    var rspText = event.getData();
                    var oParser = new DOMParser();
                    var theXML = oParser.parseFromString(rspText.toString(), "text/xml");
                    var status = theXML.getElementsByTagName("status")[0].firstChild.nodeValue;
                    Zemanta.Logger.debug("status = " + status);
                    if (status == "ok")
                    {
                        var key = theXML.getElementsByTagName("apikey")[0].firstChild.nodeValue;
                        Zemanta.setAPIKey(key);
                    }
                    else
                    {
                        Zemanta.Logger.debug("API key status was 0. Sorry!"); // TODO Localise / Improve
                    }
                }
            }
        }
    });

    Zemanta._service.ZemantaAPIKey();
    return apikey;
}

Zemanta.getAPIKey = function()
{
    // This will return an empty string if it is not set yet
    return Zemanta.Util.getPreference("apikey");
}

Zemanta.setAPIKey = function(aKey)
{
    Zemanta.Util.setPreference("apikey", aKey);
}

Zemanta.getReleaseId = function()
{
    // This will return 0 if it is not set yet
    return Zemanta.Util.getPreference("releaseid");
}

/* Called when a fresh rules file has been pulled and written locally
   This reads the release id, writes the pref, and determines if it has been updated.
    */
Zemanta.setReleaseId = function()
{
    var thexml = Zemanta.Rules.getRulesXML();
    var releaseid = 0;
    var curid = Zemanta.Util.getPreference("releaseid");
    if (thexml && thexml.getElementsByTagName("release_id"))
    {
        releaseid = thexml.getElementsByTagName("release_id")[0].firstChild.nodeValue;
        if (curid < releaseid)
        {
            Zemanta.clearImageCache();
        }
        Zemanta.Util.setPreference("releaseid", parseInt(releaseid));
    }
}

/* Pull images.xml down from the server, parse, and purge images from cache
    */
Zemanta.clearImageCache = function()
{
    var observerId = Zemanta._service.registerObserver({
        notify: function(event)
        {
            if (event.getType() == Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_IMAGES_ACTION_COMPLETE)
            {
                Zemanta._service.unregisterObserver(observerId);

                if (event.isError())
                {
                    Zemanta.Logger.error("RPC error: '" + event.getError().getMessage() + "'");
                    // show a generic error message ?
                    Zemanta.Logger.debug("There was a problem getting the Images file, trying for cached version.");
                }
                else
                {
                    var imgCacheService = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
                    var imgCache = tools.getImgCacheForDocument(relevantDocument);
					
                    var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                                 .getService(Components.interfaces.nsIIOService);
                    Zemanta.Logger.debug("Get Images File complete");
                    var theXML = event.getData();
                    Zemanta.Logger.debug("Images xml = '" + theXML + "'");
                    var images = theXML.image;
                    Zemanta.Logger.info("Number of images = " + images.length());
    
                    var imageUrl;
                    for each (var image in images)
                    {
                        try {
                            imageUrl = image.text();
                            Zemanta.clearCacheEntry(imageUrl);
                        } catch(e) {
                            Zemanta.Logger.info("Image cache removal error for : " + imageUrl + " - " + e);
                        }
                    }
                }
            }
        }
    });

    Zemanta._service.getImagesFile();
}

Zemanta.clearCacheEntry = function( url )
{
    try {
        var cacheService =
                Components.classes['@mozilla.org/network/cache-service;1']
                    .getService(Components.interfaces.nsICacheService);
        var httpCacheSession =
        cacheService.createSession("HTTP",
                Components.interfaces.nsICache.STORE_ANYWHERE, true);
        httpCacheSession.doomEntriesIfExpired = false;

        var cacheEntryDescriptor =
                httpCacheSession.openCacheEntry( url,
                Components.interfaces.nsICacheEntryDescriptor, false);
        if ( cacheEntryDescriptor) {
            cacheEntryDescriptor.setExpirationTime("0");
            cacheEntryDescriptor.doom();
            cacheEntryDescriptor.close();
            cacheService.evictEntries( Components.interfaces.nsICache.STORE_ANYWHERE );
            Zemanta.Logger.info( "Cache entry purged: " + url );
        } else {
            Zemanta.Logger.info( "No such cache entry: " + url );
        }
    }
    catch ( e ) {
        //Zemanta.Logger.error( "Error while clearing cache entry " + url + " : " + e );
    }
}

/* Check if the service preferences are loading, and invalidate cache is they are
   @parameter aUri - string url of page to check
    */
Zemanta.checkServicePrefs = function(aUrl)
{
    Zemanta.Logger.debug("checkServicePrefs : "+aUrl);
    var res = new RegExp('^(https?://prefs\.zemanta\.com)', "i");
    var isMatch = res.test(aUrl);
    if (isMatch)
    {
        var prefSvc = Components.classes["@mozilla.org/preferences-service;1"].
                          getService(Components.interfaces.nsIPrefService);
        var prefBranch = prefSvc.getBranch("extensions.zemanta.");
        if (prefBranch.prefHasUserValue("userprefs"))
        {
            prefBranch.clearUserPref("userprefs");
        }
    }
}

/* Check if the URL is from the Zemanta domain.
   @parameter aUri - Normally a NSIUri object, convert it to one if string
   @parameter subDomain (optional) - a subdomain to check for
    */
Zemanta.checkZemantaURL = function(aUri, subDomain)
{
    // If we get the URL as a string, convert it to an nsIUri object
    var uri = aUri;
    if (typeof uri == "string" || typeof uri == "undefined")
    {
        uri = Components.classes["@mozilla.org/network/standard-url;1"].
                        createInstance(Components.interfaces.nsIURI);
        uri.spec = aUri;
    }
    Zemanta.Logger.debug("checkZemantaURL : "+uri.spec);

    // First check the domain is correct
    var isMatch = false;
    try {
        // Firefox 3
        var TLDService = Components.classes["@mozilla.org/network/effective-tld-service;1"].
                               getService(Components.interfaces.nsIEffectiveTLDService);
        var thehost = TLDService.getBaseDomain(uri);
        isMatch = (thehost == "zemanta.com");
    }
    catch(e)
    {
        // Firefox 2
        var matchZemDom = "https?://([^/]+\.)?zemanta\.com";
        var re = new RegExp(matchZemDom, "i"); 
        isMatch = re.test(uri.spec);
    }

    // Now the sub-domain
    if (isMatch && subDomain)
    {
        var matchZemSubDom = "https?://"+subDomain+"\.zemanta\.com";
        var res = new RegExp(matchZemSubDom, "i");
        isMatch = res.test(uri.spec);
    }

    return isMatch;
}

/* Mind Read
   @parameter aSuggestResponse - The onreadystatechange response to zemanta.suggest
    */
Zemanta.MindRead = function(aArticles)
{
    var newArticles = [];
    var newCount = 0;
    try {
        for each (article in aArticles) {
            Zemanta.Logger.debug("MIND READ : History check for : " + article.url);
            var newArticle = [];
            newArticle.url = article.url;
            newArticle.confidence = article.confidence;
            newArticle.published_datetime = article.published_datetime;
            newArticle.zemified = article.zemified;
            newArticle.title = article.title;
            if (Zemanta.checkHistory(article.url, article.title)) {
                Zemanta.Logger.debug("Hurray, we found a match");
                newArticle.confidence = parseFloat(article.confidence) * 5;
            }
            newArticles[newCount] = newArticle;
            newCount++;
        }

        // Now sort by confidence and splice top 10
        newArticles.sort(function(a,b) a.confidence > b.confidence ? -1 : 1);
        newArticles = newArticles.slice(0, 10);
        for (var i=0;i<newArticles.length;i++) {
            Zemanta.Logger.debug("MR Top 10 : "+i+". URL: "+ newArticles[i].url + " | Confidence = " + newArticles[i].confidence);
        }
        return newArticles;
    }
    catch(e) {
        Zemanta.Logger.debug("EXCEPTION WHEN MIND READING : "+e);
        return aSuggestResponse;
    }
}

/* Check to see if a page is in history, based on criteria passed in
   @parameter aUrl - url of the page
   @parameter aTitle - page title (not used)
    */
Zemanta.checkHistory = function(aUrl, aTitle)
{
    var isMatch = false;
    var history = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                  .getService(Components.interfaces.nsINavHistoryService);
    
    var query = history.getNewQuery();
    
    // Matching only against url, for now
    //query.searchTerms = aUrl;
    var uri = Components.classes["@mozilla.org/network/standard-url;1"].
                        createInstance(Components.interfaces.nsIURI);
    uri.spec = aUrl;
    query.uri = uri;
    
    var result = history.executeQuery(query, history.getNewQueryOptions());
    
    // The root property of a query result is an object representing the folder you specified above.
    var resultContainerNode = result.root;
    
    // Open the result, and iterate over it's contents.
    resultContainerNode.containerOpen = true;
    for (var i=0; i < resultContainerNode.childCount; ++i) {
      var childNode = resultContainerNode.getChild(i);
    
      // Accessing properties of matching bookmarks
      var title = childNode.title;
      var uri = childNode.uri;
      isMatch = true;
    }

    return isMatch;
}
