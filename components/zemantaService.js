/*
 * Zemanta service component
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

// XPCOM info
const DESCRIPTION = "ZemantaService";
const CONTRACTID = "@zemanta.com/zemanta-service;1";
const CLASSID = Components.ID("{55c94759-1c44-4391-aadd-09eeabe9eb20}");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Only a particular set of strings are allowed. See: http://goo.gl/ex2LJ
var gMaxJSVersion = "1.8";

// XPCOMUtils.defineLazyServiceGetter() introduced in FF 3.6
if (XPCOMUtils.defineLazyServiceGetter) {
  XPCOMUtils.defineLazyServiceGetter(
      this, "appSvc", "@mozilla.org/appshell/appShellService;1",
      "nsIAppShellService");
} else {
  appSvc = Cc["@mozilla.org/appshell/appShellService;1"]
      .getService(Ci.nsIAppShellService);
}

const zemSvcFilename = Components.stack.filename;

var gUninstallObserverInited = false;
const gEmGUID = "firefox@zemanta.com";

var gStartupHasRun = false;

var gBeingUninstalled = false;

/* For debugging only */
function alert(msg)
{
  Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService)
    .alert(null, "Zemanta alert", msg);
};

/* When the add-on is uninstalled, but before Firefox is shutdown
 * The user still has a chance to Undo
 * e.g. Show uninstall page
 */
function uninstallMaybe()
{
    showUninstallPage();
}
 
/* When the add-on is uninstalled, and Firefox is shutting down
 * e.g. Remove prefs set by ant toolbar
 */
function uninstallShutdown()
{
    try {
      cleanupPrefs();
    }
    catch(e) { }
}

/* Remove certain user set Zemanta prefs on uninstall */
function cleanupPrefs()
{
    var prefSvc = Cc["@mozilla.org/preferences-service;1"].
                      getService(Ci.nsIPrefService);
    var prefBranch = prefSvc.getBranch("extensions.zemanta.");
    if (prefBranch.prefHasUserValue("firstrun"))
    {
        prefBranch.clearUserPref("firstrun");
    }
    if (prefBranch.prefHasUserValue("currentversion"))
    {
        prefBranch.clearUserPref("currentversion");
    }
    if (prefBranch.prefHasUserValue("userprefs"))
    {
        prefBranch.clearUserPref("userprefs");
    }
}

/* Remove certain user set Zemanta prefs on startup */
function cleanupPrefsStartup()
{
    try
    {
        var prefSvc = Cc["@mozilla.org/preferences-service;1"].
                          getService(Ci.nsIPrefService);
        var prefBranch = prefSvc.getBranch("extensions.zemanta.");
        if (prefBranch.prefHasUserValue("userprefs"))
        {
            prefBranch.clearUserPref("userprefs");
        }
    }
    catch (e)
    {
        // Not a biggie if we fail here
        Zemanta.Logger.info("Can't get Prefs Service: " + e);
    }
}

function showUninstallPage()
{
    if (Zemanta.Util.compareAppVersion("3.7") >= 0)
    {
        // Firefox 4+
        var bWin = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getMostRecentWindow("navigator:browser");
        let browser = bWin.gBrowser;
        browser.loadOneTab(Zemanta.zemantaUninstallPage, {inBackground: false});
    }
    else
    {
        Zemanta.Logger.info("showUninstallPage 3.6");
        Zemanta.Util.browserLoad(Zemanta.zemantaUninstallPage, "tab");
    }
}

// Examines the stack to determine if an API should be callable.
function Zem_apiLeakCheck(apiName)
{
  var stack = Components.stack;

  do {
    // Valid stack frames for GM api calls are: native and js when coming from
    // chrome:// URLs and the greasemonkey.js component's file:// URL.
    if (2 == stack.language) {
      // NOTE: In FF 2.0.0.0, I saw that stack.filename can be null for JS/XPCOM
      // services. This didn't happen in FF 2.0.0.11; I'm not sure when it
      // changed.
      if (stack.filename != null &&
          stack.filename != zemSvcFilename &&
          stack.filename.substr(0, 6) != 'chrome') {
        Zemanta.Logger.error("Zemanta access violation: unsafeWindow " +
                    "cannot call " + apiName + ".");
        return false;
      }
    }

    stack = stack.caller;
  } while (stack);

  return true;
}

function startup()
{
    if (gStartupHasRun) return;
    gStartupHasRun = true;

    var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Ci.mozIJSSubScriptLoader);
    try {
        // utilityOverlay - needed by showUninstallPage
        loader.loadSubScript("chrome://browser/content/utilityOverlay.js");
    }
    catch(e) {
        dump("file load fail : utilityOverlay \n");
    }
    try {
        loader.loadSubScript("chrome://global/content/XPCNativeWrapper.js");
    }
    catch(e) {
        dump("file load fail : XPCNativeWrapper \n");
    }
    loader.loadSubScript("chrome://zemanta/content/scripts/zemanta.js");
    loader.loadSubScript("chrome://zemanta/content/scripts/logger.js");
    loader.loadSubScript("chrome://zemanta/content/scripts/util.js");
    loader.loadSubScript("chrome://zemanta/content/scripts/zemantaXmlhttprequest.js");
    loader.loadSubScript("chrome://zemanta/content/scripts/scripts.js");

    if (Zemanta.Util.compareAppVersion("4.0") >= 0) {
      gMaxJSVersion = "ECMAv5";
    }
}

/* The zemantaService class constructor. */
function zemantaService()
{
  this.init();
}

/* the zemantaService class def */
zemantaService.prototype = {
  classDescription:  DESCRIPTION,
  classID:           CLASSID,
  contractID:        CONTRACTID,

  wrappedJSObject : null,
  gPrefRoot : "",
  gPrefs : null,

  unsafeWin : null,
  unsafeLoc : null,
  href : "",
  chromeWin : null,

   _xpcom_categories: [{category: "app-startup",
                       entry: DESCRIPTION,
                       value: CONTRACTID,
                       service: true}],

  // nsISupports
  QueryInterface: XPCOMUtils.generateQI([
      Ci.nsIObserver,
      Ci.nsISupports,
      Ci.nsISupportsWeakReference,
      Ci.zemIZemantaService,
      Ci.nsIWindowMediatorListener,
      Ci.nsIContentPolicy
  ]),

  init: function()
  {
    this.wrappedJSObject = this;
    var prefSvc = Cc["@mozilla.org/preferences-service;1"].
                        getService(Components.interfaces.nsIPrefService);
    this.gPrefs = prefSvc.getBranch("extensions.zemanta.");
  },

  startUninstallObserver : function ()
  {
    if (gUninstallObserverInited) return;

    try
    {
        Components.utils.import("resource://gre/modules/AddonManager.jsm");

        var listener = {
            onUninstalling: function(addon) {
                if (addon.id == gEmGUID) {
                    gBeingUninstalled = true;
                    uninstallMaybe()
                }
            },
            onOperationCancelled: function(addon) {
                if (addon.id == gEmGUID)
                  gBeingUninstalled = false;
            },
            onUninstalled: function(addon) {  },
            onDisabling: function(addon) {  },
            onDisabled: function(addon) {  }
        };

        AddonManager.addAddonListener(listener);
        gUninstallObserverInited = true;
    }
    catch (e)
    {
        var e = new Error("Could not uninstall observer.");
        Zemanta.Util.logError(e, 0, e.fileName, e.lineNumber);
      
    }
  },

  addonsAction :
  {
      _uninstall : false,
      observe : function (subject, topic, data)
      {
        if (topic == "em-action-requested") {
            subject.QueryInterface(Ci.nsIUpdateItem);
            if (subject.id == gEmGUID) {
                if (data == "item-uninstalled") {
                    // This fires more than once, so add a check
                    if (this._uninstall == false)
                    {
                        this._uninstall = true;
                        uninstallMaybe();
                    }
                }
                else if (data == "item-cancel-action")
                    this._uninstall = false;
            }
        }
        else if (topic == "quit-application-granted") {
            if (this._uninstall) {
                uninstallShutdown();
            }
            this.unregister();
        }
      },

      unregister : function()
      {
        var observerService = Components.classes["@mozilla.org/observer-service;1"].
                                getService(Components.interfaces.nsIObserverService);
        observerService.removeObserver(this, "em-action-requested");
        observerService.removeObserver(this, "quit-application-granted");
      }
  },

  domContentLoaded : function(wrappedContentWin, chromeWin)
  {
    this.unsafeWin = wrappedContentWin.wrappedJSObject;
    this.unsafeLoc = new XPCNativeWrapper(this.unsafeWin, "location").location;
    this.href = new XPCNativeWrapper(this.unsafeLoc, "href").href;
    this.chromeWin = chromeWin;

    this.wrappedContentWin = wrappedContentWin;
    var url = wrappedContentWin.document.location.href;
  },

  handleScript : function(script)
  {
    if (script) {
      this.injectScript(script, this.url, this.wrappedContentWin, this.chromeWin);
    }
  },

  shouldLoad: function(ct, cl, org, ctx, mt, ext)
  {
    var ret = Ci.nsIContentPolicy.ACCEPT;

    // block content detection of greasemonkey by denying GM
    // chrome content, unless loaded from chrome
    if (org && org.scheme != "chrome" && cl.scheme == "chrome" &&
        cl.host == "zemanta") {
      return Ci.nsIContentPolicy.REJECT_SERVER;
    }

    // @@TODO don't intercept anything when Zemanta is not enabled

    // don't interrupt the view-source: scheme
    // (triggered if the link in the error console is clicked)
    if ("view-source" == cl.scheme) {
      return ret;
    }

    return ret;
  },

  injectScript: function(script, url, wrappedContentWin, chromeWin)
  {
                
    var unsafeWin = wrappedContentWin.wrappedJSObject;
    var xmlhttpRequester = new ZemantaXMLHttpRequest(unsafeWin, appSvc.hiddenDOMWindow);
                                                           
    var sandbox = new Cu.Sandbox(
          [wrappedContentWin],
              {
              'sandboxName': 'abc',
              'sandboxPrototype': wrappedContentWin,
              'unsafeWindow': unsafeWin,
              'XPathResult': Ci.nsIDOMXPathResult
    });
  
    var unsafeWindowGetter = new sandbox.Function('return window.wrappedJSObject || window;');  
    Object.defineProperty(sandbox, 'unsafeWindow', {get: unsafeWindowGetter});   

    sandbox.ZemantaXMLHttpRequest = Zemanta.Util.ZEM_hitch(xmlhttpRequester, "contentStartRequest");
    sandbox.ZemantaGetAPIKey = Zemanta.Util.ZEM_hitch(xmlhttpRequester, "getAPIKey");
    sandbox.ZemantaGetReleaseId = Zemanta.Util.ZEM_hitch(xmlhttpRequester, "getReleaseId");
                        
            
    var appName = Zemanta.Util.getHostEnvironmentInfo().appName;

    // API Calls available to the document
    
    var scriptfilepath = Zemanta.Scripts.getScriptFileURI(script);
    var contents = Zemanta.Scripts.getContents(scriptfilepath);

    // func.apply in the snadbox is horked in 4.0b12 +, so add the functions and alternative way
    if (Zemanta.Util.compareAppVersion("4.0b12") >= 0 || appName == "SeaMonkey") {
        var scriptSrc = "\n" + 
                        "unsafeWindow.ZemantaGetAPIKey = this.ZemantaGetAPIKey;" +
                        "\n" +
                        "unsafeWindow.ZemantaGetReleaseId = this.ZemantaGetReleaseId;" +
                        "\n" +
                        "unsafeWindow.ZemantaXMLHttpRequest = this.ZemantaXMLHttpRequest;" +
                        "\n" +
                        contents +
                        "\n";
    }
    else {
        var zemWrap = "function zemApply(obj, func) {" + "\n" +
                        "return function() {" + "\n" +
                          "return func.apply(obj, arguments);" + "\n" +
                        "};" + "\n" +
                       "}";
    
        var scriptSrc = "\n" +
                        zemWrap +
                        "\n" +
                        "unsafeWindow.ZemantaGetAPIKey = zemApply(this, ZemantaGetAPIKey);" +
                        "\n" +
                        "unsafeWindow.ZemantaGetReleaseId = zemApply(this, ZemantaGetReleaseId);" +
                        "\n" +
                        "unsafeWindow.ZemantaXMLHttpRequest = zemApply(this, ZemantaXMLHttpRequest);" +
                        "\n" +
                        contents +
                        "\n";
    }

    if (!script.unwrap)
      scriptSrc = "(function(){"+ scriptSrc +"})()";
    if (!this.evalInSandbox(scriptSrc, sandbox, script) && script.unwrap) {
      // Wrap anyway on early return
      this.evalInSandbox("(function(){"+ scriptSrc +"})()", sandbox, script);
    };
  },

  evalInSandbox: function(code, sandbox, script) {
    if (!(Components.utils && Components.utils.Sandbox)) {
      var e = new Error("Could not create sandbox.");
      Zemanta.Util.logError(e, 0, e.fileName, e.lineNumber);
      return true;
    }
    try {
      // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=307984
      var lineFinder = new Error();
      Components.utils.evalInSandbox(code, sandbox, gMaxJSVersion);
    } catch (e) { // catches errors while running the script code
      try {
        if (e && "return not in function" == e.message)
          return false; // means this script depends on the function enclosure

        // try to find the line of the actual error line
        var line = e && e.lineNumber;
        if (4294967295 == line) {
          // Line number is reported as max int in edge cases. Sometimes
          // the right one is in the "location", instead. Look there.
          if (e.location && e.location.lineNumber) {
            line = e.location.lineNumber;
          } else {
            // Reporting maxint is useless, if we couldn't find it in location
            // either, forget it. A value of 0 isn't shown in the console.
            line = 0;
          }
        }

        if (line) {
          var err = this.findError(script, line - lineFinder.lineNumber - 1);
          Zemanta.Util.logError(
            e, // error obj
            0, // 0 = error (1 = warning)
            err.uri,
            err.lineNumber
          );
        } else {
          Zemanta.Util.logError(
            e, // error obj
            0, // 0 = error (1 = warning)
            script.fileURL,
            0
          );
        }
      } catch (e) { // catches errors we cause trying to inform the user
        // Do nothing. More importantly: don't stop script incovation sequence.
      }
    }
    return true; // did not need a (function() {...})() enclosure.
  },

  findError: function(script, lineNumber){
    var start = 0;
    var end = 1;

    for (var i = 0; i < script.offsets.length; i++) {
      end = script.offsets[i];
      if (lineNumber <= end) {
        return {
          uri: script.requires[i].fileURL,
          lineNumber: (lineNumber - start)
        };
      }
      start = end;
    }

    return {
      uri: script.fileURL,
      lineNumber: (lineNumber - end)
    };
  },

  // Observer Service
  __observerSvc: null,
  get _observerSvc() {
    if (!this.__observerSvc)
      this.__observerSvc =
        Components.classes["@mozilla.org/observer-service;1"].
        getService(Components.interfaces.nsIObserverService);
    return this.__observerSvc;
  },

  // nsIObserver
  observe: function(aSubject, aTopic, aData) {
    switch(aTopic) {
        case "profile-after-change":
          this._observerSvc.addObserver(this, "profile-change-teardown", false);
          startup();

          // We need to delay the cleaning of prefs at startup, otherwise they are not loaded and read correctly
          var timerevent = { notify: function(timer) { cleanupPrefsStartup(); } }
          var nsITimer = Components.interfaces.nsITimer;
          var stdTimer = Components.classes["@mozilla.org/timer;1"]
                                     .createInstance(nsITimer);
          stdTimer.initWithCallback(timerevent, 0, nsITimer.TYPE_ONE_SHOT);
          break;
        case "app-startup":
          //this._observerSvc.addObserver(this, "final-ui-startup", true);
          startup();

          // We need to delay the cleaning of prefs at startup, otherwise they are not loaded and read correctly
          var timerevent = { notify: function(timer) { cleanupPrefsStartup(); } }
          var nsITimer = Components.interfaces.nsITimer;
          var stdTimer = Components.classes["@mozilla.org/timer;1"]
                                     .createInstance(nsITimer);
          stdTimer.initWithCallback(timerevent, 0, nsITimer.TYPE_ONE_SHOT);
          break;
        case "final-ui-startup": 
          this._observerSvc.removeObserver(this, "final-ui-startup");
          // Need to do anything here?
          break;
        case "profile-change-teardown":
          this._observerSvc.removeObserver(this, "profile-change-teardown");
          if (gBeingUninstalled)
            uninstallShutdown();
          break;
        case "xpcom-shutdown":
          this._observerSvc.removeObserver(this, "xpcom-shutdown");
          break;
    }
  }
};

let components = [zemantaService];

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule(components);
