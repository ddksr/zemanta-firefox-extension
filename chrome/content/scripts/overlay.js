/* 
 * Zemanta overlay script into Firefox 
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */
 
Zemanta.Overlay = {

    // Private properties
    _zemSvc : null,

    // Public functions

    init : function ()
    {
        try {
            Zemanta.Overlay._zemSvc = Components.classes["@zemanta.com/zemanta-service;1"]
                                            .getService(Components.interfaces.zemIZemantaService);
        }
        catch(e) {
            //@@TODO, if we can't get the component service, the extension is pretty useless
            //Better error handling here
            Zemanta.Logger.error("Could not initialise zemantaService : "+e);
            return;
        }

        Zemanta.init();
        this.addListeners();

        Zemanta.versionCallback = function(version)
        {
            // Check first-run / update
            var zemfirst = Zemanta.Util.getPreference("firstrun");
            if (zemfirst) {
                Zemanta.Util.setPreference("firstrun", false);
                setTimeout(Zemanta.Util.browserLoad, 500, Zemanta.zemantaStartPageURL, "tab");
            }
            else
            {
                var currentVersion = Zemanta.Util.getPreference("currentversion");
                if (currentVersion != version) {
                    setTimeout(Zemanta.Util.browserLoad, 500, Zemanta.zemantaUpgradePageURL, "tab");
                    var zPrefs = Components.classes["@mozilla.org/preferences-service;1"].
                                      getService(Components.interfaces.nsIPrefService).getBranch("extensions.zemanta.");
                    if (zPrefs.prefHasUserValue("rules"))
                        zPrefs.clearUserPref("rules");
                }
            }
            Zemanta.Util.setPreference("currentversion", version);
        }

        Zemanta.Util.getExtensionVersion();

        // Enabled?
        ZemantaLocationBarButton.toggle();

        // Check for API key
        Zemanta.chromeGetAPIKey();

        // Get the rules file
        Zemanta.Rules.getRulesFile();
    },

    addListeners : function ()
    {
        // Prefs listener
        ZemantaPrefsWatcher.startup();
 
        if (Zemanta.appId == Zemanta.Util.MOBILE_ID)
        {
            // browser(s) load listener
            var browsers = document.getElementById("browsers");
            browsers.addEventListener("DOMContentLoaded", this.onPageLoad, true);
            // Tab select listener
            var tabs = document.getElementById("tabs");
            tabs.addEventListener("TabSelect", Zemanta.Overlay.tabSelected, true);
        }
        else // Firefox desktop
        {
            // browser(s) load listener
            var appcontent = document.getElementById("appcontent");
            if (appcontent)
            {
                appcontent.addEventListener("DOMContentLoaded", this.onPageLoad, true);
            }
            // Tab select listener
            gBrowser.addProgressListener(zemanta_urlBarListener,
                    Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
        }

        // uninstall observer
        try {
            if (Zemanta.Overlay._zemSvc) {
                Zemanta.Overlay._zemSvc.wrappedJSObject.startUninstallObserver();
            }
        }
        catch(e) {
            //@@TODO, Better error handling here?
        }
    },

    /* Set the state of menu item(s) when popup is opened, e.g. checkmark */
    /* @@TODO ... try to merge with ZemantaLocationBarButton.setPopupItems */
    setPopupItems : function ()
    {
        var state = "false";
        var enableItem = document.getElementById("zemanta-menu-enable");
        var enabled = Zemanta.Util.getPreference("enabled");
        state = enabled ? "true" : "false";
        enableItem.setAttribute("checked", state);
    },

    /* Turn on/off Zemanta */
    toggleEnabled : function ()
    {
        var zemEnabled = Zemanta.Util.getPreference("enabled");
        Zemanta.Util.setPreference("enabled", !zemEnabled);
        ZemantaLocationBarButton.toggle();
    },

    /* Toggle the current page active state (in UI) */
    toggleActive : function ()
    {
        var state = false;
        var browser = (Zemanta.appId == Zemanta.Util.MOBILE_ID) ? Browser.selectedBrowser : gBrowser.selectedTab.linkedBrowser;
        var doc = browser.contentDocument;
        if (doc.__zemanta_pagetype == 1) {
            state = true;
        }
        ZemantaLocationBarButton.toggleActive(state);
    },

    onPageLoad : function (aEvent)
    {
        var doc = aEvent.originalTarget;
        if (aEvent.originalTarget.defaultView.frameElement)
        {
            // frame in document, do not process
            Zemanta.Logger.debug("Frame in page loading, not processing");
            return;
        }
        Zemanta.Logger.debug("onPageLoad");

        if (doc.nodeName == "#document") {
            Zemanta.Logger.debug("Page Loading : "+doc.location);
            if (Zemanta.process(doc))
            {
                var safeWin = aEvent.target.defaultView;
                var unsafeWin = safeWin.wrappedJSObject;
                var href = safeWin.location.href;
                Zemanta.Overlay._zemSvc.domContentLoaded(safeWin, window);
                //unsafeWin.addEventListener("pagehide", "contentUnload", true);
            }
            // Invalidate prefs in Zemanta prefs page loads
            var url = doc.location;
            Zemanta.checkServicePrefs(url);
        }
        // For Fennec, we also need to toggle active on page load because tab select does not handle it
        if (Zemanta.appId == Zemanta.Util.MOBILE_ID)
            Zemanta.Overlay.toggleActive();
    },

    /* Invoked when a tab is changed/selected */
    tabSelected : function (aEvent)
    {
        Zemanta.Overlay.toggleActive();
    },

    doSupport : function ()
    {
        this.browserLoad(Zemanta.zemantaSupportPageURL, "tab");
    },

    doFAQ : function ()
    {
        this.browserLoad(Zemanta.zemantaFAQPageURL, "tab");
    },

    doAbout : function ()
    {
        this.browserLoad(Zemanta.zemantaAboutPageURL, "tab");
    },

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
    browserLoad : function (aUrl, location)
    {
        openUILinkIn(aUrl, location);  // from utilityOverlay.js
    }

}

/* Location Bar Button */
var ZemantaLocationBarButton = {

    /* Set the state of menu item(s) when popup is opened, e.g. checkmark */
    setPopupItems : function ()
    {
        try {
            var state = "false";
            var enableItem = document.getElementById("zemanta-urlbar-enable");
            var enabled = Zemanta.Util.getPreference("enabled");
            state = enabled ? "true" : "false";
            enableItem.setAttribute("checked", state);

            this.toggle();
        }
        catch(e) {
            Zemanta.Logger.debug("ZemantaLocationBarButton.setPopupItems error"+e);
        }
    },

    toggle: function()
    {
        var urlbaricon = document.getElementById("zemanta-urlbar-icon");
        var enabled = Zemanta.Util.getPreference("enabled");
        var state = enabled ? "true" : "false";
        if (urlbaricon)
            urlbaricon.setAttribute("activated", state);
    },

    toggleActive: function(state)
    {
        var urlbaricon = document.getElementById("zemanta-urlbar-icon");
        if (urlbaricon)
            document.getElementById("zemanta-urlbar-icon").setAttribute("active", state);
    },

    disable: function()
    {
        document.getElementById("zemanta-urlbar-icon").disabled = true;
    },

    enable: function()
    {
        document.getElementById("zemanta-urlbar-icon").disabled = false;
    }

};

/* This web progress listener only exists currently to detect location change
  (in url bar when page loads or tab is changed) so that determine if we are on 
  a parser page and change the state of the location bar button */ 
var zemanta_urlBarListener = {
  QueryInterface: function(aIID)
  {
   if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
       aIID.equals(Components.interfaces.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onLocationChange: function(aProgress, aRequest, aURI)
  {
      Zemanta.Overlay.toggleActive();
  },

  onStateChange: function() {},
  onProgressChange: function() {},
  onStatusChange: function() {},
  onSecurityChange: function() {},
  onLinkIconAvailable: function() {}
};

/**
 * Prefs Watcher : observe Preferences and act as needed
 */
var ZemantaPrefsWatcher = {
  prefs: null,
  startup: function() {
    const Ci = Components.interfaces;
    const prefService = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Ci.nsIPrefService);
    this.prefs = prefService.getBranch("extensions.zemanta.");
    this.prefs.QueryInterface(Ci.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);
  },
  shutdown: function()
  {
    this.prefs.removeObserver("", this);
  },
  observe: function (subject, topic, data)
  {
    if (topic != "nsPref:changed") {
      return;
    }
    switch(data)
    {
      case "enabled":
        ZemantaLocationBarButton.toggle();
        break;
    }
  }
};

window.addEventListener("load", function() { Zemanta.Overlay.init(); }, false);
