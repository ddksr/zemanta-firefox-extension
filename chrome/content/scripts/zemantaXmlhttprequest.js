/*
 * XHR API object
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

function ZemantaXMLHttpRequest(unsafeContentWin, chromeWindow, otherChromeWin)
{
  this.unsafeContentWin = unsafeContentWin;
  this.chromeWindow = chromeWindow;
  this.otherChromeWin = otherChromeWin;
};

ZemantaXMLHttpRequest.prototype.getAPIKey = function()
{
    return Zemanta.getAPIKey();
}

ZemantaXMLHttpRequest.prototype.getReleaseId = function()
{
    return Zemanta.getReleaseId();
}

// this function gets called by user scripts in content security scope to
// start a cross-domain xmlhttp request.
//
// details should look like:
// {method,url,onload,onerror,onreadystatechange,headers,data}
// headers should be in the form {name:value,name:value,etc}
// can't support mimetype because i think it's only used for forcing
// text/xml and we can't support that
ZemantaXMLHttpRequest.prototype.contentStartRequest = function(details)
{
  /*if (!Zem_apiLeakCheck("ZemantaXMLHttpRequest")) {
    return;
  }*/

  // don't actually need the timer functionality, but this pops it
  // out into chromeWindow's thread so that we get that security
  // context.
  Zemanta.Logger.debug("ZemantaXMLHttpRequest.contentStartRequest");

  // important to store this locally so that content cannot trick us up with
  // a fancy getter that checks the number of times it has been accessed,
  // returning a dangerous URL the time that we actually use it.
  var url = details.url;

  for (var detail in details)
      Zemanta.Logger.debug("ZemantaXMLHttpRequest - " + detail +" = "+details[detail]);

  // make sure that we have an actual string so that we can't be fooled with
  // tricky toString() implementations.
  if (typeof url != "string") {
    Zemanta.Logger.error("Invalid url: url must be of type string");
    return;
  }

  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService);
  var scheme = ioService.extractScheme(url);

  // This is important - without it, ZemantaXMLHttpRequest can be used to get
  // access to things like files and chrome. Careful.
  switch (scheme) {
    case "http":
    case "https":
      // Make sure request is coming from where we allow
      var proceed = Zemanta.checkZemantaURL(url, "api");
      var proceed2 = Zemanta.checkZemantaURL(url, "api2");
      var proceed3 = Zemanta.checkZemantaURL(url, "sapi");
      if (!proceed && !proceed2 && !proceed3)
      {
          Zemanta.Logger.error("Invalid url: Zemanta Requests can not access this url");
          return;
      }
      try {
        this.chromeWindow.setTimeout(
            Zemanta.Util.ZEM_hitch(this, "chromeStartRequest", url, details), 0);
      }
      catch(e) {
        Zemanta.Logger.debug("Can not start request from chrome : "+e);
      }
      break;
    default:
      throw new Error("Invalid url: " + url);
  }

  Zemanta.Logger.debug("ZemantaXMLHttpRequest.contentStartRequest end");
};

// this function is intended to be called in chrome's security context, so
// that it can access other domains without security warning
ZemantaXMLHttpRequest.prototype.chromeStartRequest = function(safeUrl, details) {
  Zemanta.Logger.debug("ZemantaXMLHttpRequest.chromeStartRequest");

  if (details.data) {
    var ddata = details.data;
    var methodString = ddata.substring(0, ddata.indexOf("&"));
    var methodName = methodString.substring(methodString.indexOf("=")+1);
    Zemanta.Logger.debug("ZemantaXMLHttpRequest.chromeStartRequest. Method = " + methodName);
    if (methodName == "zemanta.preferences") {
      // For the prefs call, let check the cache first
      var uprefs = Zemanta.Util.getPreference("userprefs");
      if (uprefs && uprefs != "") {
        Zemanta.Logger.debug("Zemanta user PREFS found in cache. Sending them....");
        // Here is where we return the cached prefs, and not make the request
        var responseState = {
          responseText:uprefs,
          readyState:4,
          responseHeaders:(''),
          status:200,
          statusText:'OK',
          finalUrl:details.url
        }

        // Emulate the zemanta.preferences callback
        new XPCNativeWrapper(this.unsafeContentWin, "setTimeout()")
          .setTimeout(function(){details.onload(responseState);}, 0);

        return;
      }
      else {
        Zemanta.Logger.debug("Zemanta user PREFS NOT found in cache. Doing a fresh retrieval...");
      }
    }
    else if (methodName == "zemanta.suggest") {
      // Let's do some mind reading
      var mindread = Zemanta.Util.getPreference("mindread");
      if (mindread) {
        Zemanta.Logger.debug("MIND READ INTERCEPT");
        details.data = ddata+"&articles_limit=100";
      }
    }
  }

  var req = new this.chromeWindow.XMLHttpRequest();

  this.setupRequestEvent(this.unsafeContentWin, req, "onload", details);
  this.setupRequestEvent(this.unsafeContentWin, req, "onerror", details);
  this.setupRequestEvent(this.unsafeContentWin, req, "onreadystatechange",
                         details);

  Zemanta.Logger.debug("ZemantaXMLHttpRequest.chromeStartRequest. safeUrl = " + safeUrl);
  req.open(details.method, safeUrl);

  if (details.overrideMimeType) {
    req.overrideMimeType(details.overrideMimeType);
  }

  if (details.headers) {
    for (var prop in details.headers) {
      req.setRequestHeader(prop, details.headers[prop]);
    }
  }

  var body = details.data ? details.data : null;
  if (details.binary) {
    req.sendAsBinary(body);
  } else {
    req.send(body);
  }
  Zemanta.Logger.debug("ZemantaXMLHttpRequest.chromeStartRequest end");
}

// arranges for the specified 'event' on xmlhttprequest 'req' to call the
// method by the same name which is a property of 'details' in the content
// window's security context.
ZemantaXMLHttpRequest.prototype.setupRequestEvent =
function(unsafeContentWin, req, event, details) {
  Zemanta.Logger.debug("ZemantaXMLHttpRequest.setupRequestEvent : " + event);

  if (details[event]) {
    req[event] = function() {
      Zemanta.Logger.debug("ZemantaXMLHttpRequest -- callback for " + event);
      var responseTxt = req.responseText;
      if (details.data) {
        var ddata = details.data;
        var methodString = ddata.substring(0, ddata.indexOf("&"));
        var methodName = methodString.substring(methodString.indexOf("=")+1);
        if (methodName == "zemanta.preferences") {
          var uprefs = Zemanta.Util.getPreference("userprefs");
          if (!uprefs || uprefs == "") {
            var jsObject = Zemanta.Util.getJSON().parse(responseTxt);
            if (jsObject && jsObject.status && jsObject.status == "ok")
              Zemanta.Util.setPreference("userprefs", req.responseText);
          }
        }
        else if (methodName == "zemanta.suggest") {
            var mindread = Zemanta.Util.getPreference("mindread");
            if (mindread) {
                // Let's do some mind reading
                var sTime = new Date();
                Zemanta.Logger.debug("MIND READING to commence at : "+sTime);
                //Zemanta.Logger.debug(responseTxt);
                var jsObject = Zemanta.Util.getJSON().parse(responseTxt);
                var articles = jsObject.articles;
                var newArts = Zemanta.MindRead(articles);
                jsObject.articles = newArts;
                responseTxt = Zemanta.Util.getJSON().stringify(jsObject);
                var eTime = new Date();
                Zemanta.Logger.debug("MIND READING to end at : "+eTime);
            }
        }
      }

      //Zemanta.Logger.debug(req.responseText);
      var responseState = {
        // can't support responseXML because security won't
        // let the browser call properties on it
        responseText:responseTxt,
        readyState:req.readyState,
        responseHeaders:(req.readyState == 4 ?
                         req.getAllResponseHeaders() :
                         ''),
        status:(req.readyState == 4 ? req.status : 0),
        statusText:(req.readyState == 4 ? req.statusText : ''),
        finalUrl:(req.readyState == 4 ? req.channel.URI.spec : '')
      }

      // Pop back onto browser thread and call event handler.
      // Have to use nested function here instead of Zem_hitch because
      // otherwise details[event].apply can point to window.setTimeout, which
      // can be abused to get increased priveledges.
      new XPCNativeWrapper(unsafeContentWin, "setTimeout()")
        .setTimeout(function(){details[event](responseState);}, 0);

      Zemanta.Logger.debug("ZemantaXMLHttpRequest -- callback for " + event);
    }
  }

  Zemanta.Logger.debug("ZemantaXMLHttpRequest.setupRequestEvent");
};